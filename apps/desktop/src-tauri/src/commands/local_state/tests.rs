use super::pathing::{now_millis, resolve_project_adapter};
use super::*;
use crate::store::hash::sha256_hex;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn seed_download_ticket(package_bytes: &[u8], package_url: String) -> DownloadTicketPayload {
    DownloadTicketPayload {
        skill_id: "codex-review-helper".to_string(),
        version: "1.2.0".to_string(),
        package_url,
        package_hash: format!("sha256:{}", sha256_hex(package_bytes)),
        package_size: package_bytes.len() as u64,
        package_file_count: 2,
    }
}

#[test]
fn installs_enables_and_restores_from_sqlite() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state");
    let package_bytes = fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"),
    )
    .expect("read seed package zip");
    let package_url = serve_once(package_bytes.clone());
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
    std::env::set_var(
        "EAH_P1_CODEX_SKILLS_PATH",
        temp.path.join("codex-skills").to_string_lossy().to_string(),
    );
    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "codex".to_string(),
            name: None,
            config_path: "".to_string(),
            skills_path: temp.path.join("codex-skills").to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save codex tool config");

    let installed = state
        .install_skill_package(seed_download_ticket(&package_bytes, package_url))
        .expect("install skill");
    assert_eq!(installed.local_version, "1.2.0");
    assert!(Path::new(&installed.central_store_path)
        .join("SKILL.md")
        .is_file());

    let target = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable skill");
    assert_eq!(target.target_id, "codex");
    assert_eq!(target.resolved_mode, "copy");
    assert!(Path::new(&target.target_path).join("SKILL.md").is_file());

    let restored_state =
        P1LocalState::initialize(temp.path.join("app-data")).expect("reopen state");
    let restored = restored_state
        .list_local_installs()
        .expect("list local installs");
    assert_eq!(restored.len(), 1);
    assert_eq!(restored[0].skill_id, "codex-review-helper");
    assert_eq!(restored[0].enabled_targets.len(), 1);
    assert_eq!(restored[0].enabled_targets[0].target_id, "codex");
    let restored_bootstrap = restored_state
        .get_local_bootstrap()
        .expect("restore bootstrap");
    assert_eq!(restored_bootstrap.offline_events.len(), 1);
    assert_eq!(
        restored_bootstrap.offline_events[0].event_type,
        "enable_result"
    );

    std::env::remove_var("EAH_P1_CODEX_SKILLS_PATH");
}

