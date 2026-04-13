use std::fs;
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::blocking::Client;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use zip::ZipArchive;

#[cfg(not(test))]
use crate::adapters::{
    builtin_adapters, detect_adapter, expand_windows_user_profile, AdapterConfig, AdapterID,
    InstallMode as AdapterInstallMode,
};
#[cfg(test)]
use crate::commands::distribution::adapters::{
    builtin_adapters, detect_adapter, expand_windows_user_profile, AdapterConfig, AdapterID,
    InstallMode as AdapterInstallMode,
};
use crate::commands::distribution::{enable_distribution, EnableDistributionRequest};
use crate::commands::distribution::{disable_distribution, DisableDistributionRequest};
use crate::store::central_store::{default_central_store_root, ensure_central_store_root};
use crate::store::commands::{
    install_skill_package as store_install_skill_package,
    uninstall_skill as store_uninstall_skill,
    update_skill_package as store_update_skill_package, InstallSkillPackageRequest,
    UninstallSkillRequest, UpdateSkillPackageRequest,
};
use crate::store::models::{EnabledTarget, EnabledTargetStatus, InstallMode, LocalSkillInstall, TargetType};
use crate::store::sqlite::{ordered_migrations, statements};

#[derive(Debug, Clone)]
pub struct P1LocalState {
    central_store_root: PathBuf,
    db_path: PathBuf,
    http: Client,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DownloadTicketPayload {
    #[serde(rename = "skillID")]
    pub skill_id: String,
    pub version: String,
    #[serde(rename = "packageURL")]
    pub package_url: String,
    #[serde(rename = "packageHash")]
    pub package_hash: String,
    #[serde(rename = "packageSize")]
    pub package_size: u64,
    #[serde(rename = "packageFileCount")]
    pub package_file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalBootstrapPayload {
    pub installs: Vec<LocalSkillInstallPayload>,
    pub tools: Vec<ToolConfigPayload>,
    pub projects: Vec<ProjectConfigPayload>,
    pub offline_events: Vec<LocalEventPayload>,
    pub pending_offline_event_count: u32,
    pub unread_local_notification_count: u32,
    pub central_store_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfigPayload {
    #[serde(rename = "toolID")]
    pub tool_id: String,
    pub name: String,
    pub display_name: String,
    pub config_path: String,
    pub skills_path: String,
    pub enabled: bool,
    pub status: String,
    pub adapter_status: String,
    pub transform: String,
    pub transform_strategy: String,
    pub enabled_skill_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfigPayload {
    #[serde(rename = "projectID")]
    pub project_id: String,
    pub name: String,
    pub display_name: String,
    pub project_path: String,
    pub skills_path: String,
    pub enabled: bool,
    pub enabled_skill_count: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfigInputPayload {
    #[serde(rename = "projectID")]
    pub project_id: Option<String>,
    pub name: String,
    pub project_path: String,
    pub skills_path: String,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSkillInstallPayload {
    #[serde(rename = "skillID")]
    pub skill_id: String,
    pub display_name: String,
    pub local_version: String,
    pub local_hash: String,
    pub source_package_hash: String,
    pub installed_at: String,
    pub updated_at: String,
    pub local_status: String,
    pub central_store_path: String,
    pub enabled_targets: Vec<EnabledTargetPayload>,
    pub has_update: bool,
    pub is_scope_restricted: bool,
    pub can_update: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnabledTargetPayload {
    pub id: String,
    #[serde(rename = "skillID")]
    pub skill_id: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_name: String,
    pub target_path: String,
    pub artifact_path: String,
    pub install_mode: String,
    pub requested_mode: String,
    pub resolved_mode: String,
    pub fallback_reason: Option<String>,
    pub artifact_hash: String,
    pub enabled_at: String,
    pub updated_at: String,
    pub status: String,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEventPayload {
    #[serde(rename = "eventID")]
    pub event_id: String,
    pub event_type: String,
    #[serde(rename = "skillID")]
    pub skill_id: String,
    pub version: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_path: String,
    pub requested_mode: String,
    pub resolved_mode: String,
    pub fallback_reason: Option<String>,
    pub occurred_at: String,
    pub result: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisableSkillPayload {
    pub event: LocalEventPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallSkillPayload {
    pub removed_target_ids: Vec<String>,
    pub failed_target_ids: Vec<String>,
    pub event: LocalEventPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineSyncAckPayload {
    pub synced_event_ids: Vec<String>,
}

impl P1LocalState {
    pub fn initialize(app_data_dir: impl AsRef<Path>) -> Result<Self, String> {
        let app_data_dir = app_data_dir.as_ref().to_path_buf();
        fs::create_dir_all(&app_data_dir).map_err(|error| {
            format!("create app data dir {}: {error}", app_data_dir.display())
        })?;
        let central_store_root = ensure_central_store_root(default_central_store_root(&app_data_dir))
            .map_err(|error| error.to_string())?;
        let db_dir = app_data_dir.join("EnterpriseAgentHub");
        fs::create_dir_all(&db_dir)
            .map_err(|error| format!("create local db dir {}: {error}", db_dir.display()))?;
        let db_path = db_dir.join("skills.db");
        let state = Self {
            central_store_root,
            db_path,
            http: Client::new(),
        };
        let conn = state.open_connection().map_err(|error| error.to_string())?;
        state
            .set_store_metadata(&conn)
            .map_err(|error| error.to_string())?;
        Ok(state)
    }

    pub fn central_store_root(&self) -> &Path {
        &self.central_store_root
    }

    pub fn get_local_bootstrap(&self) -> Result<LocalBootstrapPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        Ok(LocalBootstrapPayload {
            installs: self
                .list_local_installs_from_conn(&conn)
                .map_err(|error| error.to_string())?,
            tools: self.detect_tools_from_conn(&conn).map_err(|error| error.to_string())?,
            projects: self
                .list_project_configs_from_conn(&conn)
                .map_err(|error| error.to_string())?,
            offline_events: load_pending_offline_events(&conn).map_err(|error| error.to_string())?,
            pending_offline_event_count: count_pending_offline_events(&conn)
                .map_err(|error| error.to_string())?,
            unread_local_notification_count: count_unread_local_notifications(&conn)
                .map_err(|error| error.to_string())?,
            central_store_path: self.central_store_root.to_string_lossy().to_string(),
        })
    }

    pub fn detect_tools(&self) -> Result<Vec<ToolConfigPayload>, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        self.detect_tools_from_conn(&conn)
            .map_err(|error| error.to_string())
    }

    pub fn install_skill_package(
        &self,
        download_ticket: DownloadTicketPayload,
    ) -> Result<LocalSkillInstallPayload, String> {
        let package_dir = self.download_and_extract_package(&download_ticket)?;
        let timestamp = now_iso();
        let install = store_install_skill_package(InstallSkillPackageRequest {
            skill_id: download_ticket.skill_id.clone(),
            display_name: download_ticket.skill_id.clone(),
            version: download_ticket.version.clone(),
            downloaded_package_dir: package_dir.clone(),
            central_store_root: self.central_store_root.clone(),
            expected_package_hash: Some(download_ticket.package_hash.clone()),
            installed_at: timestamp.clone(),
        })
        .map_err(|error| error.to_string())?;
        let _ = fs::remove_dir_all(&package_dir);

        let conn = self.open_connection().map_err(|error| error.to_string())?;
        upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;
        self.local_install_payload(&conn, install)
            .map_err(|error| error.to_string())
    }

    pub fn update_skill_package(
        &self,
        download_ticket: DownloadTicketPayload,
    ) -> Result<LocalSkillInstallPayload, String> {
        let package_dir = self.download_and_extract_package(&download_ticket)?;
        let timestamp = now_iso();
        let install = store_update_skill_package(UpdateSkillPackageRequest {
            skill_id: download_ticket.skill_id.clone(),
            display_name: download_ticket.skill_id.clone(),
            version: download_ticket.version.clone(),
            downloaded_package_dir: package_dir.clone(),
            central_store_root: self.central_store_root.clone(),
            expected_package_hash: Some(download_ticket.package_hash.clone()),
            updated_at: timestamp.clone(),
        })
        .map_err(|error| error.to_string())?;
        let _ = fs::remove_dir_all(&package_dir);

        let conn = self.open_connection().map_err(|error| error.to_string())?;
        upsert_local_install(&conn, &install).map_err(|error| error.to_string())?;
        self.local_install_payload(&conn, install)
            .map_err(|error| error.to_string())
    }

    pub fn list_local_installs(&self) -> Result<Vec<LocalSkillInstallPayload>, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        self.list_local_installs_from_conn(&conn)
            .map_err(|error| error.to_string())
    }

    pub fn save_project_config(
        &self,
        input: ProjectConfigInputPayload,
    ) -> Result<ProjectConfigPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        let project_path = normalize_project_path(&input.project_path)?;
        let skills_path = if input.skills_path.trim().is_empty() {
            project_path.join(default_project_skills_suffix())
        } else {
            normalize_project_path(&input.skills_path)?
        };
        let project_id = input
            .project_id
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| derive_project_id(&input.name, &project_path));
        let timestamp = now_iso();
        conn.execute(
            "
            INSERT INTO project_configs (
              project_id, display_name, project_path, skills_path, enabled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
              display_name = excluded.display_name,
              project_path = excluded.project_path,
              skills_path = excluded.skills_path,
              enabled = excluded.enabled,
              updated_at = excluded.updated_at
            ",
            params![
                &project_id,
                &input.name,
                project_path.to_string_lossy().to_string(),
                skills_path.to_string_lossy().to_string(),
                bool_to_int(input.enabled.unwrap_or(true)),
                &timestamp,
                &timestamp,
            ],
        )
        .map_err(|error| error.to_string())?;
        load_project_config(&conn, &project_id).map_err(|error| error.to_string())
    }

    pub fn mark_offline_events_synced(
        &self,
        event_ids: Vec<String>,
    ) -> Result<OfflineSyncAckPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        let synced_at = now_iso();
        for event_id in &event_ids {
            conn.execute(
                statements::MARK_OFFLINE_EVENT_SYNCED,
                params![synced_at, event_id],
            )
            .map_err(|error| error.to_string())?;
        }
        Ok(OfflineSyncAckPayload {
            synced_event_ids: event_ids,
        })
    }

    pub fn enable_skill(
        &self,
        skill_id: String,
        version: String,
        target_type: String,
        target_id: String,
        preferred_mode: Option<String>,
    ) -> Result<EnabledTargetPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
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
        let artifact_path = self
            .central_store_root
            .join("derived")
            .join(&skill_id)
            .join(&installed_version)
            .join(adapter.transform_strategy.as_str());
        let response = enable_distribution(EnableDistributionRequest {
            skill_id: skill_id.clone(),
            version: installed_version.clone(),
            adapter_id: adapter.tool_id,
            central_store_skill_path: PathBuf::from(&install.central_store_path),
            derived_root: self.central_store_root.join("derived"),
            target_root,
            requested_mode,
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
            artifact_path: artifact_path.to_string_lossy().to_string(),
            install_mode: response.resolved_mode.as_str().to_string(),
            requested_mode: response.requested_mode.as_str().to_string(),
            resolved_mode: response.resolved_mode.as_str().to_string(),
            fallback_reason: response.fallback_reason.clone(),
            artifact_hash: install.local_hash.clone(),
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

        Ok(target)
    }

    pub fn disable_skill(
        &self,
        skill_id: String,
        target_type: String,
        target_id: String,
    ) -> Result<DisableSkillPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        let install = load_install_row(&conn, &skill_id).map_err(|error| error.to_string())?;
        let target = load_enabled_target(&conn, &skill_id, &target_type, &target_id)
            .map_err(|error| error.to_string())?;

        disable_distribution(DisableDistributionRequest {
            managed_target_path: PathBuf::from(&target.target_path),
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
        insert_offline_event(&conn, event.clone()).map_err(|error| error.to_string())?;

        Ok(DisableSkillPayload { event })
    }

    pub fn uninstall_skill(&self, skill_id: String) -> Result<UninstallSkillPayload, String> {
        let conn = self.open_connection().map_err(|error| error.to_string())?;
        let install = load_install_row(&conn, &skill_id).map_err(|error| error.to_string())?;
        let enabled_targets = load_all_enabled_targets(&conn, &skill_id).map_err(|error| error.to_string())?;
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
            central_store_root: self.central_store_root.clone(),
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

    fn open_connection(&self) -> rusqlite::Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        for (_, sql) in ordered_migrations() {
            conn.execute_batch(sql)?;
        }
        Ok(conn)
    }

    fn set_store_metadata(&self, conn: &Connection) -> rusqlite::Result<()> {
        conn.execute(
            statements::SET_STORE_METADATA,
            params![
                "central_store_path",
                self.central_store_root.to_string_lossy().to_string(),
                now_iso()
            ],
        )?;
        Ok(())
    }

    fn download_and_extract_package(
        &self,
        ticket: &DownloadTicketPayload,
    ) -> Result<PathBuf, String> {
        let downloads_root = self.central_store_root.join("downloads");
        fs::create_dir_all(&downloads_root)
            .map_err(|error| format!("create downloads root: {error}"))?;
        let response = self
            .http
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

    fn detect_tools_from_conn(&self, conn: &Connection) -> rusqlite::Result<Vec<ToolConfigPayload>> {
        let mut tools = Vec::new();
        for adapter in builtin_adapters() {
            let skills_path = adapter
                .target
                .global_paths
                .first()
                .map(|path| expand_windows_user_profile(path).to_string_lossy().to_string())
                .unwrap_or_default();
            let detection = detect_adapter(&adapter, None);
            let enabled_skill_count = count_enabled_targets_for_tool(conn, adapter.tool_id.as_str())?;
            tools.push(ToolConfigPayload {
                tool_id: adapter.tool_id.as_str().to_string(),
                name: adapter.display_name.clone(),
                display_name: adapter.display_name,
                config_path: skills_path.clone(),
                skills_path,
                enabled: adapter.enabled,
                status: detection.status.as_str().to_string(),
                adapter_status: detection.status.as_str().to_string(),
                transform: adapter.transform_strategy.as_str().to_string(),
                transform_strategy: adapter.transform_strategy.as_str().to_string(),
                enabled_skill_count,
            });
        }
        Ok(tools)
    }

    fn list_project_configs_from_conn(
        &self,
        conn: &Connection,
    ) -> rusqlite::Result<Vec<ProjectConfigPayload>> {
        let mut statement = conn.prepare(
            "
            SELECT project_id, display_name, project_path, skills_path, enabled
            FROM project_configs
            ORDER BY updated_at DESC
            ",
        )?;
        let rows = statement.query_map([], |row| {
            let project_id: String = row.get(0)?;
            Ok(ProjectConfigPayload {
                project_id: project_id.clone(),
                name: row.get(1)?,
                display_name: row.get(1)?,
                project_path: row.get(2)?,
                skills_path: row.get(3)?,
                enabled: int_to_bool(row.get(4)?),
                enabled_skill_count: count_enabled_targets_for_project(conn, &project_id)?,
            })
        })?;
        rows.collect()
    }

    fn list_local_installs_from_conn(
        &self,
        conn: &Connection,
    ) -> rusqlite::Result<Vec<LocalSkillInstallPayload>> {
        let mut statement = conn.prepare(
            "
            SELECT skill_id, display_name, local_version, local_hash, source_package_hash,
                   installed_at, updated_at, local_status, central_store_path,
                   has_update, is_scope_restricted, can_update
            FROM local_skill_installs
            ORDER BY updated_at DESC
            ",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(LocalSkillInstallPayload {
                skill_id: row.get(0)?,
                display_name: row.get(1)?,
                local_version: row.get(2)?,
                local_hash: row.get(3)?,
                source_package_hash: row.get(4)?,
                installed_at: row.get(5)?,
                updated_at: row.get(6)?,
                local_status: row.get(7)?,
                central_store_path: row.get(8)?,
                enabled_targets: Vec::new(),
                has_update: int_to_bool(row.get(9)?),
                is_scope_restricted: int_to_bool(row.get(10)?),
                can_update: int_to_bool(row.get(11)?),
            })
        })?;

        let mut installs = Vec::new();
        for row in rows {
            let mut install = row?;
            install.enabled_targets = load_enabled_targets(conn, &install.skill_id)?;
            installs.push(install);
        }
        Ok(installs)
    }

    fn local_install_payload(
        &self,
        conn: &Connection,
        install: LocalSkillInstall,
    ) -> rusqlite::Result<LocalSkillInstallPayload> {
        Ok(LocalSkillInstallPayload {
            enabled_targets: load_enabled_targets(conn, &install.skill_id)?,
            skill_id: install.skill_id,
            display_name: install.display_name,
            local_version: install.local_version,
            local_hash: install.local_hash,
            source_package_hash: install.source_package_hash,
            installed_at: install.installed_at,
            updated_at: install.updated_at,
            local_status: install.local_status.as_str().to_string(),
            central_store_path: install.central_store_path.to_string_lossy().to_string(),
            has_update: install.has_update,
            is_scope_restricted: install.is_scope_restricted,
            can_update: install.can_update,
        })
    }
}

fn extract_zip_bytes(bytes: &[u8], target_dir: &Path) -> Result<(), String> {
    let mut archive =
        ZipArchive::new(Cursor::new(bytes)).map_err(|error| format!("read package zip: {error}"))?;
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

fn upsert_local_install(conn: &Connection, install: &LocalSkillInstall) -> rusqlite::Result<()> {
    conn.execute(
        statements::UPSERT_LOCAL_SKILL_INSTALL,
        params![
            &install.skill_id,
            &install.display_name,
            &install.local_version,
            &install.local_hash,
            &install.source_package_hash,
            install.central_store_path.to_string_lossy().to_string(),
            install.local_status.as_str(),
            bool_to_int(install.has_update),
            bool_to_int(install.is_scope_restricted),
            bool_to_int(install.can_update),
            &install.installed_at,
            &install.updated_at,
        ],
    )?;
    Ok(())
}

fn upsert_enabled_target(conn: &Connection, target: &EnabledTargetPayload) -> rusqlite::Result<()> {
    conn.execute(
        statements::UPSERT_ENABLED_TARGET,
        params![
            &target.id,
            &target.skill_id,
            &target.target_type,
            &target.target_id,
            &target.target_name,
            &target.target_path,
            &target.artifact_path,
            &target.install_mode,
            &target.requested_mode,
            &target.resolved_mode,
            &target.fallback_reason,
            &target.artifact_hash,
            &target.status,
            &target.last_error,
            &target.enabled_at,
            &target.updated_at,
        ],
    )?;
    Ok(())
}

fn insert_offline_event(
    conn: &Connection,
    event: LocalEventPayload,
) -> rusqlite::Result<()> {
    let payload = serde_json::to_string(&event)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
    conn.execute(
        statements::INSERT_OFFLINE_EVENT,
        params![event.event_id, event.event_type, payload, event.occurred_at],
    )?;
    Ok(())
}

fn load_project_config(conn: &Connection, project_id: &str) -> rusqlite::Result<ProjectConfigPayload> {
    conn.query_row(
        "
        SELECT project_id, display_name, project_path, skills_path, enabled
        FROM project_configs
        WHERE project_id = ?
        ",
        [project_id],
        |row| {
            let project_id: String = row.get(0)?;
            Ok(ProjectConfigPayload {
                project_id: project_id.clone(),
                name: row.get(1)?,
                display_name: row.get(1)?,
                project_path: row.get(2)?,
                skills_path: row.get(3)?,
                enabled: int_to_bool(row.get(4)?),
                enabled_skill_count: count_enabled_targets_for_project(conn, &project_id)?,
            })
        },
    )
}

fn load_pending_offline_events(conn: &Connection) -> rusqlite::Result<Vec<LocalEventPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT payload_json
        FROM offline_event_queue
        WHERE status = 'pending'
        ORDER BY occurred_at DESC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        let payload: String = row.get(0)?;
        serde_json::from_str::<LocalEventPayload>(&payload)
            .map_err(|error| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error)))
    })?;
    rows.collect()
}

fn load_install_row(conn: &Connection, skill_id: &str) -> rusqlite::Result<LocalSkillInstallPayload> {
    conn.query_row(
        "
        SELECT skill_id, display_name, local_version, local_hash, source_package_hash,
               installed_at, updated_at, local_status, central_store_path,
               has_update, is_scope_restricted, can_update
        FROM local_skill_installs
        WHERE skill_id = ?
        ",
        [skill_id],
        |row| {
            Ok(LocalSkillInstallPayload {
                skill_id: row.get(0)?,
                display_name: row.get(1)?,
                local_version: row.get(2)?,
                local_hash: row.get(3)?,
                source_package_hash: row.get(4)?,
                installed_at: row.get(5)?,
                updated_at: row.get(6)?,
                local_status: row.get(7)?,
                central_store_path: row.get(8)?,
                enabled_targets: Vec::new(),
                has_update: int_to_bool(row.get(9)?),
                is_scope_restricted: int_to_bool(row.get(10)?),
                can_update: int_to_bool(row.get(11)?),
            })
        },
    )
}

fn load_enabled_targets(
    conn: &Connection,
    skill_id: &str,
) -> rusqlite::Result<Vec<EnabledTargetPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT id, skill_id, target_type, target_id, target_name, target_path, artifact_path,
               install_mode, requested_mode, resolved_mode, fallback_reason, artifact_hash,
               enabled_at, updated_at, status, last_error
        FROM enabled_targets
        WHERE skill_id = ? AND status = 'enabled'
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map([skill_id], |row| {
        Ok(EnabledTargetPayload {
            id: row.get(0)?,
            skill_id: row.get(1)?,
            target_type: row.get(2)?,
            target_id: row.get(3)?,
            target_name: row.get(4)?,
            target_path: row.get(5)?,
            artifact_path: row.get(6)?,
            install_mode: row.get(7)?,
            requested_mode: row.get(8)?,
            resolved_mode: row.get(9)?,
            fallback_reason: row.get(10)?,
            artifact_hash: row.get(11)?,
            enabled_at: row.get(12)?,
            updated_at: row.get(13)?,
            status: row.get(14)?,
            last_error: row.get(15)?,
        })
    })?;
    rows.collect()
}

fn load_enabled_target(
    conn: &Connection,
    skill_id: &str,
    target_type: &str,
    target_id: &str,
) -> rusqlite::Result<EnabledTargetPayload> {
    conn.query_row(
        "
        SELECT id, skill_id, target_type, target_id, target_name, target_path, artifact_path,
               install_mode, requested_mode, resolved_mode, fallback_reason, artifact_hash,
               enabled_at, updated_at, status, last_error
        FROM enabled_targets
        WHERE skill_id = ? AND target_type = ? AND target_id = ? AND status = 'enabled'
        ",
        params![skill_id, target_type, target_id],
        |row| {
            Ok(EnabledTargetPayload {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                target_type: row.get(2)?,
                target_id: row.get(3)?,
                target_name: row.get(4)?,
                target_path: row.get(5)?,
                artifact_path: row.get(6)?,
                install_mode: row.get(7)?,
                requested_mode: row.get(8)?,
                resolved_mode: row.get(9)?,
                fallback_reason: row.get(10)?,
                artifact_hash: row.get(11)?,
                enabled_at: row.get(12)?,
                updated_at: row.get(13)?,
                status: row.get(14)?,
                last_error: row.get(15)?,
            })
        },
    )
}

fn load_all_enabled_targets(
    conn: &Connection,
    skill_id: &str,
) -> rusqlite::Result<Vec<EnabledTargetPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT id, skill_id, target_type, target_id, target_name, target_path, artifact_path,
               install_mode, requested_mode, resolved_mode, fallback_reason, artifact_hash,
               enabled_at, updated_at, status, last_error
        FROM enabled_targets
        WHERE skill_id = ? AND status = 'enabled'
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map([skill_id], |row| {
        Ok(EnabledTargetPayload {
            id: row.get(0)?,
            skill_id: row.get(1)?,
            target_type: row.get(2)?,
            target_id: row.get(3)?,
            target_name: row.get(4)?,
            target_path: row.get(5)?,
            artifact_path: row.get(6)?,
            install_mode: row.get(7)?,
            requested_mode: row.get(8)?,
            resolved_mode: row.get(9)?,
            fallback_reason: row.get(10)?,
            artifact_hash: row.get(11)?,
            enabled_at: row.get(12)?,
            updated_at: row.get(13)?,
            status: row.get(14)?,
            last_error: row.get(15)?,
        })
    })?;
    rows.collect()
}

