use std::collections::HashMap;
use std::path::PathBuf;

use rusqlite::{params, Connection};

#[cfg(not(test))]
use crate::adapters::{builtin_adapters, detect_adapter, AdapterID};
#[cfg(test)]
use crate::commands::distribution::adapters::{builtin_adapters, detect_adapter, AdapterID};
use crate::commands::path_validation::{
    validate_distribution_target_path, ValidateTargetPathRequest,
};

use super::pathing::{
    bool_to_int, default_project_skills_suffix, default_tool_config_path, default_tool_skills_path,
    derive_project_id, int_to_bool, normalize_optional_path, normalize_project_path,
    normalize_tool_skills_path, now_iso,
};
use super::persistence::{count_enabled_targets_for_project, count_enabled_targets_for_tool};
use super::{
    P1LocalState, ProjectConfigInputPayload, ProjectConfigPayload, ToolConfigInputPayload,
    ToolConfigPayload, ValidateTargetPathPayload,
};

pub(super) fn save_tool_config(
    state: &P1LocalState,
    input: ToolConfigInputPayload,
) -> Result<ToolConfigPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    refresh_builtin_tool_configs(&conn)?;
    let adapter = builtin_adapters()
        .into_iter()
        .find(|candidate| candidate.tool_id.as_str() == input.tool_id)
        .ok_or_else(|| format!("unknown tool adapter: {}", input.tool_id))?;
    let skills_path = normalize_tool_skills_path(&adapter, &input.skills_path)?;
    let config_path = normalize_optional_path(&input.config_path);
    let display_name = if adapter.tool_id == AdapterID::CustomDirectory {
        input
            .name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(adapter.display_name.as_str())
            .to_string()
    } else {
        adapter.display_name.clone()
    };
    let now = now_iso();
    conn.execute(
        "
        INSERT INTO tool_configs (
          tool_id, display_name, adapter_status, detected_path, configured_path, skills_path,
          enabled, detection_method, transform_strategy, last_scanned_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT(tool_id) DO UPDATE SET
          display_name = excluded.display_name,
          configured_path = excluded.configured_path,
          skills_path = excluded.skills_path,
          enabled = excluded.enabled,
          detection_method = excluded.detection_method,
          transform_strategy = excluded.transform_strategy,
          updated_at = excluded.updated_at
        ",
        params![
            adapter.tool_id.as_str(),
            &display_name,
            "manual",
            Option::<String>::None,
            config_path,
            skills_path.to_string_lossy().to_string(),
            bool_to_int(input.enabled.unwrap_or(true)),
            "manual",
            adapter.transform_strategy.as_str(),
            &now,
        ],
    )
    .map_err(|error| error.to_string())?;
    refresh_builtin_tool_configs(&conn)?;
    load_tool_config_payload(&conn, adapter.tool_id.as_str()).map_err(|error| error.to_string())
}

pub(super) fn save_project_config(
    state: &P1LocalState,
    input: ProjectConfigInputPayload,
) -> Result<ProjectConfigPayload, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    let project_path = normalize_project_path(&input.project_path)?;
    let skills_path = if input.skills_path.trim().is_empty() {
        project_path.join(default_project_skills_suffix())
    } else {
        normalize_project_path(&input.skills_path)?
    };
    validate_distribution_target_path(ValidateTargetPathRequest {
        path: skills_path.clone(),
    })
    .map_err(|error| error.to_string())?;
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

pub(super) fn validate_target_path(path: String) -> Result<ValidateTargetPathPayload, String> {
    match validate_distribution_target_path(ValidateTargetPathRequest {
        path: PathBuf::from(path),
    }) {
        Ok(result) => Ok(ValidateTargetPathPayload {
            valid: true,
            writable: result.writable,
            exists: result.exists,
            can_create: result.can_create,
            reason: None,
        }),
        Err(error) => Ok(ValidateTargetPathPayload {
            valid: false,
            writable: false,
            exists: false,
            can_create: false,
            reason: Some(error.to_string()),
        }),
    }
}

pub(super) fn detect_tools_from_conn(
    conn: &Connection,
) -> rusqlite::Result<Vec<ToolConfigPayload>> {
    builtin_adapters()
        .into_iter()
        .map(|adapter| load_tool_config_payload(conn, adapter.tool_id.as_str()))
        .collect()
}

pub(super) fn list_project_configs_from_conn(
    conn: &Connection,
) -> rusqlite::Result<Vec<ProjectConfigPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT project_id, display_name, project_path, skills_path, enabled, created_at, updated_at
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
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub(super) fn load_project_config(
    conn: &Connection,
    project_id: &str,
) -> rusqlite::Result<ProjectConfigPayload> {
    conn.query_row(
        "
        SELECT project_id, display_name, project_path, skills_path, enabled, created_at, updated_at
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
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        },
    )
}

#[derive(Debug, Clone)]
struct StoredToolConfigRow {
    tool_id: String,
    display_name: String,
    configured_path: Option<String>,
    skills_path: Option<String>,
    enabled: bool,
    detection_method: Option<String>,
    last_scanned_at: Option<String>,
}

