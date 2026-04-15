use std::fs;
use std::io::{self, Cursor};
use std::path::PathBuf;

use reqwest::blocking::Client;
use zip::ZipArchive;

use super::pathing::{
    build_local_event_payload, enabled_target_model, now_iso, now_millis, sanitize_segment,
};
use super::persistence::{
    insert_offline_event, load_all_enabled_targets, load_install_row, local_install_payload,
    upsert_local_install,
};
use super::{DownloadTicketPayload, LocalSkillInstallPayload, P1LocalState, UninstallSkillPayload};
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
        updated_at: timestamp.clone(),
    })
    .map_err(|error| error.to_string())?;
    let _ = fs::remove_dir_all(&package_dir);

    let conn = state.open_connection().map_err(|error| error.to_string())?;
    upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;
    local_install_payload(&conn, install).map_err(|error| error.to_string())
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
        let status = match disable_distribution(DisableDistributionRequest {
            managed_target_path: PathBuf::from(&target.target_path),
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
    insert_offline_event(&conn, event.clone()).map_err(|error| error.to_string())?;

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
