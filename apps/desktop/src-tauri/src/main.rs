use enterprise_agent_hub_desktop::commands::local_state::{
    DisableSkillPayload, DownloadTicketPayload, EnabledTargetPayload, LocalBootstrapPayload,
    LocalSkillInstallPayload, OfflineSyncAckPayload, P1LocalState, ProjectConfigInputPayload,
    ProjectConfigPayload, ToolConfigPayload, UninstallSkillPayload,
};
use serde_json::json;
use tauri::{Manager, State};

#[tauri::command]
fn get_local_bootstrap(
    state: State<'_, P1LocalState>,
) -> Result<LocalBootstrapPayload, String> {
    state.get_local_bootstrap()
}

#[tauri::command]
fn detect_tools(state: State<'_, P1LocalState>) -> Result<Vec<ToolConfigPayload>, String> {
    state.detect_tools()
}

#[allow(non_snake_case)]
#[tauri::command]
fn install_skill_package(
    state: State<'_, P1LocalState>,
    downloadTicket: DownloadTicketPayload,
) -> Result<LocalSkillInstallPayload, String> {
    state.install_skill_package(downloadTicket)
}

#[allow(non_snake_case)]
#[tauri::command]
fn update_skill_package(
    state: State<'_, P1LocalState>,
    downloadTicket: DownloadTicketPayload,
) -> Result<LocalSkillInstallPayload, String> {
    state.update_skill_package(downloadTicket)
}

#[allow(non_snake_case)]
#[tauri::command]
fn enable_skill(
    state: State<'_, P1LocalState>,
    skillID: String,
    version: String,
    targetType: String,
    targetID: String,
    preferredMode: Option<String>,
    requestedMode: Option<String>,
) -> Result<EnabledTargetPayload, String> {
    state.enable_skill(
        skillID,
        version,
        targetType,
        targetID,
        preferredMode.or(requestedMode),
    )
}

#[allow(non_snake_case)]
#[tauri::command]
fn save_project_config(
    state: State<'_, P1LocalState>,
    project: ProjectConfigInputPayload,
) -> Result<ProjectConfigPayload, String> {
    state.save_project_config(project)
}

#[allow(non_snake_case)]
#[tauri::command]
fn uninstall_skill(
    state: State<'_, P1LocalState>,
    skillID: String,
) -> Result<UninstallSkillPayload, String> {
    state.uninstall_skill(skillID)
}

#[allow(non_snake_case)]
#[tauri::command]
fn disable_skill(
    state: State<'_, P1LocalState>,
    skillID: String,
    targetType: String,
    targetID: String,
) -> Result<DisableSkillPayload, String> {
    state.disable_skill(skillID, targetType, targetID)
}

#[allow(non_snake_case)]
#[tauri::command]
fn mark_offline_events_synced(
    state: State<'_, P1LocalState>,
    eventIDs: Vec<String>,
) -> Result<OfflineSyncAckPayload, String> {
    state.mark_offline_events_synced(eventIDs)
}

#[tauri::command]
fn list_local_installs(
    state: State<'_, P1LocalState>,
) -> Result<Vec<LocalSkillInstallPayload>, String> {
    state.list_local_installs()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state = P1LocalState::initialize(app_data_dir).map_err(|message| {
                std::io::Error::new(std::io::ErrorKind::Other, message)
            })?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_bootstrap,
            detect_tools,
            install_skill_package,
            update_skill_package,
            save_project_config,
            uninstall_skill,
            enable_skill,
            disable_skill,
            mark_offline_events_synced,
            list_local_installs
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| panic!("failed to run EnterpriseAgentHub Desktop: {}", json!(error.to_string())));
}
