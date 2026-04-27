use std::fs;
use std::io::{self, Cursor};
use std::path::{Component, Path, PathBuf};

use reqwest::blocking::Client;
use zip::ZipArchive;

use super::checksum::{can_remove_claimed_target, hash_path};
use super::configuration::{load_project_config, load_tool_config_payload};
use super::pathing::{
    build_local_event_payload, enabled_target_model, now_iso, now_millis, sanitize_segment,
};
use super::persistence::{
    insert_offline_event, load_all_enabled_targets, load_enabled_targets, load_install_row,
    local_install_payload, refresh_install_status, upsert_enabled_target, upsert_local_install,
};
use super::scan::{read_import_metadata, sanitize_import_skill_id, scan_local_targets_from_conn};
use super::{
    DownloadTicketPayload, EnabledTargetPayload, ImportLocalSkillPayload, LocalSkillInstallPayload,
    P1LocalState, UninstallSkillPayload,
};
use crate::commands::distribution::{disable_distribution, DisableDistributionRequest};
use crate::store::commands::{
    install_skill_package as store_install_skill_package, uninstall_skill as store_uninstall_skill,
    update_skill_package as store_update_skill_package, InstallSkillPackageRequest,
    UninstallSkillRequest, UpdateSkillPackageRequest,
};
use crate::store::hash::sha256_hex;
use crate::store::models::EnabledTargetStatus;

pub(super) fn install_skill_package(
    state: &P1LocalState,
    download_ticket: DownloadTicketPayload,
) -> Result<LocalSkillInstallPayload, String> {
    let package_dir =
        download_and_extract_package(&state.http, state.central_store_root(), &download_ticket)?;
    let timestamp = now_iso();
    let install = store_install_skill_package(InstallSkillPackageRequest {
        skill_id: download_ticket.skill_id.clone(),
        display_name: download_ticket.skill_id.clone(),
        version: download_ticket.version.clone(),
        downloaded_package_dir: package_dir.clone(),
        central_store_root: state.central_store_root().to_path_buf(),
        source_package_hash: download_ticket.package_hash.clone(),
        source_type: "remote".to_string(),
        installed_at: timestamp.clone(),
    })
    .map_err(|error| error.to_string())?;
    let _ = fs::remove_dir_all(&package_dir);

    let conn = state.open_connection().map_err(|error| error.to_string())?;
    upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;
    local_install_payload(&conn, install).map_err(|error| error.to_string())
}

pub(super) fn update_skill_package(
    state: &P1LocalState,
    download_ticket: DownloadTicketPayload,
) -> Result<LocalSkillInstallPayload, String> {
    let package_dir =
        download_and_extract_package(&state.http, state.central_store_root(), &download_ticket)?;
    let timestamp = now_iso();
    let install = store_update_skill_package(UpdateSkillPackageRequest {
        skill_id: download_ticket.skill_id.clone(),
        display_name: download_ticket.skill_id.clone(),
        version: download_ticket.version.clone(),
        downloaded_package_dir: package_dir.clone(),
        central_store_root: state.central_store_root().to_path_buf(),
        source_package_hash: download_ticket.package_hash.clone(),
        source_type: "remote".to_string(),
        updated_at: timestamp.clone(),
    })
    .map_err(|error| error.to_string())?;
    let _ = fs::remove_dir_all(&package_dir);

    let conn = state.open_connection().map_err(|error| error.to_string())?;
    upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;
    local_install_payload(&conn, install).map_err(|error| error.to_string())
}

