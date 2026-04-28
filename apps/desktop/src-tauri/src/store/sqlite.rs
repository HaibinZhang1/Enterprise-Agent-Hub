pub const P1_INITIAL_MIGRATION_NAME: &str = "0001_p1_local_state";
pub const P1_INITIAL_MIGRATION_SQL: &str =
    include_str!("../../sqlite/migrations/0001_p1_local_state.sql");
pub const LOCAL_NOTIFICATION_CACHE_MIGRATION_NAME: &str = "0002_local_notification_cache";
pub const LOCAL_NOTIFICATION_CACHE_MIGRATION_SQL: &str =
    include_str!("../../sqlite/migrations/0002_local_notification_cache.sql");
pub const EXTENSION_MANAGEMENT_MIGRATION_NAME: &str = "0003_extension_management";
pub const EXTENSION_MANAGEMENT_MIGRATION_SQL: &str =
    include_str!("../../sqlite/migrations/0003_extension_management.sql");

/// Store-owned persistence statements. The Tauri application DB adapter should bind values
/// to these statements instead of duplicating table/field names in command handlers.
pub mod statements {
    pub const UPSERT_LOCAL_SKILL_INSTALL: &str = r#"
INSERT INTO local_skill_installs (
  skill_id, display_name, local_version, local_hash, source_package_hash,
  source_type, central_store_path, local_status, has_update, is_scope_restricted,
  can_update, installed_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(skill_id) DO UPDATE SET
  display_name = excluded.display_name,
  local_version = excluded.local_version,
  local_hash = excluded.local_hash,
  source_package_hash = excluded.source_package_hash,
  source_type = excluded.source_type,
  central_store_path = excluded.central_store_path,
  local_status = excluded.local_status,
  has_update = excluded.has_update,
  is_scope_restricted = excluded.is_scope_restricted,
  can_update = excluded.can_update,
  updated_at = excluded.updated_at
"#;

    pub const UPSERT_ENABLED_TARGET: &str = r#"
INSERT INTO enabled_targets (
  id, skill_id, target_type, target_id, target_name, target_path,
  artifact_path, install_mode, requested_mode, resolved_mode, fallback_reason,
  artifact_hash, status, last_error, enabled_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(skill_id, target_type, target_id) DO UPDATE SET
  target_name = excluded.target_name,
  target_path = excluded.target_path,
  artifact_path = excluded.artifact_path,
  install_mode = excluded.install_mode,
  requested_mode = excluded.requested_mode,
  resolved_mode = excluded.resolved_mode,
  fallback_reason = excluded.fallback_reason,
  artifact_hash = excluded.artifact_hash,
  status = excluded.status,
  last_error = excluded.last_error,
  updated_at = excluded.updated_at
"#;

    pub const INSERT_OFFLINE_EVENT: &str = r#"
INSERT INTO offline_event_queue (
  event_id, event_type, payload_json, status, retry_count, last_error, occurred_at, synced_at
) VALUES (?, ?, ?, 'pending', 0, NULL, ?, NULL)
ON CONFLICT(event_id) DO NOTHING
"#;

    pub const MARK_OFFLINE_EVENT_SYNCED: &str = r#"
UPDATE offline_event_queue
SET status = 'synced', synced_at = ?, last_error = NULL
WHERE event_id = ?
"#;

    pub const UPSERT_LOCAL_NOTIFICATION: &str = r#"
INSERT INTO local_notifications (
  notification_id, type, title, summary, object_type, object_id, related_skill_id,
  target_page, source, read_at, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(notification_id) DO UPDATE SET
  type = excluded.type,
  title = excluded.title,
  summary = excluded.summary,
  object_type = excluded.object_type,
  object_id = excluded.object_id,
  related_skill_id = excluded.related_skill_id,
  target_page = excluded.target_page,
  source = excluded.source,
  read_at = excluded.read_at
"#;

    pub const MARK_LOCAL_NOTIFICATION_READ: &str = r#"
UPDATE local_notifications
SET read_at = ?
WHERE notification_id = ?
"#;

    pub const MARK_ALL_LOCAL_NOTIFICATIONS_READ: &str = r#"
UPDATE local_notifications
SET read_at = ?
WHERE read_at IS NULL
"#;

    pub const UPSERT_SYNC_STATE: &str = r#"
INSERT INTO sync_state (key, value, status, last_synced_at, last_error, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  status = excluded.status,
  last_synced_at = excluded.last_synced_at,
  last_error = excluded.last_error,
  updated_at = excluded.updated_at
"#;

    pub const SET_STORE_METADATA: &str = r#"
INSERT INTO store_metadata (key, value, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at
"#;
}

pub fn ordered_migrations() -> [(&'static str, &'static str); 2] {
    [
        (P1_INITIAL_MIGRATION_NAME, P1_INITIAL_MIGRATION_SQL),
        (
            EXTENSION_MANAGEMENT_MIGRATION_NAME,
            EXTENSION_MANAGEMENT_MIGRATION_SQL,
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::{
        statements, EXTENSION_MANAGEMENT_MIGRATION_SQL, LOCAL_NOTIFICATION_CACHE_MIGRATION_SQL,
        P1_INITIAL_MIGRATION_SQL,
    };

    #[test]
    fn migration_contains_store_owned_tables() {
        for table in [
            "local_skill_installs",
            "enabled_targets",
            "offline_event_queue",
            "local_notifications",
            "sync_state",
            "store_metadata",
        ] {
            assert!(P1_INITIAL_MIGRATION_SQL.contains(table), "missing {table}");
        }
        assert!(P1_INITIAL_MIGRATION_SQL.contains("requested_mode"));
        assert!(P1_INITIAL_MIGRATION_SQL.contains("resolved_mode"));
        assert!(P1_INITIAL_MIGRATION_SQL.contains("fallback_reason"));
        assert!(LOCAL_NOTIFICATION_CACHE_MIGRATION_SQL.contains("target_page"));
        assert!(LOCAL_NOTIFICATION_CACHE_MIGRATION_SQL.contains("source"));
        assert!(EXTENSION_MANAGEMENT_MIGRATION_SQL.contains("local_extension_installs"));
        assert!(EXTENSION_MANAGEMENT_MIGRATION_SQL.contains("plugin_targets"));
        assert!(EXTENSION_MANAGEMENT_MIGRATION_SQL.contains("file_backed"));
    }

    #[test]
    fn persistence_statements_cover_queue_notifications_and_store_metadata() {
        assert!(statements::UPSERT_LOCAL_SKILL_INSTALL.contains("local_skill_installs"));
        assert!(statements::UPSERT_ENABLED_TARGET.contains("requested_mode"));
        assert!(statements::INSERT_OFFLINE_EVENT.contains("offline_event_queue"));
        assert!(statements::UPSERT_LOCAL_NOTIFICATION.contains("local_notifications"));
        assert!(statements::MARK_LOCAL_NOTIFICATION_READ.contains("local_notifications"));
        assert!(statements::MARK_ALL_LOCAL_NOTIFICATIONS_READ.contains("local_notifications"));
        assert!(statements::UPSERT_SYNC_STATE.contains("sync_state"));
        assert!(statements::SET_STORE_METADATA.contains("store_metadata"));
    }
}