#[test]
fn persists_projects_disables_targets_and_uninstalls_through_sqlite() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-projects");
    let package_bytes = fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"),
    )
    .expect("read seed package zip");
    let package_url = serve_once(package_bytes.clone());
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
    std::env::set_var(
        "EAH_P1_CODEX_SKILLS_PATH",
        temp.path.join("codex-skills").to_string_lossy().to_string(),
    );
    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "codex".to_string(),
            name: None,
            config_path: "".to_string(),
            skills_path: temp.path.join("codex-skills").to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save codex tool config");

    let project_root = temp.path.join("EnterpriseAgentHub");
    let project = state
        .save_project_config(ProjectConfigInputPayload {
            project_id: Some("enterprise-agent-hub".to_string()),
            name: "Enterprise Agent Hub".to_string(),
            project_path: project_root.to_string_lossy().to_string(),
            skills_path: project_root
                .join(".codex/skills")
                .to_string_lossy()
                .to_string(),
            enabled: Some(true),
        })
        .expect("save project");
    assert_eq!(project.project_id, "enterprise-agent-hub");

    let installed = state
        .install_skill_package(seed_download_ticket(&package_bytes, package_url))
        .expect("install skill");

    let tool_target = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable tool target");
    let project_target = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "project".to_string(),
            "enterprise-agent-hub".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable project target");

    let bootstrap = state.get_local_bootstrap().expect("bootstrap");
    assert_eq!(bootstrap.projects.len(), 1);
    assert_eq!(bootstrap.projects[0].enabled_skill_count, 1);
    assert_eq!(bootstrap.pending_offline_event_count, 2);
    assert_eq!(bootstrap.offline_events.len(), 2);
    assert!(Path::new(&project_target.target_path)
        .join("SKILL.md")
        .is_file());

    let disabled = state
        .disable_skill(
            "codex-review-helper".to_string(),
            "project".to_string(),
            "enterprise-agent-hub".to_string(),
        )
        .expect("disable project target");
    assert_eq!(disabled.event.event_type, "disable_result");
    assert!(!Path::new(&project_target.target_path).exists());
    assert!(Path::new(&installed.central_store_path)
        .join("SKILL.md")
        .is_file());

    let reopened = P1LocalState::initialize(temp.path.join("app-data")).expect("reopen state");
    let reopened_bootstrap = reopened.get_local_bootstrap().expect("reopen bootstrap");
    assert_eq!(reopened_bootstrap.projects[0].enabled_skill_count, 0);
    assert!(reopened_bootstrap
        .offline_events
        .iter()
        .any(|event| event.event_type == "disable_result"));

    let uninstall = reopened
        .uninstall_skill("codex-review-helper".to_string())
        .expect("uninstall skill");
    assert!(uninstall
        .removed_target_ids
        .contains(&tool_target.target_id));
    assert!(uninstall.failed_target_ids.is_empty());
    assert!(!Path::new(&installed.central_store_path).exists());

    let after_uninstall = reopened
        .get_local_bootstrap()
        .expect("bootstrap after uninstall");
    assert!(after_uninstall.installs.is_empty());
    assert!(after_uninstall
        .offline_events
        .iter()
        .any(|event| event.event_type == "uninstall_result"));

    std::env::remove_var("EAH_P1_CODEX_SKILLS_PATH");
}

#[test]
fn marks_offline_events_synced_and_excludes_them_from_restore() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-sync");
    let package_bytes = fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"),
    )
    .expect("read seed package zip");
    let package_url = serve_once(package_bytes.clone());
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
    std::env::set_var(
        "EAH_P1_CODEX_SKILLS_PATH",
        temp.path.join("codex-skills").to_string_lossy().to_string(),
    );
    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "codex".to_string(),
            name: None,
            config_path: "".to_string(),
            skills_path: temp.path.join("codex-skills").to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save codex tool config");

    state
        .install_skill_package(seed_download_ticket(&package_bytes, package_url))
        .expect("install skill");
    state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable target");

    let bootstrap = state.get_local_bootstrap().expect("bootstrap before sync");
    let event_ids = bootstrap
        .offline_events
        .iter()
        .map(|event| event.event_id.clone())
        .collect::<Vec<_>>();
    assert_eq!(event_ids.len(), 1);

    let ack = state
        .mark_offline_events_synced(event_ids.clone())
        .expect("mark synced");
    assert_eq!(ack.synced_event_ids, event_ids);

    let restored = state.get_local_bootstrap().expect("bootstrap after sync");
    assert!(restored.offline_events.is_empty());
    assert_eq!(restored.pending_offline_event_count, 0);

    std::env::remove_var("EAH_P1_CODEX_SKILLS_PATH");
}

#[test]
fn saves_manual_tool_config_and_restores_it_from_bootstrap() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-tool-config");
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");

    let saved = state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "custom_directory".to_string(),
            name: Some("团队共享目录".to_string()),
            config_path: "手动维护".to_string(),
            skills_path: temp
                .path
                .join("shared-skills")
                .to_string_lossy()
                .to_string(),
            enabled: Some(true),
        })
        .expect("save tool config");

    assert_eq!(saved.tool_id, "custom_directory");
    assert_eq!(saved.display_name, "团队共享目录");
    assert_eq!(saved.adapter_status, "manual");
    assert_eq!(saved.detection_method, "manual");

    let restored = state.get_local_bootstrap().expect("bootstrap");
    let restored_tool = restored
        .tools
        .iter()
        .find(|tool| tool.tool_id == "custom_directory")
        .expect("restored tool");
    assert_eq!(restored_tool.display_name, "团队共享目录");
    assert_eq!(
        restored_tool.skills_path,
        temp.path
            .join("shared-skills")
            .to_string_lossy()
            .to_string()
    );
}