fn count_enabled_targets_for_tool(conn: &Connection, tool_id: &str) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE target_type = 'tool' AND target_id = ? AND status = 'enabled'",
        [tool_id],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

fn count_enabled_targets_for_project(conn: &Connection, project_id: &str) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE target_type = 'project' AND target_id = ? AND status = 'enabled'",
        [project_id],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

fn count_pending_offline_events(conn: &Connection) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM offline_event_queue WHERE status = 'pending'",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

fn count_unread_local_notifications(conn: &Connection) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM local_notifications WHERE read_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

fn refresh_install_status(conn: &Connection, skill_id: &str, updated_at: &str) -> rusqlite::Result<()> {
    let enabled_count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE skill_id = ? AND status = 'enabled'",
        [skill_id],
        |row| row.get::<_, i64>(0),
    )?;
    let status = if enabled_count > 0 { "enabled" } else { "installed" };
    conn.execute(
        "UPDATE local_skill_installs SET local_status = ?, updated_at = ? WHERE skill_id = ?",
        params![status, updated_at, skill_id],
    )?;
    Ok(())
}

fn parse_adapter_mode(value: &str) -> Result<AdapterInstallMode, String> {
    match value {
        "symlink" => Ok(AdapterInstallMode::Symlink),
        "copy" => Ok(AdapterInstallMode::Copy),
        other => Err(format!("unsupported install mode: {other}")),
    }
}

