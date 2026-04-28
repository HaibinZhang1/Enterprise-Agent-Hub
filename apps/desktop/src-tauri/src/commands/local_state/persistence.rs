use rusqlite::{params, Connection};

use crate::store::models::LocalSkillInstall;
use crate::store::sqlite::statements;

use super::pathing::{
    bool_to_int, int_to_bool, target_page_to_object_id, target_page_to_object_type,
};
use super::{
    EnabledTargetPayload, ExtensionInstallPayload, ExtensionManifestPayload,
    ExtensionPermissionPayload, LocalEventPayload, LocalNotificationPayload,
    LocalSkillInstallPayload, PluginTargetPayload,
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
            &install.source_type,
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

pub(super) fn ensure_local_skill_install_columns(conn: &Connection) -> rusqlite::Result<()> {
    let mut statement = conn.prepare("PRAGMA table_info(local_skill_installs)")?;
    let column_names = statement
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    if !column_names.iter().any(|name| name == "source_type") {
        conn.execute(
            "ALTER TABLE local_skill_installs ADD COLUMN source_type TEXT NOT NULL DEFAULT 'remote'",
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
        SELECT skill_id, display_name, local_version, local_hash, source_package_hash, source_type,
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
                source_type: row.get(5)?,
                installed_at: row.get(6)?,
                updated_at: row.get(7)?,
                local_status: row.get(8)?,
                central_store_path: row.get(9)?,
                enabled_targets: Vec::new(),
                has_update: int_to_bool(row.get(10)?),
                is_scope_restricted: int_to_bool(row.get(11)?),
                can_update: int_to_bool(row.get(12)?),
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
        SELECT skill_id, display_name, local_version, local_hash, source_package_hash, source_type,
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
            source_type: row.get(5)?,
            installed_at: row.get(6)?,
            updated_at: row.get(7)?,
            local_status: row.get(8)?,
            central_store_path: row.get(9)?,
            enabled_targets: Vec::new(),
            has_update: int_to_bool(row.get(10)?),
            is_scope_restricted: int_to_bool(row.get(11)?),
            can_update: int_to_bool(row.get(12)?),
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
        source_type: install.source_type,
        installed_at: install.installed_at,
        updated_at: install.updated_at,
        local_status: install.local_status.as_str().to_string(),
        central_store_path: install.central_store_path.to_string_lossy().to_string(),
        has_update: install.has_update,
        is_scope_restricted: install.is_scope_restricted,
        can_update: install.can_update,
    })
}

pub(super) fn sync_extension_read_models(conn: &Connection) -> rusqlite::Result<()> {
    let installs = list_local_installs_from_conn(conn)?;
    let permission = ExtensionPermissionPayload {
        id: "file_backed".to_string(),
        label: "文件部署".to_string(),
        risk_level: Some("low".to_string()),
        description: Some("通过既有 Adapter 分发为托管文件、符号链接或副本。".to_string()),
    };
    let permissions_json = serde_json::to_string(&vec![permission.clone()])
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;

    for install in &installs {
        let manifest = ExtensionManifestPayload {
            extension_id: install.skill_id.clone(),
            extension_type: "skill".to_string(),
            extension_kind: "file_backed".to_string(),
            display_name: install.display_name.clone(),
            version: install.local_version.clone(),
            description: Some("由现有 Skill 本地安装投影为 file-backed Extension。".to_string()),
            permissions: vec![permission.clone()],
            risk_level: "unknown".to_string(),
            audit_status: "unknown".to_string(),
        };
        let manifest_json = serde_json::to_string(&manifest)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        conn.execute(
            "
            INSERT INTO local_extension_installs (
              extension_id, extension_type, extension_kind, display_name, local_version,
              local_hash, source_type, source_uri, manifest_json, permissions_json,
              risk_level, audit_status, enterprise_status, central_store_path, installed_at, updated_at
            ) VALUES (?, 'skill', 'file_backed', ?, ?, ?, ?, NULL, ?, ?, 'unknown', 'unknown', 'allowed', ?, ?, ?)
            ON CONFLICT(extension_id) DO UPDATE SET
              extension_type = excluded.extension_type,
              extension_kind = excluded.extension_kind,
              display_name = excluded.display_name,
              local_version = excluded.local_version,
              local_hash = excluded.local_hash,
              source_type = excluded.source_type,
              source_uri = excluded.source_uri,
              manifest_json = excluded.manifest_json,
              permissions_json = excluded.permissions_json,
              risk_level = excluded.risk_level,
              audit_status = excluded.audit_status,
              central_store_path = excluded.central_store_path,
              installed_at = excluded.installed_at,
              updated_at = excluded.updated_at
            ",
            params![
                &install.skill_id,
                &install.display_name,
                &install.local_version,
                &install.local_hash,
                &install.source_type,
                manifest_json,
                &permissions_json,
                &install.central_store_path,
                &install.installed_at,
                &install.updated_at,
            ],
        )?;

        for target in &install.enabled_targets {
            upsert_plugin_target(conn, &plugin_target_from_enabled_target(target, None))?;
        }
    }

    sync_read_only_extension_seed_rows(conn)?;

    conn.execute(
        "
        DELETE FROM plugin_targets
        WHERE extension_kind = 'file_backed'
          AND extension_id NOT IN (SELECT skill_id FROM local_skill_installs)
        ",
        [],
    )?;
    conn.execute(
        "
        DELETE FROM local_extension_installs
        WHERE extension_kind = 'file_backed'
          AND extension_type = 'skill'
          AND extension_id NOT IN (SELECT skill_id FROM local_skill_installs)
        ",
        [],
    )?;
    Ok(())
}

struct ReadOnlyExtensionSeed<'a> {
    extension_id: &'a str,
    extension_type: &'a str,
    extension_kind: &'a str,
    display_name: &'a str,
    version: &'a str,
    description: &'a str,
    permission_id: &'a str,
    permission_label: &'a str,
    permission_description: &'a str,
    risk_level: &'a str,
    audit_status: &'a str,
}

