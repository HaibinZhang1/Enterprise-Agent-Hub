use std::fmt;
use std::path::PathBuf;

/// P1 enable/install modes. Default requests should be symlink; copy is a fallback or explicit request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallMode {
    Symlink,
    Copy,
}

impl InstallMode {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Symlink => "symlink",
            Self::Copy => "copy",
        }
    }
}

impl fmt::Display for InstallMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalStatus {
    Installed,
    Enabled,
    PartiallyFailed,
}

impl LocalStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Enabled => "enabled",
            Self::PartiallyFailed => "partially_failed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetType {
    Tool,
    Project,
}

impl TargetType {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Tool => "tool",
            Self::Project => "project",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnabledTargetStatus {
    Enabled,
    Disabled,
    Failed,
}

impl EnabledTargetStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Enabled => "enabled",
            Self::Disabled => "disabled",
            Self::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfflineEventStatus {
    Pending,
    Syncing,
    Synced,
    Failed,
}

impl OfflineEventStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Syncing => "syncing",
            Self::Synced => "synced",
            Self::Failed => "failed",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSkillInstall {
    pub skill_id: String,
    pub display_name: String,
    pub local_version: String,
    pub local_hash: String,
    pub source_package_hash: String,
    pub installed_at: String,
    pub updated_at: String,
    pub local_status: LocalStatus,
    pub central_store_path: PathBuf,
    pub enabled_targets: Vec<EnabledTarget>,
    pub has_update: bool,
    pub is_scope_restricted: bool,
    pub can_update: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnabledTarget {
    pub id: String,
    pub skill_id: String,
    pub target_type: TargetType,
    pub target_id: String,
    pub target_name: String,
    pub target_path: PathBuf,
    pub artifact_path: PathBuf,
    /// Backward-compatible actual mode field required by the P1 contract.
    pub install_mode: InstallMode,
    /// User/system requested mode; P1 defaults to symlink.
    pub requested_mode: InstallMode,
    /// Actual mode after symlink-first/copy-fallback distribution.
    pub resolved_mode: InstallMode,
    pub fallback_reason: Option<String>,
    pub artifact_hash: String,
    pub enabled_at: String,
    pub updated_at: String,
    pub status: EnabledTargetStatus,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OfflineLocalEvent {
    pub event_id: String,
    pub event_type: String,
    pub skill_id: String,
    pub version: String,
    pub target_type: Option<TargetType>,
    pub target_id: Option<String>,
    pub target_path: Option<PathBuf>,
    pub requested_mode: Option<InstallMode>,
    pub resolved_mode: Option<InstallMode>,
    pub fallback_reason: Option<String>,
    pub occurred_at: String,
    pub result: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalNotification {
    pub notification_id: String,
    pub notification_type: String,
    pub title: String,
    pub summary: String,
    pub object_type: Option<String>,
    pub object_id: Option<String>,
    pub read_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UninstallResult {
    pub skill_id: String,
    pub removed_central_store_path: Option<PathBuf>,
    pub removed_target_ids: Vec<String>,
    pub failed_targets: Vec<EnabledTarget>,
    pub removed_at: String,
}