fn parse_store_install_mode(value: &str) -> Result<InstallMode, String> {
    match value {
        "symlink" => Ok(InstallMode::Symlink),
        "copy" => Ok(InstallMode::Copy),
        other => Err(format!("unsupported install mode: {other}")),
    }
}

fn parse_store_target_type(value: &str) -> Result<TargetType, String> {
    match value {
        "tool" => Ok(TargetType::Tool),
        "project" => Ok(TargetType::Project),
        other => Err(format!("unsupported target type: {other}")),
    }
}

fn resolve_enable_target(
    conn: &Connection,
    target_type: &str,
    target_id: &str,
) -> Result<(AdapterConfig, String, PathBuf), String> {
    match (target_type, target_id) {
        ("tool", "codex") => {
            let adapter = builtin_adapters()
                .into_iter()
                .find(|adapter| adapter.tool_id == AdapterID::Codex)
                .ok_or_else(|| "Codex adapter is not registered".to_string())?;
            let target_root = codex_target_root(&adapter)?;
            Ok((adapter, "Codex".to_string(), target_root))
        }
        ("project", project_id) => {
            let project = load_project_config(conn, project_id).map_err(|error| error.to_string())?;
            let adapter = resolve_project_adapter(&project.skills_path)?;
            Ok((
                adapter,
                project.name,
                PathBuf::from(project.skills_path),
            ))
        }
        ("tool", other) => Err(format!("P1 vertical slice only supports enabling tool:codex; got tool:{other}")),
        (other_type, _) => Err(format!("unsupported target type: {other_type}")),
    }
}

