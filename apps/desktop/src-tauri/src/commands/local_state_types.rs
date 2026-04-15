use serde::{Deserialize, Serialize};

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
    pub notifications: Vec<LocalNotificationPayload>,
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
    pub detected_path: Option<String>,
    pub configured_path: Option<String>,
    pub skills_path: String,
    pub enabled: bool,
    pub status: String,
    pub adapter_status: String,
    pub detection_method: String,
    pub transform: String,
    pub transform_strategy: String,
    pub enabled_skill_count: u32,
    pub last_scanned_at: Option<String>,
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
    pub created_at: String,
    pub updated_at: String,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolConfigInputPayload {
    #[serde(rename = "toolID")]
    pub tool_id: String,
    pub name: Option<String>,
    pub config_path: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalNotificationPayload {
    #[serde(rename = "notificationID")]
    pub notification_id: String,
    #[serde(rename = "type")]
    pub notification_type: String,
    pub title: String,
    pub summary: String,
    #[serde(rename = "relatedSkillID")]
    pub related_skill_id: Option<String>,
    pub target_page: String,
    pub occurred_at: String,
    pub unread: bool,
    pub source: String,
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateTargetPathPayload {
    pub valid: bool,
    pub writable: bool,
    pub exists: bool,
    pub can_create: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFindingPayload {
    pub id: String,
    pub kind: String,
    pub skill_id: Option<String>,
    pub target_type: String,
    pub target_id: String,
    pub target_name: String,
    pub target_path: String,
    pub relative_path: String,
    pub checksum: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFindingCountsPayload {
    pub managed: u32,
    pub unmanaged: u32,
    pub conflict: u32,
    pub orphan: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanTargetSummaryPayload {
    pub id: String,
    pub target_type: String,
    pub target_id: String,
    pub target_name: String,
    pub target_path: String,
    pub transform_strategy: String,
    pub scanned_at: String,
    pub counts: ScanFindingCountsPayload,
    pub findings: Vec<ScanFindingPayload>,
    pub last_error: Option<String>,
}
