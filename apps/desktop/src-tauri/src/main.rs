use enterprise_agent_hub_desktop::adapters::{
    builtin_adapters, detect_adapter, expand_windows_user_profile,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct LocalBootstrapPayload {
    tools: Vec<ToolConfigPayload>,
    projects: Vec<ProjectConfigPayload>,
}

#[derive(Debug, Serialize)]
struct ToolConfigPayload {
    #[serde(rename = "toolID")]
    tool_id: String,
    name: String,
    #[serde(rename = "configPath")]
    config_path: String,
    #[serde(rename = "skillsPath")]
    skills_path: String,
    enabled: bool,
    status: String,
    transform: String,
    #[serde(rename = "enabledSkillCount")]
    enabled_skill_count: u32,
}

#[derive(Debug, Serialize)]
struct ProjectConfigPayload {
    #[serde(rename = "projectID")]
    project_id: String,
    name: String,
    #[serde(rename = "projectPath")]
    project_path: String,
    #[serde(rename = "skillsPath")]
    skills_path: String,
    enabled: bool,
    #[serde(rename = "enabledSkillCount")]
    enabled_skill_count: u32,
}

#[tauri::command]
fn get_local_bootstrap() -> Result<LocalBootstrapPayload, String> {
    Ok(LocalBootstrapPayload {
        tools: detect_tools()?,
        projects: Vec::new(),
    })
}

#[tauri::command]
fn detect_tools() -> Result<Vec<ToolConfigPayload>, String> {
    Ok(builtin_adapters()
        .into_iter()
        .map(|adapter| {
            let skills_path = adapter
                .target
                .global_paths
                .first()
                .map(|path| expand_windows_user_profile(path).to_string_lossy().to_string())
                .unwrap_or_default();
            let detection = detect_adapter(&adapter, None);
            ToolConfigPayload {
                tool_id: adapter.tool_id.as_str().to_string(),
                name: adapter.display_name,
                config_path: skills_path.clone(),
                skills_path,
                enabled: adapter.enabled,
                status: detection.status.as_str().to_string(),
                transform: adapter.transform_strategy.as_str().to_string(),
                enabled_skill_count: 0,
            }
        })
        .collect())
}

#[tauri::command]
fn install_skill_package(skill_id: String, version: String) -> Result<serde_json::Value, String> {
    Err(format!(
        "install_skill_package requires a downloaded package directory and ticket metadata for {skill_id}@{version}"
    ))
}

#[tauri::command]
fn update_skill_package(skill_id: String, version: String) -> Result<serde_json::Value, String> {
    Err(format!(
        "update_skill_package requires a downloaded package directory and ticket metadata for {skill_id}@{version}"
    ))
}

#[tauri::command]
fn uninstall_skill(skill_id: String) -> Result<serde_json::Value, String> {
    Err(format!(
        "uninstall_skill requires SQLite-backed enabled target lookup before removing {skill_id}"
    ))
}

#[tauri::command]
fn enable_skill(
    skill_id: String,
    target_type: String,
    target_id: String,
    requested_mode: String,
) -> Result<serde_json::Value, String> {
    Err(format!(
        "enable_skill requires installed Central Store state for {skill_id} -> {target_type}:{target_id} ({requested_mode})"
    ))
}

#[tauri::command]
fn disable_skill(skill_id: String, target_id: String) -> Result<serde_json::Value, String> {
    Err(format!(
        "disable_skill requires managed target state for {skill_id} -> {target_id}"
    ))
}

#[tauri::command]
fn list_local_installs() -> Result<Vec<serde_json::Value>, String> {
    Err("list_local_installs requires the SQLite local state adapter".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_local_bootstrap,
            detect_tools,
            install_skill_package,
            update_skill_package,
            uninstall_skill,
            enable_skill,
            disable_skill,
            list_local_installs
        ])
        .run(tauri::generate_context!())
        .expect("failed to run EnterpriseAgentHub Desktop");
}