fn resolve_project_adapter(skills_path: &str) -> Result<AdapterConfig, String> {
    let normalized_skills_path = normalize_path_text(skills_path);
    builtin_adapters()
        .into_iter()
        .find(|adapter| {
            adapter
                .target
                .project_paths
                .iter()
                .map(|candidate| normalize_relative_path(candidate))
                .any(|candidate| normalized_skills_path.ends_with(&candidate))
                || (adapter.tool_id == AdapterID::Codex
                    && normalized_skills_path.ends_with(&normalize_relative_path(default_project_skills_suffix())))
        })
        .ok_or_else(|| format!("unable to infer project adapter from skills path: {skills_path}"))
}

fn codex_target_root(adapter: &AdapterConfig) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("EAH_P1_CODEX_SKILLS_PATH") {
        if !path.trim().is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    adapter
        .target
        .global_paths
        .first()
        .map(|path| expand_windows_user_profile(path))
        .ok_or_else(|| "Codex adapter has no global target path".to_string())
}

fn enabled_target_model(
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
        requested_mode: parse_store_install_mode(&target.requested_mode).unwrap_or(InstallMode::Copy),
        resolved_mode: parse_store_install_mode(&target.resolved_mode).unwrap_or(InstallMode::Copy),
        fallback_reason: target.fallback_reason.clone(),
        artifact_hash: target.artifact_hash.clone(),
        enabled_at: target.enabled_at.clone(),
        updated_at: target.updated_at.clone(),
        status,
        last_error: target.last_error.clone(),
    }
}

