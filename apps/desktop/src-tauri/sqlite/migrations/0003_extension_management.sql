-- Additive Extension inventory for Plugin Central Management P0.
-- Skill/file-backed writes remain owned by local_skill_installs + enabled_targets.

CREATE TABLE IF NOT EXISTS local_extension_installs (
  extension_id TEXT PRIMARY KEY,
  extension_type TEXT NOT NULL CHECK (extension_type IN ('skill', 'mcp_server', 'plugin', 'hook', 'agent_cli')),
  extension_kind TEXT NOT NULL CHECK (extension_kind IN ('file_backed', 'config_backed', 'native_plugin', 'agent_cli')),
  display_name TEXT NOT NULL,
  local_version TEXT NOT NULL,
  local_hash TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_uri TEXT,
  manifest_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  audit_status TEXT NOT NULL DEFAULT 'unknown',
  enterprise_status TEXT NOT NULL DEFAULT 'allowed' CHECK (enterprise_status IN ('allowed', 'disabled', 'revoked')),
  central_store_path TEXT,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plugin_targets (
  id TEXT PRIMARY KEY,
  extension_id TEXT NOT NULL,
  extension_type TEXT NOT NULL,
  extension_kind TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_agent TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_path TEXT,
  artifact_path TEXT,
  config_path TEXT,
  requested_mode TEXT,
  resolved_mode TEXT,
  fallback_reason TEXT,
  artifact_hash TEXT,
  status TEXT NOT NULL,
  denial_reason TEXT,
  enabled_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (extension_id) REFERENCES local_extension_installs(extension_id) ON DELETE CASCADE,
  UNIQUE (extension_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_local_extension_installs_type ON local_extension_installs(extension_type, extension_kind);
CREATE INDEX IF NOT EXISTS idx_local_extension_installs_enterprise_status ON local_extension_installs(enterprise_status);
CREATE INDEX IF NOT EXISTS idx_plugin_targets_extension ON plugin_targets(extension_id);
CREATE INDEX IF NOT EXISTS idx_plugin_targets_status ON plugin_targets(status);
