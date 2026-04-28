use super::pathing::{build_local_event_payload, now_iso};
use super::persistence::{
    insert_offline_event, load_extension_install_row, plugin_target_from_enabled_target,
    update_plugin_target_status, upsert_plugin_target,
};
use super::{
    DisableExtensionPayload, EnableExtensionPayload, ExtensionInstallPayload,
    ImportLocalExtensionPayload, ImportLocalSkillPayload, P1LocalState, PluginTargetPayload,
};

fn ensure_file_backed_skill_write(
    extension_type: &str,
    extension_kind: &str,
) -> Result<(), String> {
    if extension_kind != "file_backed" {
        return Err(format!(
            "extension_write_denied: P0 only allows file_backed writes; got {extension_kind}"
        ));
    }
    if extension_type != "skill" {
        return Err(format!(
            "extension_write_denied: P0 file-backed writes are limited to skill extensions; got {extension_type}"
        ));
    }
    Ok(())
}

struct ExtensionDenialEvent<'a> {
    event_type: &'a str,
    extension_id: &'a str,
    extension_type: &'a str,
    extension_kind: &'a str,
    version: &'a str,
    target_type: &'a str,
    target_id: &'a str,
    requested_mode: &'a str,
    denial_reason: &'a str,
    enterprise_status: Option<&'a str>,
}

fn record_extension_denial_event(
    state: &P1LocalState,
    input: ExtensionDenialEvent<'_>,
) -> Result<(), String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let occurred_at = now_iso();
    let mut event = build_local_event_payload(
        input.event_type,
        input.extension_id,
        input.version,
        input.target_type,
        input.target_id,
        "",
        input.requested_mode,
        input.requested_mode,
        Some(input.denial_reason.to_string()),
        occurred_at,
        "failed",
    );
    event.extension_id = Some(input.extension_id.to_string());
    event.extension_type = Some(input.extension_type.to_string());
    event.extension_kind = Some(input.extension_kind.to_string());
    event.denial_reason = Some(input.denial_reason.to_string());
    event.enterprise_status = input.enterprise_status.map(str::to_string);
    insert_offline_event(&conn, event).map_err(|error| error.to_string())
}

fn ensure_enterprise_allowed(install: &ExtensionInstallPayload) -> Result<(), String> {
    match install.enterprise_status.as_str() {
        "allowed" => Ok(()),
        "disabled" | "revoked" => Err(format!(
            "extension_policy_denied: {} is {} and cannot be enabled",
            install.extension_id, install.enterprise_status
        )),
        other => Err(format!(
            "extension_policy_denied: {} has unsupported enterprise status {other}",
            install.extension_id
        )),
    }
}

pub(super) fn import_local_extension(
    state: &P1LocalState,
    input: ImportLocalExtensionPayload,
) -> Result<ExtensionInstallPayload, String> {
    if let Err(error) = ensure_file_backed_skill_write(&input.extension_type, &input.extension_kind)
    {
        record_extension_denial_event(
            state,
            ExtensionDenialEvent {
                event_type: "install_result",
                extension_id: &input.extension_id,
                extension_type: &input.extension_type,
                extension_kind: &input.extension_kind,
                version: "0.0.0",
                target_type: &input.target_type,
                target_id: &input.target_id,
                requested_mode: "copy",
                denial_reason: &error,
                enterprise_status: None,
            },
        )?;
        return Err(error);
    }
    let imported = super::package_lifecycle::import_local_skill(
        state,
        ImportLocalSkillPayload {
            target_type: input.target_type,
            target_id: input.target_id,
            relative_path: input.relative_path,
            skill_id: input.extension_id.clone(),
            conflict_strategy: input.conflict_strategy,
        },
    )?;
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    load_extension_install_row(&conn, &imported.skill_id).map_err(|error| error.to_string())
}

pub(super) fn enable_extension(
    state: &P1LocalState,
    input: EnableExtensionPayload,
) -> Result<PluginTargetPayload, String> {
    let requested_mode = input
        .preferred_mode
        .as_deref()
        .or(input.requested_mode.as_deref())
        .unwrap_or("symlink");
    if let Err(error) = ensure_file_backed_skill_write(&input.extension_type, &input.extension_kind)
    {
        record_extension_denial_event(
            state,
            ExtensionDenialEvent {
                event_type: "enable_result",
                extension_id: &input.extension_id,
                extension_type: &input.extension_type,
                extension_kind: &input.extension_kind,
                version: &input.version,
                target_type: &input.target_type,
                target_id: &input.target_id,
                requested_mode,
                denial_reason: &error,
                enterprise_status: None,
            },
        )?;
        return Err(error);
    }
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let install = load_extension_install_row(&conn, &input.extension_id)
        .map_err(|error| error.to_string())?;
    if let Err(error) = ensure_enterprise_allowed(&install) {
        drop(conn);
        record_extension_denial_event(
            state,
            ExtensionDenialEvent {
                event_type: "enable_result",
                extension_id: &input.extension_id,
                extension_type: &input.extension_type,
                extension_kind: &input.extension_kind,
                version: &input.version,
                target_type: &input.target_type,
                target_id: &input.target_id,
                requested_mode,
                denial_reason: &error,
                enterprise_status: Some(&install.enterprise_status),
            },
        )?;
        return Err(error);
    }
    drop(conn);

    let target = super::distribution_lifecycle::enable_skill(
        state,
        input.extension_id.clone(),
        input.version,
        input.target_type,
        input.target_id,
        input.preferred_mode.or(input.requested_mode),
        input.allow_overwrite,
    )?;
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let plugin_target = plugin_target_from_enabled_target(&target, None);
    upsert_plugin_target(&conn, &plugin_target).map_err(|error| error.to_string())?;
    Ok(plugin_target)
}

pub(super) fn disable_extension(
    state: &P1LocalState,
    input: DisableExtensionPayload,
) -> Result<PluginTargetPayload, String> {
    if let Err(error) = ensure_file_backed_skill_write(&input.extension_type, &input.extension_kind)
    {
        record_extension_denial_event(
            state,
            ExtensionDenialEvent {
                event_type: "disable_result",
                extension_id: &input.extension_id,
                extension_type: &input.extension_type,
                extension_kind: &input.extension_kind,
                version: "0.0.0",
                target_type: &input.target_type,
                target_id: &input.target_id,
                requested_mode: "copy",
                denial_reason: &error,
                enterprise_status: None,
            },
        )?;
        return Err(error);
    }
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let install = load_extension_install_row(&conn, &input.extension_id)
        .map_err(|error| error.to_string())?;
    let target = install
        .targets
        .iter()
        .find(|target| {
            target.target_type == input.target_type && target.target_id == input.target_id
        })
        .cloned()
        .ok_or_else(|| {
            format!(
                "extension target not enabled: {} {}:{}",
                input.extension_id, input.target_type, input.target_id
            )
        })?;
    drop(conn);

    let disabled = super::distribution_lifecycle::disable_skill(
        state,
        input.extension_id.clone(),
        input.target_type.clone(),
        input.target_id.clone(),
    )?;
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    update_plugin_target_status(
        &conn,
        &input.extension_id,
        &input.target_type,
        &input.target_id,
        "disabled",
        target.denial_reason,
        &disabled.event.occurred_at,
    )
    .map_err(|error| error.to_string())
}