fn build_local_event_payload(
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
) -> LocalEventPayload {
    LocalEventPayload {
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

fn normalize_project_path(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("project path cannot be empty".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn derive_project_id(name: &str, project_path: &Path) -> String {
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

fn default_project_skills_suffix() -> &'static str {
    ".codex/skills"
}

fn normalize_path_text(value: &str) -> String {
    value.replace('\\', "/").to_ascii_lowercase()
}

fn normalize_relative_path(value: &str) -> String {
    normalize_path_text(value)
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

fn bool_to_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn int_to_bool(value: i64) -> bool {
    value != 0
}

fn sanitize_segment(value: &str) -> String {
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

fn now_iso() -> String {
    let millis = now_millis();
    format!("p1-local-{millis}")
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::Mutex;
    use std::thread;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn installs_enables_and_restores_from_sqlite() {
        let _lock = ENV_LOCK.lock().expect("lock env");
        let temp = TestTemp::new("local-state");
        let package_bytes = fs::read(
            Path::new(env!("CARGO_MANIFEST_DIR")).join(
                "../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip",
            ),
        )
        .expect("read seed package zip");
        let package_url = serve_once(package_bytes.clone());
        let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
        std::env::set_var(
            "EAH_P1_CODEX_SKILLS_PATH",
            temp.path.join("codex-skills").to_string_lossy().to_string(),
        );

        let installed = state
            .install_skill_package(DownloadTicketPayload {
                skill_id: "codex-review-helper".to_string(),
                version: "1.2.0".to_string(),
                package_url,
                package_hash:
                    "sha256:9650d3afdfb7b401ff9c52015f277ec075e768a64aefcc8872257dd51b4cdef5"
                        .to_string(),
                package_size: package_bytes.len() as u64,
                package_file_count: 2,
            })
            .expect("install skill");
        assert_eq!(installed.local_version, "1.2.0");
        assert!(Path::new(&installed.central_store_path).join("SKILL.md").is_file());

        let target = state
            .enable_skill(
                "codex-review-helper".to_string(),
                "1.2.0".to_string(),
                "tool".to_string(),
                "codex".to_string(),
                Some("copy".to_string()),
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
        assert_eq!(restored_bootstrap.offline_events[0].event_type, "enable_result");

        std::env::remove_var("EAH_P1_CODEX_SKILLS_PATH");
    }

    #[test]
    fn persists_projects_disables_targets_and_uninstalls_through_sqlite() {
        let _lock = ENV_LOCK.lock().expect("lock env");
        let temp = TestTemp::new("local-state-projects");
        let package_bytes = fs::read(
            Path::new(env!("CARGO_MANIFEST_DIR")).join(
                "../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip",
            ),
        )
        .expect("read seed package zip");
        let package_url = serve_once(package_bytes.clone());
        let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
        std::env::set_var(
            "EAH_P1_CODEX_SKILLS_PATH",
            temp.path.join("codex-skills").to_string_lossy().to_string(),
        );

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
            .install_skill_package(DownloadTicketPayload {
                skill_id: "codex-review-helper".to_string(),
                version: "1.2.0".to_string(),
                package_url,
                package_hash:
                    "sha256:9650d3afdfb7b401ff9c52015f277ec075e768a64aefcc8872257dd51b4cdef5"
                        .to_string(),
                package_size: package_bytes.len() as u64,
                package_file_count: 2,
            })
            .expect("install skill");

        let tool_target = state
            .enable_skill(
                "codex-review-helper".to_string(),
                "1.2.0".to_string(),
                "tool".to_string(),
                "codex".to_string(),
                Some("copy".to_string()),
            )
            .expect("enable tool target");
        let project_target = state
            .enable_skill(
                "codex-review-helper".to_string(),
                "1.2.0".to_string(),
                "project".to_string(),
                "enterprise-agent-hub".to_string(),
                Some("copy".to_string()),
            )
            .expect("enable project target");

        let bootstrap = state.get_local_bootstrap().expect("bootstrap");
        assert_eq!(bootstrap.projects.len(), 1);
        assert_eq!(bootstrap.projects[0].enabled_skill_count, 1);
        assert_eq!(bootstrap.pending_offline_event_count, 2);
        assert_eq!(bootstrap.offline_events.len(), 2);
        assert!(Path::new(&project_target.target_path).join("SKILL.md").is_file());

        let disabled = state
            .disable_skill(
                "codex-review-helper".to_string(),
                "project".to_string(),
                "enterprise-agent-hub".to_string(),
            )
            .expect("disable project target");
        assert_eq!(disabled.event.event_type, "disable_result");
        assert!(!Path::new(&project_target.target_path).exists());
        assert!(Path::new(&installed.central_store_path).join("SKILL.md").is_file());

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
        assert!(uninstall.removed_target_ids.contains(&tool_target.target_id));
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
            Path::new(env!("CARGO_MANIFEST_DIR")).join(
                "../../api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip",
            ),
        )
        .expect("read seed package zip");
        let package_url = serve_once(package_bytes.clone());
        let state = P1LocalState::initialize(temp.path.join("app-data")).expect("init state");
        std::env::set_var(
            "EAH_P1_CODEX_SKILLS_PATH",
            temp.path.join("codex-skills").to_string_lossy().to_string(),
        );

        state
            .install_skill_package(DownloadTicketPayload {
                skill_id: "codex-review-helper".to_string(),
                version: "1.2.0".to_string(),
                package_url,
                package_hash:
                    "sha256:9650d3afdfb7b401ff9c52015f277ec075e768a64aefcc8872257dd51b4cdef5"
                        .to_string(),
                package_size: package_bytes.len() as u64,
                package_file_count: 2,
            })
            .expect("install skill");
        state
            .enable_skill(
                "codex-review-helper".to_string(),
                "1.2.0".to_string(),
                "tool".to_string(),
                "codex".to_string(),
                Some("copy".to_string()),
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
    }

    impl Drop for TestTemp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