pub(super) fn import_local_skill(
    state: &P1LocalState,
    input: ImportLocalSkillPayload,
) -> Result<LocalSkillInstallPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let final_skill_id = validate_import_skill_id(&input.skill_id)?;
    let relative_path = safe_relative_path(&input.relative_path)?;
    let (target_name, target_root) =
        resolve_import_root(&conn, &input.target_type, &input.target_id)?;
    let source_path = resolve_source_path(&target_root, &relative_path)?;
    let metadata = read_import_metadata(&source_path, &input.relative_path)
        .ok_or_else(|| "扫描目录根部缺少 SKILL.md，不能纳入 Central Store 管理。".to_string())?;
    let source_skill_id = metadata.skill_id.clone();
    let source_checksum = hash_path(&source_path)?;
    if load_install_row(&conn, &final_skill_id).is_ok() && input.conflict_strategy != "replace" {
        return Err(format!(
            "Central Store 中已存在同名 Skill：{}，请重命名导入或选择替换。",
            final_skill_id
        ));
    }

    let mut claims = matching_import_claims(&conn, &source_skill_id, &source_checksum)?;
    if !claims.iter().any(|claim| {
        claim.target_type == input.target_type
            && claim.target_id == input.target_id
            && normalize_claim_path(&claim.target_path)
                == normalize_claim_path(source_path.to_string_lossy().as_ref())
    }) {
        claims.push(ImportClaim {
            target_type: input.target_type.clone(),
            target_id: input.target_id.clone(),
            target_name,
            target_path: source_path.to_string_lossy().to_string(),
            checksum: source_checksum.clone(),
        });
    }

    let timestamp = now_iso();
    let mut install = store_install_skill_package(InstallSkillPackageRequest {
        skill_id: final_skill_id.clone(),
        display_name: metadata.display_name,
        version: metadata.version,
        downloaded_package_dir: source_path.clone(),
        central_store_root: state.central_store_root().to_path_buf(),
        source_package_hash: format!("sha256:{source_checksum}"),
        source_type: "local_import".to_string(),
        installed_at: timestamp.clone(),
    })
    .map_err(|error| error.to_string())?;
    install.can_update = false;
    upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;

    for claim in claims {
        let target = EnabledTargetPayload {
            id: format!(
                "{}:{}:{}",
                final_skill_id, claim.target_type, claim.target_id
            ),
            skill_id: final_skill_id.clone(),
            target_type: claim.target_type,
            target_id: claim.target_id,
            target_name: claim.target_name,
            target_path: claim.target_path,
            artifact_path: install.central_store_path.to_string_lossy().to_string(),
            install_mode: "copy".to_string(),
            requested_mode: "copy".to_string(),
            resolved_mode: "copy".to_string(),
            fallback_reason: Some("local_import_claimed".to_string()),
            artifact_hash: claim.checksum,
            enabled_at: timestamp.clone(),
            updated_at: timestamp.clone(),
            status: "enabled".to_string(),
            last_error: None,
        };
        upsert_enabled_target(&conn, &target).map_err(|error| error.to_string())?;
    }
    refresh_install_status(&conn, &final_skill_id, &timestamp)
        .map_err(|error| error.to_string())?;

    let mut payload =
        load_install_row(&conn, &final_skill_id).map_err(|error| error.to_string())?;
    payload.enabled_targets =
        load_enabled_targets(&conn, &final_skill_id).map_err(|error| error.to_string())?;
    Ok(payload)
}

pub(super) fn uninstall_skill(
    state: &P1LocalState,
    skill_id: String,
) -> Result<UninstallSkillPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let install = load_install_row(&conn, &skill_id).map_err(|error| error.to_string())?;
    let enabled_targets =
        load_all_enabled_targets(&conn, &skill_id).map_err(|error| error.to_string())?;
    let mut request_targets = Vec::new();
    let mut failed_target_ids = Vec::new();

    for target in &enabled_targets {
        let target_path = PathBuf::from(&target.target_path);
        let allow_unmanaged_removal = can_remove_claimed_target(
            &install.source_type,
            target.fallback_reason.as_deref(),
            &target_path,
            &target.artifact_hash,
        );
        let status = match disable_distribution(DisableDistributionRequest {
            managed_target_path: target_path,
            allow_unmanaged_removal,
        }) {
            Ok(()) => EnabledTargetStatus::Disabled,
            Err(_) => {
                failed_target_ids.push(target.target_id.clone());
                EnabledTargetStatus::Failed
            }
        };
        request_targets.push(enabled_target_model(target, status));
    }

    let removed_at = now_iso();
    let result = store_uninstall_skill(UninstallSkillRequest {
        skill_id: skill_id.clone(),
        central_store_root: state.central_store_root().to_path_buf(),
        enabled_targets: request_targets,
        removed_at: removed_at.clone(),
    })
    .map_err(|error| error.to_string())?;

    conn.execute(
        "DELETE FROM local_skill_installs WHERE skill_id = ?",
        [skill_id.clone()],
    )
    .map_err(|error| error.to_string())?;

    let event = build_local_event_payload(
        "uninstall_result",
        &skill_id,
        &install.local_version,
        enabled_targets
            .first()
            .map(|target| target.target_type.as_str())
            .unwrap_or("tool"),
        if enabled_targets.is_empty() {
            "local_install".to_string()
        } else {
            enabled_targets
                .iter()
                .map(|target| target.target_id.clone())
                .collect::<Vec<_>>()
                .join(",")
        },
        install.central_store_path.clone(),
        "copy".to_string(),
        "copy".to_string(),
        None,
        removed_at.clone(),
        if failed_target_ids.is_empty() {
            "success"
        } else {
            "failed"
        },
    );
    if install.source_type != "local_import" {
        insert_offline_event(&conn, event.clone()).map_err(|error| error.to_string())?;
    }

    Ok(UninstallSkillPayload {
        removed_target_ids: result.removed_target_ids,
        failed_target_ids,
        event,
    })
}