#[test]
fn keeps_manual_tool_paths_after_detection_refresh() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-tool-refresh");
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
    let manual_path = temp.path.join("cursor-rules");
    fs::create_dir_all(&manual_path).expect("create manual path");

    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "cursor".to_string(),
            name: None,
            config_path: temp.join_str("cursor-config.json"),
            skills_path: manual_path.to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save cursor tool config");

    let detected = state.detect_tools().expect("refresh tool detection");
    let cursor = detected
        .iter()
        .find(|tool| tool.tool_id == "cursor")
        .expect("cursor tool");
    assert_eq!(cursor.adapter_status, "manual");
    assert_eq!(cursor.detection_method, "manual");
    assert_eq!(
        cursor.skills_path,
        manual_path.to_string_lossy().to_string()
    );
    assert_eq!(cursor.config_path, temp.join_str("cursor-config.json"));
}

#[test]
fn derives_macos_project_suffix_when_skills_path_is_empty() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let previous_platform = std::env::var("EAH_P1_PLATFORM").ok();
    std::env::set_var("EAH_P1_PLATFORM", "macos");
    let temp = TestTemp::new("local-state-project-suffix-macos");
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
    let project_root = temp.path.join("workspace/EnterpriseAgentHub");

    let saved = state
        .save_project_config(ProjectConfigInputPayload {
            project_id: Some("enterprise-agent-hub".to_string()),
            name: "Enterprise Agent Hub".to_string(),
            project_path: project_root.to_string_lossy().to_string(),
            skills_path: "".to_string(),
            enabled: Some(true),
        })
        .expect("save project");

    assert_eq!(
        saved.skills_path,
        project_root
            .join(".codex/skills")
            .to_string_lossy()
            .to_string()
    );
    assert_eq!(
        resolve_project_adapter(&saved.skills_path)
            .expect("resolve project adapter")
            .tool_id,
        crate::commands::distribution::adapters::AdapterID::Codex
    );

    if let Some(value) = previous_platform {
        std::env::set_var("EAH_P1_PLATFORM", value);
    } else {
        std::env::remove_var("EAH_P1_PLATFORM");
    }
}

#[test]
fn custom_directory_requires_manual_path_before_enable() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-custom-directory");
    let package_bytes = fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"),
    )
    .expect("read seed package zip");
    let package_url = serve_once(package_bytes.clone());
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");

    state
        .install_skill_package(seed_download_ticket(&package_bytes, package_url))
        .expect("install skill");

    let error = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "custom_directory".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect_err("custom directory should require a configured path");

    assert!(error.contains("configured skills path"));
}

#[test]
fn scans_local_targets_and_requires_explicit_overwrite() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-scan");
    let package_bytes = fs::read(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"),
    )
    .expect("read seed package zip");
    let package_url = serve_once(package_bytes.clone());
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");

    state
        .save_tool_config(ToolConfigInputPayload {
            tool_id: "codex".to_string(),
            name: None,
            config_path: "".to_string(),
            skills_path: temp.path.join("codex-skills").to_string_lossy().to_string(),
            enabled: Some(true),
        })
        .expect("save codex tool config");

    state
        .install_skill_package(seed_download_ticket(&package_bytes, package_url))
        .expect("install skill");

    let target = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            None,
        )
        .expect("enable target");
    assert!(Path::new(&target.target_path).join("SKILL.md").is_file());

    fs::create_dir_all(temp.path.join("codex-skills/manual-skill"))
        .expect("create unmanaged directory");

    let scan = state.scan_local_targets().expect("scan local targets");
    let codex_scan = scan
        .iter()
        .find(|summary| summary.target_type == "tool" && summary.target_id == "codex")
        .expect("codex scan");
    assert_eq!(codex_scan.counts.managed, 1);
    assert_eq!(codex_scan.counts.unmanaged, 1);

    let conflict = state.enable_skill(
        "codex-review-helper".to_string(),
        "1.2.0".to_string(),
        "tool".to_string(),
        "codex".to_string(),
        Some("copy".to_string()),
        None,
    );
    assert!(conflict.is_err());

    let overwrite = state
        .enable_skill(
            "codex-review-helper".to_string(),
            "1.2.0".to_string(),
            "tool".to_string(),
            "codex".to_string(),
            Some("copy".to_string()),
            Some(true),
        )
        .expect("overwrite target");
    assert_eq!(overwrite.target_id, "codex");
}

