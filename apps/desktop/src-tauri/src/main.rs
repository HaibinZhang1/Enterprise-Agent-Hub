use enterprise_agent_hub_desktop::commands::local_state::{
    DisableSkillPayload, DownloadTicketPayload, EnabledTargetPayload, LocalBootstrapPayload,
    LocalNotificationPayload, LocalSkillInstallPayload, OfflineSyncAckPayload, P1LocalState,
    ProjectConfigInputPayload, ProjectConfigPayload,
    ScanTargetSummaryPayload, ToolConfigInputPayload, ToolConfigPayload,
    UninstallSkillPayload, ValidateTargetPathPayload,
};
use enterprise_agent_hub_desktop::commands::project_directory::{
    pick_project_directory as pick_project_directory_command, ProjectDirectorySelectionPayload,
};
use serde_json::json;
use tauri::{Manager, State};

#[tauri::command]
fn get_local_bootstrap(state: State<'_, P1LocalState>) -> Result<LocalBootstrapPayload, String> {
    state.get_local_bootstrap()
}

#[tauri::command]
fn detect_tools(state: State<'_, P1LocalState>) -> Result<Vec<ToolConfigPayload>, String> {
    state.detect_tools()
}

#[allow(non_snake_case)]
#[tauri::command]
fn save_tool_config(
    state: State<'_, P1LocalState>,
    tool: ToolConfigInputPayload,
) -> Result<ToolConfigPayload, String> {
    state.save_tool_config(tool)
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
    allowOverwrite: Option<bool>,
) -> Result<EnabledTargetPayload, String> {
    state.enable_skill(
        skillID,
        version,
        targetType,
        targetID,
        preferredMode.or(requestedMode),
        allowOverwrite,
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

#[allow(non_snake_case)]
#[tauri::command]
fn upsert_local_notifications(
    state: State<'_, P1LocalState>,
    notifications: Vec<LocalNotificationPayload>,
) -> Result<(), String> {
    state.upsert_local_notifications(notifications)
}

#[allow(non_snake_case)]
#[tauri::command]
fn mark_local_notifications_read(
    state: State<'_, P1LocalState>,
    notificationIDs: Vec<String>,
    all: bool,
) -> Result<(), String> {
    state.mark_local_notifications_read(notificationIDs, all)
}

#[allow(non_snake_case)]
#[tauri::command]
fn validate_target_path(
    state: State<'_, P1LocalState>,
    targetPath: String,
) -> Result<ValidateTargetPathPayload, String> {
    state.validate_target_path(targetPath)
}

#[tauri::command]
fn scan_local_targets(
    state: State<'_, P1LocalState>,
) -> Result<Vec<ScanTargetSummaryPayload>, String> {
    state.scan_local_targets()
}

#[tauri::command]
fn list_local_installs(
    state: State<'_, P1LocalState>,
) -> Result<Vec<LocalSkillInstallPayload>, String> {
    state.list_local_installs()
}

#[tauri::command]
fn pick_project_directory() -> Result<Option<ProjectDirectorySelectionPayload>, String> {
    pick_project_directory_command()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state = P1LocalState::initialize(app_data_dir)
                .map_err(|message| std::io::Error::new(std::io::ErrorKind::Other, message))?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_bootstrap,
            detect_tools,
            save_tool_config,
            install_skill_package,
            update_skill_package,
            save_project_config,
            uninstall_skill,
            enable_skill,
            disable_skill,
            upsert_local_notifications,
            mark_local_notifications_read,
            mark_offline_events_synced,
            validate_target_path,
            scan_local_targets,
            list_local_installs,
            pick_project_directory
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| {
            panic!(
                "failed to run EnterpriseAgentHub Desktop: {}",
                json!(error.to_string())
            )
        });
}
