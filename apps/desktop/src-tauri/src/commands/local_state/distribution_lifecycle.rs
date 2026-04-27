use std::path::PathBuf;

use rusqlite::params;

use super::checksum::{can_remove_claimed_target, hash_path};
use super::pathing::{
    build_local_event_payload, now_iso, parse_adapter_mode, resolve_enable_target,
};
use super::persistence::{
    insert_offline_event, load_enabled_target, load_install_row, refresh_install_status,
    upsert_enabled_target,
};
use super::{DisableSkillPayload, EnabledTargetPayload, P1LocalState};
use crate::commands::distribution::{
    disable_distribution, enable_distribution, DisableDistributionRequest,
    EnableDistributionRequest,
};
pub(super) fn enable_skill(
    state: &P1LocalState,
    skill_id: String,
    version: String,
    target_type: String,
    target_id: String,
    preferred_mode: Option<String>,
    allow_overwrite: Option<bool>,
) -> Result<EnabledTargetPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let install = load_install_row(&conn, &skill_id).map_err(|error| error.to_string())?;
    let installed_version = if version.trim().is_empty() {
        install.local_version.clone()
    } else {
        version
    };
    if installed_version != install.local_version {
        return Err(format!(
            "installed version is {}, requested {}",
            install.local_version, installed_version
        ));
    }
    let (adapter, target_name, target_root) =
        resolve_enable_target(&conn, &target_type, &target_id)?;
    let requested_mode = parse_adapter_mode(preferred_mode.as_deref().unwrap_or("symlink"))?;
    let response = enable_distribution(EnableDistributionRequest {
        skill_id: skill_id.clone(),
        version: installed_version.clone(),
        adapter_id: adapter.tool_id,
        central_store_skill_path: PathBuf::from(&install.central_store_path),
        derived_root: state.central_store_root().join("derived"),
        target_root,
        requested_mode,
        allow_overwrite: allow_overwrite.unwrap_or(false),
    })
    .map_err(|error| error.to_string())?;

    let timestamp = now_iso();
    let target = EnabledTargetPayload {
        id: format!("{skill_id}:{target_type}:{target_id}"),
        skill_id: skill_id.clone(),
        target_type: target_type.clone(),
        target_id: target_id.clone(),
        target_name,
        target_path: response.target_path.to_string_lossy().to_string(),
        artifact_path: response.artifact_path.to_string_lossy().to_string(),
        install_mode: response.resolved_mode.as_str().to_string(),
        requested_mode: response.requested_mode.as_str().to_string(),
        resolved_mode: response.resolved_mode.as_str().to_string(),
        fallback_reason: response.fallback_reason.clone(),
        artifact_hash: hash_path(&response.artifact_path).map_err(|error| error.to_string())?,
        enabled_at: timestamp.clone(),
        updated_at: timestamp.clone(),
        status: "enabled".to_string(),
        last_error: None,
    };
    upsert_enabled_target(&conn, &target).map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE local_skill_installs SET local_status = 'enabled', updated_at = ? WHERE skill_id = ?",
        params![timestamp, skill_id],
    )
    .map_err(|error| error.to_string())?;
    if install.source_type != "local_import" {
        insert_offline_event(
            &conn,
            build_local_event_payload(
                "enable_result",
                &skill_id,
                &install.local_version,
                &target.target_type,
                &target.target_id,
                &target.target_path,
                &target.requested_mode,
                &target.resolved_mode,
                target.fallback_reason.clone(),
                target.enabled_at.clone(),
                "success",
            ),
        )
        .map_err(|error| error.to_string())?;
    }

    Ok(target)
}

pub(super) fn disable_skill(
    state: &P1LocalState,
    skill_id: String,
    target_type: String,
    target_id: String,
) -> Result<DisableSkillPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let install = load_install_row(&conn, &skill_id).map_err(|error| error.to_string())?;
    let target = load_enabled_target(&conn, &skill_id, &target_type, &target_id)
        .map_err(|error| error.to_string())?;

    let target_path = PathBuf::from(&target.target_path);
    let allow_unmanaged_removal = can_remove_claimed_target(
        &install.source_type,
        target.fallback_reason.as_deref(),
        &target_path,
        &target.artifact_hash,
    );
    disable_distribution(DisableDistributionRequest {
        managed_target_path: target_path,
        allow_unmanaged_removal,
    })
    .map_err(|error| error.to_string())?;

    let updated_at = now_iso();
    conn.execute(
        "UPDATE enabled_targets SET status = 'disabled', updated_at = ? WHERE skill_id = ? AND target_type = ? AND target_id = ?",
        params![&updated_at, &skill_id, &target_type, &target_id],
    )
    .map_err(|error| error.to_string())?;
    refresh_install_status(&conn, &skill_id, &updated_at).map_err(|error| error.to_string())?;

    let event = build_local_event_payload(
        "disable_result",
        &skill_id,
        &install.local_version,
        &target_type,
        &target_id,
        &target.target_path,
        &target.requested_mode,
        &target.resolved_mode,
        target.fallback_reason,
        updated_at,
        "success",
    );
    if install.source_type != "local_import" {
        insert_offline_event(&conn, event.clone()).map_err(|error| error.to_string())?;
    }

    Ok(DisableSkillPayload { event })
}
