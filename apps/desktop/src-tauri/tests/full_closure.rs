use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use enterprise_agent_hub_desktop::commands::local_state::{
    DownloadTicketPayload, P1LocalState, ProjectConfigInputPayload, ToolConfigInputPayload,
};
use reqwest::blocking::Client;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct FullClosureArtifact {
    #[serde(rename = "apiBaseURL")]
    api_base_url: String,
    #[serde(rename = "skillID")]
    skill_id: String,
    version: String,
    author: Credentials,
}

#[derive(Debug, Deserialize)]
struct Credentials {
    #[serde(rename = "phoneNumber")]
    phone_number: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct LoginResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
}

#[derive(Debug, Deserialize)]
struct DownloadTicketResponse {
    #[serde(rename = "skillID")]
    skill_id: String,
    version: String,
    #[serde(rename = "packageURL")]
    package_url: String,
    #[serde(rename = "packageHash")]
    package_hash: String,
    #[serde(rename = "packageSize")]
    package_size: u64,
    #[serde(rename = "packageFileCount")]
    package_file_count: usize,
}

#[test]
fn installs_enables_restarts_and_uninstalls_the_same_published_skill() {
    let Ok(artifact_path) = std::env::var("EAH_FULL_CLOSURE_ARTIFACT") else {
        eprintln!("skipping full_closure.rs because EAH_FULL_CLOSURE_ARTIFACT is not set");
        return;
    };
    let artifact: FullClosureArtifact =
        serde_json::from_slice(&fs::read(&artifact_path).expect("read full closure artifact"))
            .expect("parse full closure artifact");

    let client = Client::new();
    let access_token = login(&client, &artifact);
    let ticket = download_ticket(&client, &artifact, &access_token);

    let root = temp_root("full-closure");
    let app_data = root.join("app-data");
    let state = P1LocalState::initialize(&app_data).expect("init local state");
    let codex_path = root.join("codex-skills");
    let project_root = root.join("workspace").join("EnterpriseAgentHub");
    let project_skills = project_root.join(".codex/skills");

    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "codex".to_string(),
            name: None,
            config_path: "".to_string(),
            skills_path: codex_path.to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save codex config");
    state
        .save_project_config(ProjectConfigInputPayload {
            project_id: Some("enterprise-agent-hub".to_string()),
            name: "Enterprise Agent Hub".to_string(),
            project_path: project_root.to_string_lossy().to_string(),
            skills_path: project_skills.to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save project config");

    let installed = state
        .install_skill_package(ticket.clone())
        .expect("install published skill");
    assert_eq!(installed.skill_id, artifact.skill_id);
    assert_eq!(installed.local_version, artifact.version);
    assert_eq!(installed.source_package_hash, ticket.package_hash);
    assert_ne!(installed.local_hash, installed.source_package_hash);

    let tool_target = state
        .enable_skill(
            artifact.skill_id.clone(),
            artifact.version.clone(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable tool target");
    assert_eq!(tool_target.requested_mode, "copy");
    assert_eq!(tool_target.resolved_mode, "copy");
    assert!(tool_target.fallback_reason.is_none());

    let project_target = state
        .enable_skill(
            artifact.skill_id.clone(),
            artifact.version.clone(),
            "project".to_string(),
            "enterprise-agent-hub".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable project target");
    assert_eq!(project_target.requested_mode, "copy");
    assert_eq!(project_target.resolved_mode, "copy");
    assert!(project_target.fallback_reason.is_none());

    let reopened = P1LocalState::initialize(&app_data).expect("reopen local state");
    let installs = reopened.list_local_installs().expect("list installs");
    assert_eq!(installs.len(), 1);
    assert_eq!(installs[0].enabled_targets.len(), 2);
    let bootstrap = reopened.get_local_bootstrap().expect("bootstrap");
    assert_eq!(bootstrap.installs.len(), 1);
    assert_eq!(bootstrap.installs[0].skill_id, artifact.skill_id);

    reopened
        .disable_skill(
            artifact.skill_id.clone(),
            "project".to_string(),
            "enterprise-agent-hub".to_string(),
        )
        .expect("disable project target");

    let uninstall = reopened
        .uninstall_skill(artifact.skill_id.clone())
        .expect("uninstall skill");
    assert!(uninstall.failed_target_ids.is_empty());
    assert!(!uninstall.removed_target_ids.is_empty());
    let after_uninstall = reopened
        .get_local_bootstrap()
        .expect("bootstrap after uninstall");
    assert!(after_uninstall.installs.is_empty());

    let _ = fs::remove_dir_all(root);
}

fn login(client: &Client, artifact: &FullClosureArtifact) -> String {
    let response = client
        .post(format!("{}/auth/login", artifact.api_base_url))
        .header("content-type", "application/json")
        .body(
            serde_json::json!({
                "phoneNumber": artifact.author.phone_number,
                "password": artifact.author.password,
            })
            .to_string(),
        )
        .send()
        .expect("login request")
        .error_for_status()
        .expect("login success");
    serde_json::from_str::<LoginResponse>(&response.text().expect("login body"))
        .expect("login response")
        .access_token
}

fn download_ticket(
    client: &Client,
    artifact: &FullClosureArtifact,
    access_token: &str,
) -> DownloadTicketPayload {
    let response = client
        .post(format!(
            "{}/skills/{}/download-ticket",
            artifact.api_base_url, artifact.skill_id
        ))
        .bearer_auth(access_token)
        .header("content-type", "application/json")
        .body(
            serde_json::json!({
                "purpose": "install",
                "targetVersion": artifact.version,
                "localVersion": serde_json::Value::Null,
            })
            .to_string(),
        )
        .send()
        .expect("download ticket request")
        .error_for_status()
        .expect("download ticket success");
    let response = serde_json::from_str::<DownloadTicketResponse>(
        &response.text().expect("download ticket body"),
    )
    .expect("download ticket response");

    DownloadTicketPayload {
        skill_id: response.skill_id,
        version: response.version,
        package_url: absolutize_url(&artifact.api_base_url, &response.package_url),
        package_hash: response.package_hash,
        package_size: response.package_size,
        package_file_count: response.package_file_count,
    }
}

fn absolutize_url(base_url: &str, path_or_url: &str) -> String {
    if path_or_url.starts_with("http://") || path_or_url.starts_with("https://") {
        path_or_url.to_string()
    } else {
        format!("{}{}", base_url.trim_end_matches('/'), path_or_url)
    }
}

fn temp_root(prefix: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "eah-{}-{}",
        prefix,
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or_default()
    ))
}
