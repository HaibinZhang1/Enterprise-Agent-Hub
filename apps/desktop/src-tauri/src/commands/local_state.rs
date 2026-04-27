use std::fs;
use std::path::{Path, PathBuf};

use reqwest::blocking::Client;
use rusqlite::{params, Connection};

pub use crate::commands::local_state_types::{
    DisableSkillPayload, DownloadTicketPayload, EnabledTargetPayload, ImportLocalSkillPayload,
    LocalBootstrapPayload, LocalEventPayload, LocalNotificationPayload, LocalSkillInstallPayload,
    OfflineSyncAckPayload, ProjectConfigInputPayload, ProjectConfigPayload,
    ScanFindingCountsPayload, ScanFindingPayload, ScanTargetSummaryPayload, ToolConfigInputPayload,
    ToolConfigPayload, UninstallSkillPayload, ValidateTargetPathPayload,
};
use crate::store::central_store::{default_central_store_root, ensure_central_store_root};
use crate::store::sqlite::{ordered_migrations, statements};

mod checksum;
mod configuration;
mod distribution_lifecycle;
mod notification_sync;
mod package_lifecycle;
mod pathing;
mod persistence;
mod query;
mod scan;

#[derive(Debug, Clone)]
pub struct P1LocalState {
    central_store_root: PathBuf,
    db_path: PathBuf,
    http: Client,
}

impl P1LocalState {
    pub fn initialize(app_data_dir: impl AsRef<Path>) -> Result<Self, String> {
        let app_data_dir = app_data_dir.as_ref().to_path_buf();
        fs::create_dir_all(&app_data_dir)
            .map_err(|error| format!("create app data dir {}: {error}", app_data_dir.display()))?;
        let central_store_root =
            ensure_central_store_root(default_central_store_root(&app_data_dir))
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
        configuration::refresh_builtin_tool_configs(&conn)?;
        Ok(state)
    }

    pub fn central_store_root(&self) -> &Path {
        &self.central_store_root
    }

    pub fn get_local_bootstrap(&self) -> Result<LocalBootstrapPayload, String> {
        query::get_local_bootstrap(self)
    }

    pub fn detect_tools(&self) -> Result<Vec<ToolConfigPayload>, String> {
        query::detect_tools(self)
    }

    pub fn save_tool_config(
        &self,
        input: ToolConfigInputPayload,
    ) -> Result<ToolConfigPayload, String> {
        configuration::save_tool_config(self, input)
    }

    pub fn delete_tool_config(&self, tool_id: String) -> Result<(), String> {
        configuration::delete_tool_config(self, tool_id)
    }

    pub fn install_skill_package(
        &self,
        download_ticket: DownloadTicketPayload,
    ) -> Result<LocalSkillInstallPayload, String> {
        package_lifecycle::install_skill_package(self, download_ticket)
    }

    pub fn update_skill_package(
        &self,
        download_ticket: DownloadTicketPayload,
    ) -> Result<LocalSkillInstallPayload, String> {
        package_lifecycle::update_skill_package(self, download_ticket)
    }

    pub fn import_local_skill(
        &self,
        input: ImportLocalSkillPayload,
    ) -> Result<LocalSkillInstallPayload, String> {
        package_lifecycle::import_local_skill(self, input)
    }

    pub fn list_local_installs(&self) -> Result<Vec<LocalSkillInstallPayload>, String> {
        query::list_local_installs(self)
    }

    pub fn save_project_config(
        &self,
        input: ProjectConfigInputPayload,
    ) -> Result<ProjectConfigPayload, String> {
        configuration::save_project_config(self, input)
    }

    pub fn delete_project_config(&self, project_id: String) -> Result<(), String> {
        configuration::delete_project_config(self, project_id)
    }

    pub fn validate_target_path(&self, path: String) -> Result<ValidateTargetPathPayload, String> {
        configuration::validate_target_path(path)
    }

    pub fn upsert_local_notifications(
        &self,
        notifications: Vec<LocalNotificationPayload>,
    ) -> Result<(), String> {
        notification_sync::upsert_local_notifications(self, notifications)
    }

    pub fn mark_local_notifications_read(
        &self,
        notification_ids: Vec<String>,
        all: bool,
    ) -> Result<(), String> {
        notification_sync::mark_local_notifications_read(self, notification_ids, all)
    }

    pub fn mark_offline_events_synced(
        &self,
        event_ids: Vec<String>,
    ) -> Result<OfflineSyncAckPayload, String> {
        notification_sync::mark_offline_events_synced(self, event_ids)
    }

    pub fn enable_skill(
        &self,
        skill_id: String,
        version: String,
        target_type: String,
        target_id: String,
        preferred_mode: Option<String>,
        allow_overwrite: Option<bool>,
    ) -> Result<EnabledTargetPayload, String> {
        distribution_lifecycle::enable_skill(
            self,
            skill_id,
            version,
            target_type,
            target_id,
            preferred_mode,
            allow_overwrite,
        )
    }

    pub fn scan_local_targets(&self) -> Result<Vec<ScanTargetSummaryPayload>, String> {
        scan::scan_local_targets(self)
    }

    pub fn disable_skill(
        &self,
        skill_id: String,
        target_type: String,
        target_id: String,
    ) -> Result<DisableSkillPayload, String> {
        distribution_lifecycle::disable_skill(self, skill_id, target_type, target_id)
    }

    pub fn uninstall_skill(&self, skill_id: String) -> Result<UninstallSkillPayload, String> {
        package_lifecycle::uninstall_skill(self, skill_id)
    }

    fn open_connection(&self) -> rusqlite::Result<Connection> {
        let conn = Connection::open(&self.db_path)?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        for (_, sql) in ordered_migrations() {
            conn.execute_batch(sql)?;
        }
        persistence::ensure_local_skill_install_columns(&conn)?;
        persistence::ensure_local_notification_cache_columns(&conn)?;
        Ok(conn)
    }

    fn set_store_metadata(&self, conn: &Connection) -> rusqlite::Result<()> {
        conn.execute(
            statements::SET_STORE_METADATA,
            params![
                "central_store_path",
                self.central_store_root.to_string_lossy().to_string(),
                pathing::now_iso()
            ],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests;
