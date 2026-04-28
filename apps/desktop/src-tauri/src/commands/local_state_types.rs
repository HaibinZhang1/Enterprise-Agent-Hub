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
    pub extensions: Vec<ExtensionInstallPayload>,
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
    pub project_path_status: String,
    pub project_path_status_reason: Option<String>,
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
    pub source_type: String,
    pub installed_at: String,
    pub updated_at: String,
    pub local_status: String,
    pub central_store_path: String,
    pub enabled_targets: Vec<EnabledTargetPayload>,
    pub has_update: bool,
    pub is_scope_restricted: bool,
    pub can_update: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionPermissionPayload {
    pub id: String,
    pub label: String,
    pub risk_level: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionManifestPayload {
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub display_name: String,
    pub version: String,
    pub description: Option<String>,
    pub permissions: Vec<ExtensionPermissionPayload>,
    pub risk_level: String,
    pub audit_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginTargetPayload {
    pub id: String,
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub target_type: String,
    pub target_agent: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_name: String,
    pub target_path: Option<String>,
    pub artifact_path: Option<String>,
    pub config_path: Option<String>,
    pub requested_mode: Option<String>,
    pub resolved_mode: Option<String>,
    pub fallback_reason: Option<String>,
    pub artifact_hash: Option<String>,
    pub status: String,
    pub denial_reason: Option<String>,
    pub enabled_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInstallPayload {
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub display_name: String,
    pub local_version: String,
    pub local_hash: String,
    pub source_type: String,
    pub source_uri: Option<String>,
    pub manifest: ExtensionManifestPayload,
    pub permissions: Vec<ExtensionPermissionPayload>,
    pub risk_level: String,
    pub audit_status: String,
    pub enterprise_status: String,
    pub central_store_path: Option<String>,
    pub installed_at: String,
    pub updated_at: String,
    pub write_capability: bool,
    pub targets: Vec<PluginTargetPayload>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLocalExtensionPayload {
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub relative_path: String,
    pub conflict_strategy: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableExtensionPayload {
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub version: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub preferred_mode: Option<String>,
    pub requested_mode: Option<String>,
    pub allow_overwrite: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisableExtensionPayload {
    #[serde(rename = "extensionID")]
    pub extension_id: String,
    pub extension_type: String,
    pub extension_kind: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLocalSkillPayload {
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub relative_path: String,
    #[serde(rename = "skillID")]
    pub skill_id: String,
    pub conflict_strategy: String,
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
    #[serde(rename = "extensionID")]
    pub extension_id: Option<String>,
    pub extension_type: Option<String>,
    pub extension_kind: Option<String>,
    pub version: String,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_path: String,
    pub requested_mode: String,
    pub resolved_mode: String,
    pub fallback_reason: Option<String>,
    pub denial_reason: Option<String>,
    pub enterprise_status: Option<String>,
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
    #[serde(rename = "removedTargetIDs")]
    pub removed_target_ids: Vec<String>,
    #[serde(rename = "failedTargetIDs")]
    pub failed_target_ids: Vec<String>,
    pub event: LocalEventPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineSyncAckPayload {
    #[serde(rename = "syncedEventIDs")]
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
    #[serde(rename = "skillID")]
    pub skill_id: Option<String>,
    #[serde(rename = "extensionID")]
    pub extension_id: Option<String>,
    pub extension_type: Option<String>,
    pub extension_kind: Option<String>,
    pub write_capability: bool,
    pub enterprise_status: Option<String>,
    pub target_type: String,
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_name: String,
    pub target_path: String,
    pub relative_path: String,
    pub checksum: Option<String>,
    pub can_import: bool,
    pub import_display_name: Option<String>,
    pub import_description: Option<String>,
    pub import_version: Option<String>,
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
    #[serde(rename = "targetID")]
    pub target_id: String,
    pub target_name: String,
    pub target_path: String,
    pub transform_strategy: String,
    pub scanned_at: String,
    pub counts: ScanFindingCountsPayload,
    pub findings: Vec<ScanFindingPayload>,
    pub last_error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_id_acronyms_for_local_command_contract() {
        let finding = ScanFindingPayload {
            id: "tool:codex:demo-skill".to_string(),
            kind: "unmanaged".to_string(),
            skill_id: Some("demo-skill".to_string()),
            extension_id: Some("demo-skill".to_string()),
            extension_type: Some("skill".to_string()),
            extension_kind: Some("file_backed".to_string()),
            write_capability: true,
            enterprise_status: Some("allowed".to_string()),
            target_type: "tool".to_string(),
            target_id: "codex".to_string(),
            target_name: "Codex".to_string(),
            target_path: "/tmp/codex/demo-skill".to_string(),
            relative_path: "demo-skill".to_string(),
            checksum: None,
            can_import: true,
            import_display_name: Some("Demo Skill".to_string()),
            import_description: Some("Demo".to_string()),
            import_version: Some("0.0.0-local".to_string()),
            message: "发现未托管目录。".to_string(),
        };
        let finding_value = serde_json::to_value(&finding).expect("serialize scan finding");
        assert_eq!(finding_value["skillID"], "demo-skill");
        assert!(finding_value.get("skillId").is_none());
        assert_eq!(finding_value["targetID"], "codex");
        assert!(finding_value.get("targetId").is_none());

        let summary = ScanTargetSummaryPayload {
            id: "tool:codex".to_string(),
            target_type: "tool".to_string(),
            target_id: "codex".to_string(),
            target_name: "Codex".to_string(),
            target_path: "/tmp/codex".to_string(),
            transform_strategy: "codex_skill".to_string(),
            scanned_at: "2026-04-19T00:00:00Z".to_string(),
            counts: ScanFindingCountsPayload {
                managed: 0,
                unmanaged: 1,
                conflict: 0,
                orphan: 0,
            },
            findings: vec![finding],
            last_error: None,
        };
        let summary_value = serde_json::to_value(&summary).expect("serialize scan summary");
        assert_eq!(summary_value["targetID"], "codex");
        assert!(summary_value.get("targetId").is_none());

        let ack = OfflineSyncAckPayload {
            synced_event_ids: vec!["event-1".to_string()],
        };
        let ack_value = serde_json::to_value(&ack).expect("serialize sync ack");
        assert_eq!(ack_value["syncedEventIDs"][0], "event-1");
        assert!(ack_value.get("syncedEventIds").is_none());

        let uninstall = UninstallSkillPayload {
            removed_target_ids: vec!["codex".to_string()],
            failed_target_ids: Vec::new(),
            event: LocalEventPayload {
                event_id: "event-1".to_string(),
                event_type: "uninstall_result".to_string(),
                skill_id: "demo-skill".to_string(),
                extension_id: None,
                extension_type: None,
                extension_kind: None,
                version: "1.0.0".to_string(),
                target_type: "tool".to_string(),
                target_id: "codex".to_string(),
                target_path: "/tmp/codex".to_string(),
                requested_mode: "copy".to_string(),
                resolved_mode: "copy".to_string(),
                fallback_reason: None,
                denial_reason: None,
                enterprise_status: None,
                occurred_at: "2026-04-19T00:00:00Z".to_string(),
                result: "success".to_string(),
            },
        };
        let uninstall_value = serde_json::to_value(&uninstall).expect("serialize uninstall");
        assert_eq!(uninstall_value["removedTargetIDs"][0], "codex");
        assert!(uninstall_value.get("removedTargetIds").is_none());
        assert_eq!(
            uninstall_value["failedTargetIDs"].as_array().unwrap().len(),
            0
        );
        assert!(uninstall_value.get("failedTargetIds").is_none());
    }
}
