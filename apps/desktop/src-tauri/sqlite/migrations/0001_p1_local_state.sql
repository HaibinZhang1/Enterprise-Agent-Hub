-- P1 desktop local state schema.
-- Central Store is the single source of truth; target tool/project paths are managed outputs only.

CREATE TABLE IF NOT EXISTS local_skill_installs (
  skill_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  local_version TEXT NOT NULL,
  local_hash TEXT NOT NULL,
  source_package_hash TEXT NOT NULL,
  central_store_path TEXT NOT NULL,
  local_status TEXT NOT NULL CHECK (local_status IN ('installed', 'enabled', 'partially_failed')),
  has_update INTEGER NOT NULL DEFAULT 0 CHECK (has_update IN (0, 1)),
  is_scope_restricted INTEGER NOT NULL DEFAULT 0 CHECK (is_scope_restricted IN (0, 1)),
  can_update INTEGER NOT NULL DEFAULT 1 CHECK (can_update IN (0, 1)),
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enabled_targets (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('tool', 'project')),
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_path TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  install_mode TEXT NOT NULL CHECK (install_mode IN ('symlink', 'copy')),
  requested_mode TEXT NOT NULL CHECK (requested_mode IN ('symlink', 'copy')),
  resolved_mode TEXT NOT NULL CHECK (resolved_mode IN ('symlink', 'copy')),
  fallback_reason TEXT,
  artifact_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled', 'failed')),
  last_error TEXT,
  enabled_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES local_skill_installs(skill_id) ON DELETE CASCADE,
  UNIQUE (skill_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS tool_configs (
  tool_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  adapter_status TEXT NOT NULL CHECK (adapter_status IN ('detected', 'manual', 'missing', 'invalid', 'disabled')),
  detected_path TEXT,
  configured_path TEXT,
  skills_path TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  detection_method TEXT,
  transform_strategy TEXT NOT NULL,
  last_scanned_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_configs (
  project_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  skills_path TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_event_queue (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('enable_result', 'disable_result', 'uninstall_result', 'install_result', 'update_result', 'local_copy_blocked')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  occurred_at TEXT NOT NULL,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_notifications (
  notification_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enabled_targets_skill ON enabled_targets(skill_id);
CREATE INDEX IF NOT EXISTS idx_enabled_targets_status ON enabled_targets(status);
CREATE INDEX IF NOT EXISTS idx_offline_event_queue_status ON offline_event_queue(status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_local_notifications_read ON local_notifications(read_at, created_at);
