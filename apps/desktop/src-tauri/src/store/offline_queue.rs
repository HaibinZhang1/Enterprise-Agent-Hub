use super::models::{InstallMode, OfflineLocalEvent, TargetType};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OfflineEventRecord {
    pub event_id: String,
    pub event_type: String,
    pub payload_json: String,
    pub occurred_at: String,
}

pub fn enable_result_event(
    event_id: String,
    skill_id: String,
    version: String,
    target_type: TargetType,
    target_id: String,
    target_path: String,
    requested_mode: InstallMode,
    resolved_mode: InstallMode,
    fallback_reason: Option<String>,
    occurred_at: String,
    result: String,
) -> OfflineLocalEvent {
    OfflineLocalEvent {
        event_id,
        event_type: "enable_result".to_owned(),
        skill_id,
        version,
        target_type: Some(target_type),
        target_id: Some(target_id),
        target_path: Some(target_path.into()),
        requested_mode: Some(requested_mode),
        resolved_mode: Some(resolved_mode),
        fallback_reason,
        occurred_at,
        result,
    }
}

pub fn event_to_json(event: &OfflineLocalEvent) -> String {
    // Store-owned minimal JSON encoder keeps the local queue deterministic until the Tauri crate
    // wires serde in at the application boundary.
    let mut fields = vec![
        json_field("eventID", &event.event_id),
        json_field("eventType", &event.event_type),
        json_field("skillID", &event.skill_id),
        json_field("version", &event.version),
        json_field("occurredAt", &event.occurred_at),
        json_field("result", &event.result),
    ];

    if let Some(target_type) = event.target_type {
        fields.push(json_field("targetType", target_type.as_str()));
    }
    if let Some(target_id) = &event.target_id {
        fields.push(json_field("targetID", target_id));
    }
    if let Some(target_path) = &event.target_path {
        fields.push(json_field("targetPath", &target_path.to_string_lossy()));
    }
    if let Some(requested_mode) = event.requested_mode {
        fields.push(json_field("requestedMode", requested_mode.as_str()));
    }
    if let Some(resolved_mode) = event.resolved_mode {
        fields.push(json_field("resolvedMode", resolved_mode.as_str()));
    }
    if let Some(fallback_reason) = &event.fallback_reason {
        fields.push(json_field("fallbackReason", fallback_reason));
    }

    format!("{{{}}}", fields.join(","))
}

pub fn queue_record(event: &OfflineLocalEvent) -> OfflineEventRecord {
    OfflineEventRecord {
        event_id: event.event_id.clone(),
        event_type: event.event_type.clone(),
        payload_json: event_to_json(event),
        occurred_at: event.occurred_at.clone(),
    }
}

fn json_field(name: &str, value: &str) -> String {
    format!("\"{}\":\"{}\"", escape_json(name), escape_json(value))
}

fn escape_json(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '"' => escaped.push_str("\\\""),
            '\\' => escaped.push_str("\\\\"),
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            ch if ch.is_control() => escaped.push_str(&format!("\\u{:04x}", ch as u32)),
            ch => escaped.push(ch),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enable_result_json_preserves_requested_resolved_and_fallback() {
        let event = enable_result_event(
            "evt_1".to_owned(),
            "skill_1".to_owned(),
            "1.0.0".to_owned(),
            TargetType::Tool,
            "codex".to_owned(),
            r"C:\Users\me\.codex\skills".to_owned(),
            InstallMode::Symlink,
            InstallMode::Copy,
            Some("symlink_permission_denied".to_owned()),
            "2026-04-11T02:20:00Z".to_owned(),
            "success".to_owned(),
        );
        let json = event_to_json(&event);
        assert!(json.contains("\"requestedMode\":\"symlink\""));
        assert!(json.contains("\"resolvedMode\":\"copy\""));
        assert!(json.contains("\"fallbackReason\":\"symlink_permission_denied\""));
    }
}