fn sync_read_only_extension_seed_rows(conn: &Connection) -> rusqlite::Result<()> {
    let seeds = [
        ReadOnlyExtensionSeed {
            extension_id: "p0-mcp-server-precheck",
            extension_type: "mcp_server",
            extension_kind: "config_backed",
            display_name: "MCP Server 预检样例",
            version: "0.0.0-policy",
            description: "P0 仅展示 MCP Server 的审计/预检状态，不写入 MCP 配置。",
            permission_id: "config_read",
            permission_label: "配置读取",
            permission_description: "仅用于展示配置型扩展的权限声明。",
            risk_level: "medium",
            audit_status: "pending",
        },
        ReadOnlyExtensionSeed {
            extension_id: "p0-native-plugin-precheck",
            extension_type: "plugin",
            extension_kind: "native_plugin",
            display_name: "原生 Plugin 预检样例",
            version: "0.0.0-policy",
            description: "P0 仅展示原生 Plugin 的来源、风险和审计状态。",
            permission_id: "native_runtime",
            permission_label: "原生运行时",
            permission_description: "原生插件写入和加载在 P0 明确禁用。",
            risk_level: "high",
            audit_status: "warning",
        },
        ReadOnlyExtensionSeed {
            extension_id: "p0-hook-precheck",
            extension_type: "hook",
            extension_kind: "config_backed",
            display_name: "Hook 预检样例",
            version: "0.0.0-policy",
            description: "P0 仅展示 Hook 预检，不修改任何工具 hook 配置。",
            permission_id: "hook_config",
            permission_label: "Hook 配置",
            permission_description: "配置写入需要后续版本的快照、diff 和回滚保护。",
            risk_level: "medium",
            audit_status: "pending",
        },
        ReadOnlyExtensionSeed {
            extension_id: "p0-agent-cli-precheck",
            extension_type: "agent_cli",
            extension_kind: "agent_cli",
            display_name: "Agent CLI 预检样例",
            version: "0.0.0-policy",
            description: "P0 不安装外部 CLI 二进制，只展示 CLI 型扩展预检状态。",
            permission_id: "binary_install",
            permission_label: "外部二进制",
            permission_description: "自动安装外部 CLI 二进制在 P0 明确禁用。",
            risk_level: "high",
            audit_status: "pending",
        },
    ];

    for seed in seeds {
        let permissions = vec![ExtensionPermissionPayload {
            id: seed.permission_id.to_string(),
            label: seed.permission_label.to_string(),
            risk_level: Some(seed.risk_level.to_string()),
            description: Some(seed.permission_description.to_string()),
        }];
        let manifest = ExtensionManifestPayload {
            extension_id: seed.extension_id.to_string(),
            extension_type: seed.extension_type.to_string(),
            extension_kind: seed.extension_kind.to_string(),
            display_name: seed.display_name.to_string(),
            version: seed.version.to_string(),
            description: Some(seed.description.to_string()),
            permissions: permissions.clone(),
            risk_level: seed.risk_level.to_string(),
            audit_status: seed.audit_status.to_string(),
        };
        let manifest_json = serde_json::to_string(&manifest)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        let permissions_json = serde_json::to_string(&permissions)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
        conn.execute(
            "
            INSERT INTO local_extension_installs (
              extension_id, extension_type, extension_kind, display_name, local_version,
              local_hash, source_type, source_uri, manifest_json, permissions_json,
              risk_level, audit_status, enterprise_status, central_store_path, installed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'policy', 'policy://plugin-central-management/p0', ?, ?, ?, ?, 'allowed', NULL, datetime('now'), datetime('now'))
            ON CONFLICT(extension_id) DO UPDATE SET
              extension_type = excluded.extension_type,
              extension_kind = excluded.extension_kind,
              display_name = excluded.display_name,
              local_version = excluded.local_version,
              local_hash = excluded.local_hash,
              source_type = excluded.source_type,
              source_uri = excluded.source_uri,
              manifest_json = excluded.manifest_json,
              permissions_json = excluded.permissions_json,
              risk_level = excluded.risk_level,
              audit_status = excluded.audit_status,
              updated_at = excluded.updated_at
            ",
            params![
                seed.extension_id,
                seed.extension_type,
                seed.extension_kind,
                seed.display_name,
                seed.version,
                format!("sha256:readonly-{}", seed.extension_id),
                manifest_json,
                permissions_json,
                seed.risk_level,
                seed.audit_status,
            ],
        )?;
    }
    Ok(())
}