fn download_and_extract_package(
    http: &Client,
    central_store_root: &std::path::Path,
    ticket: &DownloadTicketPayload,
) -> Result<PathBuf, String> {
    let downloads_root = central_store_root.join("downloads");
    fs::create_dir_all(&downloads_root)
        .map_err(|error| format!("create downloads root: {error}"))?;
    let response = http
        .get(&ticket.package_url)
        .send()
        .map_err(|error| format!("download package: {error}"))?
        .error_for_status()
        .map_err(|error| format!("download package status: {error}"))?;
    let bytes = response
        .bytes()
        .map_err(|error| format!("read package bytes: {error}"))?;
    if bytes.len() as u64 != ticket.package_size {
        return Err(format!(
            "downloaded package size mismatch: expected {}, actual {}",
            ticket.package_size,
            bytes.len()
        ));
    }
    let actual_hash = format!("sha256:{}", sha256_hex(bytes.as_ref()));
    if !ticket.package_hash.eq_ignore_ascii_case(&actual_hash) {
        return Err(format!(
            "downloaded package hash mismatch: expected {}, actual {}",
            ticket.package_hash, actual_hash
        ));
    }

    let extract_dir = downloads_root.join(format!(
        ".{}-{}-{}.tmp",
        sanitize_segment(&ticket.skill_id),
        sanitize_segment(&ticket.version),
        now_millis()
    ));
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)
            .map_err(|error| format!("clear temp package dir: {error}"))?;
    }
    fs::create_dir_all(&extract_dir)
        .map_err(|error| format!("create temp package dir: {error}"))?;
    extract_zip_bytes(&bytes, &extract_dir)?;
    Ok(extract_dir)
}

#[derive(Debug, Clone)]
struct ImportClaim {
    target_type: String,
    target_id: String,
    target_name: String,
    target_path: String,
    checksum: String,
}

fn matching_import_claims(
    conn: &rusqlite::Connection,
    source_skill_id: &str,
    source_checksum: &str,
) -> Result<Vec<ImportClaim>, String> {
    let summaries = scan_local_targets_from_conn(conn)?;
    let mut claims = Vec::new();
    for summary in summaries {
        for finding in summary.findings {
            if finding.kind != "unmanaged" || !finding.can_import {
                continue;
            }
            if finding.skill_id.as_deref() != Some(source_skill_id) {
                continue;
            }
            if finding.checksum.as_deref() != Some(source_checksum) {
                continue;
            }
            claims.push(ImportClaim {
                target_type: finding.target_type,
                target_id: finding.target_id,
                target_name: finding.target_name,
                target_path: finding.target_path,
                checksum: source_checksum.to_string(),
            });
        }
    }
    Ok(claims)
}

fn resolve_import_root(
    conn: &rusqlite::Connection,
    target_type: &str,
    target_id: &str,
) -> Result<(String, PathBuf), String> {
    match target_type {
        "tool" => {
            let tool =
                load_tool_config_payload(conn, target_id).map_err(|error| error.to_string())?;
            if tool.skills_path.trim().is_empty() {
                return Err(format!("工具 {} 未配置 skills 路径。", tool.display_name));
            }
            Ok((tool.display_name, PathBuf::from(tool.skills_path)))
        }
        "project" => {
            let project =
                load_project_config(conn, target_id).map_err(|error| error.to_string())?;
            if project.skills_path.trim().is_empty() {
                return Err(format!(
                    "项目 {} 未配置 skills 路径。",
                    project.display_name
                ));
            }
            Ok((project.display_name, PathBuf::from(project.skills_path)))
        }
        other => Err(format!("unsupported target type: {other}")),
    }
}

fn resolve_source_path(root: &Path, relative_path: &Path) -> Result<PathBuf, String> {
    let root = fs::canonicalize(root)
        .map_err(|error| format!("读取目标根路径 {} 失败：{error}", root.display()))?;
    let source = fs::canonicalize(root.join(relative_path))
        .map_err(|error| format!("读取扫描目录 {} 失败：{error}", relative_path.display()))?;
    if !source.starts_with(&root) {
        return Err("扫描目录必须位于已配置的工具或项目 skills 根路径内。".to_string());
    }
    if !source.is_dir() {
        return Err("扫描项不是目录，不能纳入管理。".to_string());
    }
    Ok(source)
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(value);
    if path.is_absolute() {
        return Err("relativePath 不能是绝对路径。".to_string());
    }
    if path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err("relativePath 不能包含上级目录或根路径。".to_string());
    }
    if path
        .components()
        .all(|component| matches!(component, Component::CurDir))
    {
        return Err("relativePath 不能为空。".to_string());
    }
    Ok(path)
}

fn validate_import_skill_id(value: &str) -> Result<String, String> {
    let sanitized = sanitize_import_skill_id(value);
    if sanitized.is_empty() || sanitized != value {
        return Err(format!("invalid skillID: {value}"));
    }
    Ok(sanitized)
}

fn normalize_claim_path(value: &str) -> String {
    value.replace('\\', "/").to_ascii_lowercase()
}

fn extract_zip_bytes(bytes: &[u8], target_dir: &std::path::Path) -> Result<(), String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes))
        .map_err(|error| format!("read package zip: {error}"))?;
    for index in 0..archive.len() {
        let mut file = archive
            .by_index(index)
            .map_err(|error| format!("read package zip entry: {error}"))?;
        let enclosed = file
            .enclosed_name()
            .ok_or_else(|| format!("unsafe package entry path: {}", file.name()))?
            .to_path_buf();
        let output_path = target_dir.join(enclosed);
        if file.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|error| format!("create package directory: {error}"))?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("create package file parent: {error}"))?;
        }
        let mut output = fs::File::create(&output_path)
            .map_err(|error| format!("create package file {}: {error}", output_path.display()))?;
        io::copy(&mut file, &mut output)
            .map_err(|error| format!("extract package file {}: {error}", output_path.display()))?;
    }
    Ok(())
}
