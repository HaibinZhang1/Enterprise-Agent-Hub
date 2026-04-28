use super::configuration::{detect_tools_from_conn, list_project_configs_from_conn};
use super::persistence::{
    count_pending_offline_events, count_unread_local_notifications,
    list_extension_installs_from_conn, list_local_installs_from_conn, load_local_notifications,
    load_pending_offline_events,
};
use super::{LocalBootstrapPayload, LocalSkillInstallPayload, P1LocalState, ToolConfigPayload};

pub(super) fn get_local_bootstrap(state: &P1LocalState) -> Result<LocalBootstrapPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    Ok(LocalBootstrapPayload {
        installs: list_local_installs_from_conn(&conn).map_err(|error| error.to_string())?,
        extensions: list_extension_installs_from_conn(&conn).map_err(|error| error.to_string())?,
        tools: detect_tools_from_conn(&conn).map_err(|error| error.to_string())?,
        projects: list_project_configs_from_conn(&conn).map_err(|error| error.to_string())?,
        notifications: load_local_notifications(&conn).map_err(|error| error.to_string())?,
        offline_events: load_pending_offline_events(&conn).map_err(|error| error.to_string())?,
        pending_offline_event_count: count_pending_offline_events(&conn)
            .map_err(|error| error.to_string())?,
        unread_local_notification_count: count_unread_local_notifications(&conn)
            .map_err(|error| error.to_string())?,
        central_store_path: state.central_store_root().to_string_lossy().to_string(),
    })
}

pub(super) fn detect_tools(state: &P1LocalState) -> Result<Vec<ToolConfigPayload>, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    super::configuration::refresh_builtin_tool_configs(&conn)?;
    detect_tools_from_conn(&conn).map_err(|error| error.to_string())
}

pub(super) fn list_local_installs(
    state: &P1LocalState,
) -> Result<Vec<LocalSkillInstallPayload>, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    list_local_installs_from_conn(&conn).map_err(|error| error.to_string())
}

pub(super) fn list_local_extensions(
    state: &P1LocalState,
) -> Result<Vec<super::ExtensionInstallPayload>, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    list_extension_installs_from_conn(&conn).map_err(|error| error.to_string())
}
