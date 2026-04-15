use rusqlite::{params, Connection};

use crate::store::models::LocalSkillInstall;
use crate::store::sqlite::statements;

use super::pathing::{
    bool_to_int, int_to_bool, target_page_to_object_id, target_page_to_object_type,
};
use super::{
    EnabledTargetPayload, LocalEventPayload, LocalNotificationPayload, LocalSkillInstallPayload,
};

pub(super) fn upsert_local_install(
    conn: &Connection,
    install: &LocalSkillInstall,
) -> rusqlite::Result<()> {
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

pub(super) fn upsert_enabled_target(
    conn: &Connection,
    target: &EnabledTargetPayload,
) -> rusqlite::Result<()> {
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

pub(super) fn upsert_local_notification(
    conn: &Connection,
    notification: &LocalNotificationPayload,
) -> rusqlite::Result<()> {
    conn.execute(
        statements::UPSERT_LOCAL_NOTIFICATION,
        params![
            &notification.notification_id,
            &notification.notification_type,
            &notification.title,
            &notification.summary,
            target_page_to_object_type(&notification.target_page),
            target_page_to_object_id(
                &notification.target_page,
                notification.related_skill_id.clone()
            ),
            &notification.related_skill_id,
            &notification.target_page,
            &notification.source,
            if notification.unread {
                None::<String>
            } else {
                Some(notification.occurred_at.clone())
            },
            &notification.occurred_at,
        ],
    )?;
    Ok(())
}

pub(super) fn insert_offline_event(
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

pub(super) fn load_pending_offline_events(
    conn: &Connection,
) -> rusqlite::Result<Vec<LocalEventPayload>> {
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
        serde_json::from_str::<LocalEventPayload>(&payload).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })
    })?;
    rows.collect()
}

pub(super) fn load_local_notifications(
    conn: &Connection,
) -> rusqlite::Result<Vec<LocalNotificationPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT notification_id, type, title, summary, related_skill_id, target_page, created_at, read_at, source
        FROM local_notifications
        ORDER BY created_at DESC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(LocalNotificationPayload {
            notification_id: row.get(0)?,
            notification_type: row.get(1)?,
            title: row.get(2)?,
            summary: row.get(3)?,
            related_skill_id: row.get(4)?,
            target_page: row.get(5)?,
            occurred_at: row.get(6)?,
            unread: row.get::<_, Option<String>>(7)?.is_none(),
            source: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub(super) fn ensure_local_notification_cache_columns(conn: &Connection) -> rusqlite::Result<()> {
    let mut statement = conn.prepare("PRAGMA table_info(local_notifications)")?;
    let column_names = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    if !column_names.iter().any(|name| name == "related_skill_id") {
        conn.execute(
            "ALTER TABLE local_notifications ADD COLUMN related_skill_id TEXT",
            [],
        )?;
    }
    if !column_names.iter().any(|name| name == "target_page") {
        conn.execute(
            "ALTER TABLE local_notifications ADD COLUMN target_page TEXT NOT NULL DEFAULT 'notifications'",
            [],
        )?;
    }
    if !column_names.iter().any(|name| name == "source") {
        conn.execute(
            "ALTER TABLE local_notifications ADD COLUMN source TEXT NOT NULL DEFAULT 'local'",
            [],
        )?;
    }

    Ok(())
}

pub(super) fn load_install_row(
    conn: &Connection,
    skill_id: &str,
) -> rusqlite::Result<LocalSkillInstallPayload> {
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

pub(super) fn load_enabled_targets(
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

pub(super) fn load_enabled_target(
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

pub(super) fn load_all_enabled_targets(
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

pub(super) fn load_enabled_targets_for_target(
    conn: &Connection,
    target_type: &str,
    target_id: &str,
) -> rusqlite::Result<Vec<EnabledTargetPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT id, skill_id, target_type, target_id, target_name, target_path, artifact_path,
               install_mode, requested_mode, resolved_mode, fallback_reason, artifact_hash,
               enabled_at, updated_at, status, last_error
        FROM enabled_targets
        WHERE target_type = ? AND target_id = ? AND status = 'enabled'
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map(params![target_type, target_id], |row| {
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

pub(super) fn count_enabled_targets_for_tool(
    conn: &Connection,
    tool_id: &str,
) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE target_type = 'tool' AND target_id = ? AND status = 'enabled'",
        [tool_id],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

pub(super) fn count_enabled_targets_for_project(
    conn: &Connection,
    project_id: &str,
) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE target_type = 'project' AND target_id = ? AND status = 'enabled'",
        [project_id],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

pub(super) fn count_pending_offline_events(conn: &Connection) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM offline_event_queue WHERE status = 'pending'",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

pub(super) fn count_unread_local_notifications(conn: &Connection) -> rusqlite::Result<u32> {
    let count = conn.query_row(
        "SELECT count(*) FROM local_notifications WHERE read_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    Ok(count as u32)
}

pub(super) fn refresh_install_status(
    conn: &Connection,
    skill_id: &str,
    updated_at: &str,
) -> rusqlite::Result<()> {
    let enabled_count = conn.query_row(
        "SELECT count(*) FROM enabled_targets WHERE skill_id = ? AND status = 'enabled'",
        [skill_id],
        |row| row.get::<_, i64>(0),
    )?;
    let status = if enabled_count > 0 {
        "enabled"
    } else {
        "installed"
    };
    conn.execute(
        "UPDATE local_skill_installs SET local_status = ?, updated_at = ? WHERE skill_id = ?",
        params![status, updated_at, skill_id],
    )?;
    Ok(())
}

pub(super) fn list_local_installs_from_conn(
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

pub(super) fn local_install_payload(
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
