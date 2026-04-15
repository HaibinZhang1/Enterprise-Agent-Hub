use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(not(test))]
use crate::adapters::{
    builtin_adapters, expand_platform_path, AdapterConfig, AdapterID,
    InstallMode as AdapterInstallMode, Platform,
};
#[cfg(test)]
use crate::commands::distribution::adapters::{
    builtin_adapters, expand_platform_path, AdapterConfig, AdapterID,
    InstallMode as AdapterInstallMode, Platform,
};
use crate::store::models::{EnabledTarget, EnabledTargetStatus, InstallMode, TargetType};

use super::configuration::{load_project_config, load_tool_config_payload};
use super::EnabledTargetPayload;
use rusqlite::Connection;

pub(super) fn parse_adapter_mode(value: &str) -> Result<AdapterInstallMode, String> {
    match value {
        "symlink" => Ok(AdapterInstallMode::Symlink),
        "copy" => Ok(AdapterInstallMode::Copy),
        other => Err(format!("unsupported install mode: {other}")),
    }
}

pub(super) fn parse_store_install_mode(value: &str) -> Result<InstallMode, String> {
    match value {
        "symlink" => Ok(InstallMode::Symlink),
        "copy" => Ok(InstallMode::Copy),
        other => Err(format!("unsupported install mode: {other}")),
    }
}

pub(super) fn parse_store_target_type(value: &str) -> Result<TargetType, String> {
    match value {
        "tool" => Ok(TargetType::Tool),
        "project" => Ok(TargetType::Project),
        other => Err(format!("unsupported target type: {other}")),
    }
}

pub(super) fn resolve_enable_target(
    conn: &Connection,
    target_type: &str,
    target_id: &str,
) -> Result<(AdapterConfig, String, PathBuf), String> {
    match target_type {
        "tool" => {
            let tool =
                load_tool_config_payload(conn, target_id).map_err(|error| error.to_string())?;
            if !tool.enabled {
                return Err(format!("tool target {} is disabled", tool.display_name));
            }
            if tool.skills_path.trim().is_empty() {
                return Err(format!(
                    "tool target {} does not have a configured skills path",
                    tool.display_name
                ));
            }
            if matches!(
                tool.adapter_status.as_str(),
                "missing" | "invalid" | "disabled"
            ) {
                return Err(format!(
                    "tool target {} is not ready: {}",
                    tool.display_name, tool.adapter_status
                ));
            }
            let adapter = builtin_adapters()
                .into_iter()
                .find(|candidate| candidate.tool_id.as_str() == target_id)
                .ok_or_else(|| format!("tool adapter is not registered: {target_id}"))?;
            Ok((adapter, tool.display_name, PathBuf::from(tool.skills_path)))
        }
        "project" => {
            let project =
                load_project_config(conn, target_id).map_err(|error| error.to_string())?;
            let adapter = resolve_project_adapter(&project.skills_path)?;
            Ok((adapter, project.name, PathBuf::from(project.skills_path)))
        }
        other_type => Err(format!("unsupported target type: {other_type}")),
    }
}

pub(super) fn resolve_project_adapter(skills_path: &str) -> Result<AdapterConfig, String> {
    let normalized_skills_path = normalize_path_text(skills_path);
    let platform = current_platform();
    builtin_adapters()
        .into_iter()
        .find(|adapter| {
            adapter
                .resolve(platform)
                .target
                .project_paths
                .iter()
                .map(|candidate| normalize_relative_path(candidate))
                .any(|candidate| normalized_skills_path.ends_with(&candidate))
        })
        .ok_or_else(|| format!("unable to infer project adapter from skills path: {skills_path}"))
}

pub(super) fn enabled_target_model(
    target: &EnabledTargetPayload,
    status: EnabledTargetStatus,
) -> EnabledTarget {
    EnabledTarget {
        id: target.id.clone(),
        skill_id: target.skill_id.clone(),
        target_type: parse_store_target_type(&target.target_type).unwrap_or(TargetType::Tool),
        target_id: target.target_id.clone(),
        target_name: target.target_name.clone(),
        target_path: PathBuf::from(&target.target_path),
        artifact_path: PathBuf::from(&target.artifact_path),
        install_mode: parse_store_install_mode(&target.install_mode).unwrap_or(InstallMode::Copy),
        requested_mode: parse_store_install_mode(&target.requested_mode)
            .unwrap_or(InstallMode::Copy),
        resolved_mode: parse_store_install_mode(&target.resolved_mode).unwrap_or(InstallMode::Copy),
        fallback_reason: target.fallback_reason.clone(),
        artifact_hash: target.artifact_hash.clone(),
        enabled_at: target.enabled_at.clone(),
        updated_at: target.updated_at.clone(),
        status,
        last_error: target.last_error.clone(),
    }
}