#[test]
fn caches_local_notifications_and_marks_them_read() {
    let _lock = ENV_LOCK.lock().expect("lock env");
    let temp = TestTemp::new("local-state-notifications");
    let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");

    state
        .upsert_local_notifications(vec![
            LocalNotificationPayload {
                notification_id: "srv_001".to_string(),
                notification_type: "connection_failed".to_string(),
                title: "服务连接失败".to_string(),
                summary: "当前展示为缓存通知。".to_string(),
                related_skill_id: None,
                target_page: "notifications".to_string(),
                occurred_at: "2026-04-13T00:00:00.000Z".to_string(),
                unread: true,
                source: "server".to_string(),
            },
            LocalNotificationPayload {
                notification_id: "local_001".to_string(),
                notification_type: "enable_result".to_string(),
                title: "启用完成".to_string(),
                summary: "Skill 已启用到 Codex".to_string(),
                related_skill_id: Some("codex-review-helper".to_string()),
                target_page: "tools".to_string(),
                occurred_at: "2026-04-13T01:00:00.000Z".to_string(),
                unread: false,
                source: "local".to_string(),
            },
        ])
        .expect("cache notifications");

    let bootstrap = state.get_local_bootstrap().expect("bootstrap");
    assert_eq!(bootstrap.notifications.len(), 2);
    assert_eq!(bootstrap.notifications[0].notification_id, "local_001");
    assert_eq!(bootstrap.notifications[0].source, "local");
    assert_eq!(bootstrap.notifications[1].notification_id, "srv_001");
    assert_eq!(bootstrap.unread_local_notification_count, 1);

    state
        .mark_local_notifications_read(vec!["srv_001".to_string()], false)
        .expect("mark one notification read");

    let after_single = state
        .get_local_bootstrap()
        .expect("bootstrap after single read");
    assert_eq!(after_single.unread_local_notification_count, 0);

    state
        .mark_local_notifications_read(Vec::new(), true)
        .expect("mark all notifications read");

    let after_all = state
        .get_local_bootstrap()
        .expect("bootstrap after mark all");
    assert!(after_all
        .notifications
        .iter()
        .all(|notification| !notification.unread));
}

fn serve_once(body: Vec<u8>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind package server");
    let addr = listener.local_addr().expect("package server addr");
    thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept package request");
        let mut request = [0_u8; 1024];
        let _ = stream.read(&mut request);
        write!(
            stream,
            "HTTP/1.1 200 OK\r\ncontent-type: application/zip\r\ncontent-length: {}\r\n\r\n",
            body.len()
        )
        .expect("write response headers");
        stream.write_all(&body).expect("write response body");
    });
    format!("http://{addr}/package.zip")
}

struct TestTemp {
    path: PathBuf,
}

impl TestTemp {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(format!("eah-{name}-{}", now_millis()));
        fs::create_dir_all(&path).unwrap();
        Self { path }
    }

    fn join_str(&self, relative: &str) -> String {
        self.path.join(relative).to_string_lossy().to_string()
    }
}