fn load_saved_tool_configs(
    conn: &Connection,
) -> rusqlite::Result<HashMap<String, StoredToolConfigRow>> {
    let mut statement = conn.prepare(
        "
        SELECT tool_id, display_name, configured_path, skills_path,
               enabled, detection_method, last_scanned_at
        FROM tool_configs
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(StoredToolConfigRow {
            tool_id: row.get(0)?,
            display_name: row.get(1)?,
            configured_path: row.get(2)?,
            skills_path: row.get(3)?,
            enabled: int_to_bool(row.get(4)?),
            detection_method: row.get(5)?,
            last_scanned_at: row.get(6)?,
        })
    })?;
    let mut configs = HashMap::new();
    for row in rows {
        let row = row?;
        configs.insert(row.tool_id.clone(), row);
    }
    Ok(configs)
}

pub(super) fn refresh_builtin_tool_configs(conn: &Connection) -> Result<(), String> {
    let existing = load_saved_tool_configs(conn).map_err(|error| error.to_string())?;
    let now = now_iso();
    for adapter in builtin_adapters() {
        let saved = existing.get(adapter.tool_id.as_str());
        let manual_skills_path = saved
            .and_then(|row| row.skills_path.clone())
            .filter(|_| saved.and_then(|row| row.detection_method.as_deref()) == Some("manual"));
        let auto_detection = detect_adapter(&adapter, None);
        let current_detection =
            detect_adapter(&adapter, manual_skills_path.as_ref().map(PathBuf::from));
        let enabled = saved.map(|row| row.enabled).unwrap_or(adapter.enabled);
        let adapter_status = if enabled {
            current_detection.status.as_str().to_string()
        } else {
            "disabled".to_string()
        };
        let display_name = if adapter.tool_id == AdapterID::CustomDirectory {
            saved
                .map(|row| row.display_name.clone())
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| adapter.display_name.clone())
        } else {
            adapter.display_name.clone()
        };
        let resolved_skills_path = manual_skills_path
            .clone()
            .or_else(|| {
                current_detection
                    .detected_path
                    .as_ref()
                    .map(|path| path.to_string_lossy().to_string())
            })
            .or_else(|| default_tool_skills_path(&adapter))
            .unwrap_or_default();
        conn.execute(
            "
            INSERT INTO tool_configs (
              tool_id, display_name, adapter_status, detected_path, configured_path, skills_path,
              enabled, detection_method, transform_strategy, last_scanned_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(tool_id) DO UPDATE SET
              display_name = excluded.display_name,
              adapter_status = excluded.adapter_status,
              detected_path = excluded.detected_path,
              configured_path = COALESCE(tool_configs.configured_path, excluded.configured_path),
              skills_path = excluded.skills_path,
              enabled = excluded.enabled,
              detection_method = excluded.detection_method,
              transform_strategy = excluded.transform_strategy,
              last_scanned_at = COALESCE(tool_configs.last_scanned_at, excluded.last_scanned_at),
              updated_at = excluded.updated_at
            ",
            params![
                adapter.tool_id.as_str(),
                &display_name,
                adapter_status,
                auto_detection
                    .detected_path
                    .as_ref()
                    .map(|path| path.to_string_lossy().to_string()),
                saved.and_then(|row| row.configured_path.clone()),
                resolved_skills_path,
                bool_to_int(enabled),
                if manual_skills_path.is_some() {
                    "manual".to_string()
                } else {
                    current_detection.detection_method.as_str().to_string()
                },
                adapter.transform_strategy.as_str(),
                saved.and_then(|row| row.last_scanned_at.clone()),
                &now,
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub(super) fn load_tool_config_payload(
    conn: &Connection,
    tool_id: &str,
) -> rusqlite::Result<ToolConfigPayload> {
    let adapter = builtin_adapters()
        .into_iter()
        .find(|candidate| candidate.tool_id.as_str() == tool_id)
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;
    conn.query_row(
        "
        SELECT tool_id, display_name, adapter_status, detected_path, configured_path, skills_path,
               enabled, detection_method, transform_strategy, last_scanned_at
        FROM tool_configs
        WHERE tool_id = ?
        ",
        [tool_id],
        |row| {
            let tool_id: String = row.get(0)?;
            let display_name: String = row.get(1)?;
            let detected_path: Option<String> = row.get(3)?;
            let configured_path: Option<String> = row.get(4)?;
            let transform_strategy: String = row.get(8)?;
            Ok(ToolConfigPayload {
                tool_id: tool_id.clone(),
                name: display_name.clone(),
                display_name,
                config_path: configured_path
                    .clone()
                    .or_else(|| default_tool_config_path(&adapter))
                    .unwrap_or_default(),
                detected_path,
                configured_path,
                skills_path: row.get(5)?,
                enabled: int_to_bool(row.get(6)?),
                status: row.get(2)?,
                adapter_status: row.get(2)?,
                detection_method: row
                    .get::<_, Option<String>>(7)?
                    .unwrap_or_else(|| "manual".to_string()),
                transform: transform_strategy.clone(),
                transform_strategy,
                enabled_skill_count: count_enabled_targets_for_tool(conn, &tool_id)?,
                last_scanned_at: row.get(9)?,
            })
        },
    )
}