pub(super) fn plugin_target_from_enabled_target(
    target: &EnabledTargetPayload,
    denial_reason: Option<String>,
) -> PluginTargetPayload {
    PluginTargetPayload {
        id: target.id.clone(),
        extension_id: target.skill_id.clone(),
        extension_type: "skill".to_string(),
        extension_kind: "file_backed".to_string(),
        target_type: target.target_type.clone(),
        target_agent: target.target_id.clone(),
        target_id: target.target_id.clone(),
        target_name: target.target_name.clone(),
        target_path: Some(target.target_path.clone()),
        artifact_path: Some(target.artifact_path.clone()),
        config_path: None,
        requested_mode: Some(target.requested_mode.clone()),
        resolved_mode: Some(target.resolved_mode.clone()),
        fallback_reason: target.fallback_reason.clone(),
        artifact_hash: Some(target.artifact_hash.clone()),
        status: target.status.clone(),
        denial_reason,
        enabled_at: Some(target.enabled_at.clone()),
        updated_at: target.updated_at.clone(),
    }
}

pub(super) fn upsert_plugin_target(
    conn: &Connection,
    target: &PluginTargetPayload,
) -> rusqlite::Result<()> {
    conn.execute(
        "
        INSERT INTO plugin_targets (
          id, extension_id, extension_type, extension_kind, target_type, target_agent,
          target_id, target_name, target_path, artifact_path, config_path, requested_mode,
          resolved_mode, fallback_reason, artifact_hash, status, denial_reason, enabled_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(extension_id, target_type, target_id) DO UPDATE SET
          target_agent = excluded.target_agent,
          target_name = excluded.target_name,
          target_path = excluded.target_path,
          artifact_path = excluded.artifact_path,
          config_path = excluded.config_path,
          requested_mode = excluded.requested_mode,
          resolved_mode = excluded.resolved_mode,
          fallback_reason = excluded.fallback_reason,
          artifact_hash = excluded.artifact_hash,
          status = excluded.status,
          denial_reason = excluded.denial_reason,
          enabled_at = excluded.enabled_at,
          updated_at = excluded.updated_at
        ",
        params![
            &target.id,
            &target.extension_id,
            &target.extension_type,
            &target.extension_kind,
            &target.target_type,
            &target.target_agent,
            &target.target_id,
            &target.target_name,
            &target.target_path,
            &target.artifact_path,
            &target.config_path,
            &target.requested_mode,
            &target.resolved_mode,
            &target.fallback_reason,
            &target.artifact_hash,
            &target.status,
            &target.denial_reason,
            &target.enabled_at,
            &target.updated_at,
        ],
    )?;
    Ok(())
}

pub(super) fn update_plugin_target_status(
    conn: &Connection,
    extension_id: &str,
    target_type: &str,
    target_id: &str,
    status: &str,
    denial_reason: Option<String>,
    updated_at: &str,
) -> rusqlite::Result<PluginTargetPayload> {
    conn.execute(
        "
        UPDATE plugin_targets
        SET status = ?, denial_reason = ?, updated_at = ?
        WHERE extension_id = ? AND target_type = ? AND target_id = ?
        ",
        params![
            status,
            denial_reason,
            updated_at,
            extension_id,
            target_type,
            target_id
        ],
    )?;
    load_plugin_target(conn, extension_id, target_type, target_id)
}

pub(super) fn load_plugin_target(
    conn: &Connection,
    extension_id: &str,
    target_type: &str,
    target_id: &str,
) -> rusqlite::Result<PluginTargetPayload> {
    conn.query_row(
        "
        SELECT id, extension_id, extension_type, extension_kind, target_type, target_agent,
               target_id, target_name, target_path, artifact_path, config_path, requested_mode,
               resolved_mode, fallback_reason, artifact_hash, status, denial_reason, enabled_at, updated_at
        FROM plugin_targets
        WHERE extension_id = ? AND target_type = ? AND target_id = ?
        ",
        params![extension_id, target_type, target_id],
        plugin_target_from_row,
    )
}

pub(super) fn load_extension_install_row(
    conn: &Connection,
    extension_id: &str,
) -> rusqlite::Result<ExtensionInstallPayload> {
    sync_extension_read_models(conn)?;
    let mut install = conn.query_row(
        "
        SELECT extension_id, extension_type, extension_kind, display_name, local_version,
               local_hash, source_type, source_uri, manifest_json, permissions_json,
               risk_level, audit_status, enterprise_status, central_store_path, installed_at, updated_at
        FROM local_extension_installs
        WHERE extension_id = ?
        ",
        [extension_id],
        extension_install_from_row,
    )?;
    install.targets = load_plugin_targets_for_extension(conn, &install.extension_id)?;
    Ok(install)
}

pub(super) fn list_extension_installs_from_conn(
    conn: &Connection,
) -> rusqlite::Result<Vec<ExtensionInstallPayload>> {
    sync_extension_read_models(conn)?;
    let mut statement = conn.prepare(
        "
        SELECT extension_id, extension_type, extension_kind, display_name, local_version,
               local_hash, source_type, source_uri, manifest_json, permissions_json,
               risk_level, audit_status, enterprise_status, central_store_path, installed_at, updated_at
        FROM local_extension_installs
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map([], extension_install_from_row)?;
    let mut installs = Vec::new();
    for row in rows {
        let mut install = row?;
        install.targets = load_plugin_targets_for_extension(conn, &install.extension_id)?;
        installs.push(install);
    }
    Ok(installs)
}

fn extension_install_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ExtensionInstallPayload> {
    let extension_id: String = row.get(0)?;
    let extension_type: String = row.get(1)?;
    let extension_kind: String = row.get(2)?;
    let manifest_json: String = row.get(8)?;
    let permissions_json: String = row.get(9)?;
    let manifest =
        serde_json::from_str::<ExtensionManifestPayload>(&manifest_json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                8,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?;
    let permissions = serde_json::from_str::<Vec<ExtensionPermissionPayload>>(&permissions_json)
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                9,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?;
    Ok(ExtensionInstallPayload {
        extension_id: extension_id.clone(),
        extension_type: extension_type.clone(),
        extension_kind: extension_kind.clone(),
        display_name: row.get(3)?,
        local_version: row.get(4)?,
        local_hash: row.get(5)?,
        source_type: row.get(6)?,
        source_uri: row.get(7)?,
        manifest,
        permissions,
        risk_level: row.get(10)?,
        audit_status: row.get(11)?,
        enterprise_status: row.get(12)?,
        central_store_path: row.get(13)?,
        installed_at: row.get(14)?,
        updated_at: row.get(15)?,
        write_capability: extension_type == "skill" && extension_kind == "file_backed",
        targets: Vec::new(),
    })
}

fn load_plugin_targets_for_extension(
    conn: &Connection,
    extension_id: &str,
) -> rusqlite::Result<Vec<PluginTargetPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT id, extension_id, extension_type, extension_kind, target_type, target_agent,
               target_id, target_name, target_path, artifact_path, config_path, requested_mode,
               resolved_mode, fallback_reason, artifact_hash, status, denial_reason, enabled_at, updated_at
        FROM plugin_targets
        WHERE extension_id = ?
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map([extension_id], plugin_target_from_row)?;
    rows.collect()
}

fn plugin_target_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<PluginTargetPayload> {
    Ok(PluginTargetPayload {
        id: row.get(0)?,
        extension_id: row.get(1)?,
        extension_type: row.get(2)?,
        extension_kind: row.get(3)?,
        target_type: row.get(4)?,
        target_agent: row.get(5)?,
        target_id: row.get(6)?,
        target_name: row.get(7)?,
        target_path: row.get(8)?,
        artifact_path: row.get(9)?,
        config_path: row.get(10)?,
        requested_mode: row.get(11)?,
        resolved_mode: row.get(12)?,
        fallback_reason: row.get(13)?,
        artifact_hash: row.get(14)?,
        status: row.get(15)?,
        denial_reason: row.get(16)?,
        enabled_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}