pub(super) fn build_local_event_payload(
    event_type: &str,
    skill_id: &str,
    version: &str,
    target_type: &str,
    target_id: impl Into<String>,
    target_path: impl Into<String>,
    requested_mode: impl Into<String>,
    resolved_mode: impl Into<String>,
    fallback_reason: Option<String>,
    occurred_at: impl Into<String>,
    result: &str,
) -> super::LocalEventPayload {
    super::LocalEventPayload {
        event_id: format!("evt_{}", now_millis()),
        event_type: event_type.to_string(),
        skill_id: skill_id.to_string(),
        version: version.to_string(),
        target_type: target_type.to_string(),
        target_id: target_id.into(),
        target_path: target_path.into(),
        requested_mode: requested_mode.into(),
        resolved_mode: resolved_mode.into(),
        fallback_reason,
        occurred_at: occurred_at.into(),
        result: result.to_string(),
    }
}

pub(super) fn normalize_project_path(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("project path cannot be empty".to_string());
    }
    Ok(PathBuf::from(expand_user_supplied_path(trimmed)))
}

pub(super) fn normalize_tool_skills_path(
    adapter: &AdapterConfig,
    value: &str,
) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if !trimmed.is_empty() {
        return Ok(PathBuf::from(expand_user_supplied_path(trimmed)));
    }
    default_tool_skills_path(adapter)
        .map(PathBuf::from)
        .ok_or_else(|| format!("skills path cannot be empty for {}", adapter.display_name))
}

pub(super) fn normalize_optional_path(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(expand_user_supplied_path(trimmed))
    }
}

pub(super) fn derive_project_id(name: &str, project_path: &Path) -> String {
    let candidate = project_path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(name);
    let sanitized = sanitize_segment(candidate);
    if sanitized.is_empty() {
        format!("project-{}", now_millis())
    } else {
        sanitized
    }
}

pub(super) fn default_project_skills_suffix() -> String {
    builtin_adapters()
        .into_iter()
        .find(|adapter| adapter.tool_id == AdapterID::Codex)
        .and_then(|adapter| {
            adapter
                .resolve(current_platform())
                .target
                .project_paths
                .into_iter()
                .next()
        })
        .unwrap_or_else(|| ".codex/skills".to_string())
}

pub(super) fn default_tool_skills_path(adapter: &AdapterConfig) -> Option<String> {
    if adapter.tool_id == AdapterID::Codex {
        if let Ok(path) = std::env::var("EAH_P1_CODEX_SKILLS_PATH") {
            if !path.trim().is_empty() {
                return Some(path);
            }
        }
    }
    adapter
        .resolve(current_platform())
        .target
        .global_paths
        .into_iter()
        .next()
        .map(|path| {
            expand_platform_path(&path, current_platform())
                .to_string_lossy()
                .to_string()
        })
}

pub(super) fn default_tool_config_path(adapter: &AdapterConfig) -> Option<String> {
    if adapter.tool_id == AdapterID::CustomDirectory {
        return Some("手动维护".to_string());
    }
    adapter
        .resolve(current_platform())
        .target
        .config_path
        .map(|path| {
            expand_platform_path(&path, current_platform())
                .to_string_lossy()
                .to_string()
        })
}

pub(super) fn expand_user_supplied_path(value: &str) -> String {
    expand_platform_path(value, current_platform())
        .to_string_lossy()
        .to_string()
}

pub(super) fn current_platform() -> Platform {
    Platform::current()
}

pub(super) fn normalize_path_text(value: &str) -> String {
    value.replace('\\', "/").to_ascii_lowercase()
}

pub(super) fn normalize_relative_path(value: &str) -> String {
    normalize_path_text(value)
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

pub(super) fn bool_to_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

pub(super) fn int_to_bool(value: i64) -> bool {
    value != 0
}

pub(super) fn sanitize_segment(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' {
                ch
            } else {
                '-'
            }
        })
        .collect()
}

pub(super) fn target_page_to_object_type(target_page: &str) -> Option<String> {
    match target_page {
        "market" => Some("skill".to_string()),
        "tools" => Some("tool".to_string()),
        "projects" => Some("project".to_string()),
        "notifications" => Some("connection".to_string()),
        _ => None,
    }
}

pub(super) fn target_page_to_object_id(
    target_page: &str,
    related_skill_id: Option<String>,
) -> Option<String> {
    if target_page == "market" {
        return related_skill_id;
    }
    None
}

pub(super) fn now_iso() -> String {
    let millis = now_millis();
    format!("p1-local-{millis}")
}

pub(super) fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}
