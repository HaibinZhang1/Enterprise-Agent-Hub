use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

use super::checksum::hash_path;
use super::configuration::{derive_project_path_status, load_tool_config_payload};
use super::pathing::{int_to_bool, normalize_path_text, now_iso, resolve_project_adapter};
use super::persistence::{count_enabled_targets_for_project, load_enabled_targets_for_target};
use super::{
    P1LocalState, ProjectConfigPayload, ScanFindingCountsPayload, ScanFindingPayload,
    ScanTargetSummaryPayload,
};

pub(super) fn scan_local_targets(
    state: &P1LocalState,
) -> Result<Vec<ScanTargetSummaryPayload>, String> {
    let conn = state.open_connection().map_err(|error| error.to_string())?;
    scan_local_targets_from_conn(&conn)
}

pub(super) fn scan_local_targets_from_conn(
    conn: &Connection,
) -> Result<Vec<ScanTargetSummaryPayload>, String> {
    let scanned_at = now_iso();
    let mut targets = Vec::new();

    #[cfg(not(test))]
    let adapters = crate::adapters::builtin_adapters();
    #[cfg(test)]
    let adapters = crate::commands::distribution::adapters::builtin_adapters();

    for tool in adapters {
        let tool_config = load_tool_config_payload(conn, tool.tool_id.as_str())
            .map_err(|error| error.to_string())?;
        if !tool_config.enabled || tool_config.skills_path.trim().is_empty() {
            continue;
        }
        let findings = scan_target_root(
            conn,
            "tool",
            &tool_config.tool_id,
            &tool_config.display_name,
            &tool_config.skills_path,
        )?;
        conn.execute(
            "UPDATE tool_configs SET last_scanned_at = ?, updated_at = ? WHERE tool_id = ?",
            params![&scanned_at, &scanned_at, &tool_config.tool_id],
        )
        .map_err(|error| error.to_string())?;
        targets.push(ScanTargetSummaryPayload {
            id: format!("tool:{}", tool_config.tool_id),
            target_type: "tool".to_string(),
            target_id: tool_config.tool_id.clone(),
            target_name: tool_config.display_name,
            target_path: tool_config.skills_path,
            transform_strategy: tool_config.transform_strategy,
            scanned_at: scanned_at.clone(),
            counts: build_scan_counts(&findings),
            findings,
            last_error: None,
        });
    }

    for project in list_enabled_project_scan_targets(conn).map_err(|error| error.to_string())? {
        let transform_strategy = resolve_project_adapter(&project.skills_path)
            .map(|adapter| adapter.transform_strategy.as_str().to_string())
            .unwrap_or_else(|_| "generic_directory".to_string());
        let project_path = project.skills_path.clone();
        let findings = scan_target_root(
            conn,
            "project",
            &project.project_id,
            &project.display_name,
            &project_path,
        )?;
        targets.push(ScanTargetSummaryPayload {
            id: format!("project:{}", project.project_id),
            target_type: "project".to_string(),
            target_id: project.project_id,
            target_name: project.display_name,
            target_path: project_path,
            transform_strategy,
            scanned_at: scanned_at.clone(),
            counts: build_scan_counts(&findings),
            findings,
            last_error: None,
        });
    }

    Ok(targets)
}

fn scan_target_root(
    conn: &Connection,
    target_type: &str,
    target_id: &str,
    target_name: &str,
    target_root: &str,
) -> Result<Vec<ScanFindingPayload>, String> {
    let root = PathBuf::from(target_root);
    let expected_targets = load_enabled_targets_for_target(conn, target_type, target_id)
        .map_err(|error| error.to_string())?;
    let mut expected_by_path = HashMap::new();
    for expected in expected_targets {
        expected_by_path.insert(normalize_path_text(&expected.target_path), expected);
    }

    let mut findings = Vec::new();
    #[cfg(not(test))]
    let managed_marker_file = crate::adapters::MANAGED_MARKER_FILE;
    #[cfg(test)]
    let managed_marker_file = crate::commands::distribution::adapters::MANAGED_MARKER_FILE;

    if !root.exists() {
        for expected in expected_by_path.into_values() {
            findings.push(build_scan_finding(
                "orphan",
                Some(expected.skill_id),
                target_type,
                target_id,
                target_name,
                &expected.target_path,
                &relative_entry_name(&PathBuf::from(&expected.target_path), &root),
                None,
                None,
                "登记的启用目标不存在，需要重新启用或清理。",
            ));
        }
        return Ok(findings);
    }

    let entry_paths = collect_scan_entry_paths(&root)?;
    for entry_path in entry_paths {
        let normalized_entry_path = normalize_path_text(entry_path.to_string_lossy().as_ref());
        let checksum = hash_path(&entry_path).ok();
        let relative_path = relative_entry_name(&entry_path, &root);
        let import_metadata = read_import_metadata(&entry_path, &relative_path);
        let expected = expected_by_path.remove(&normalized_entry_path);
        let has_managed_marker = entry_path.join(managed_marker_file).is_file();
        let (kind, skill_id, message) = match expected {
            Some(expected) => {
                if checksum.as_deref() == Some(expected.artifact_hash.as_str()) {
                    (
                        "managed",
                        Some(expected.skill_id),
                        "目标内容与本地登记一致，处于托管状态。".to_string(),
                    )
                } else {
                    (
                        "conflict",
                        Some(expected.skill_id),
                        "目标内容与登记产物不一致，可能被手动修改或被其他流程覆盖。".to_string(),
                    )
                }
            }
            None if has_managed_marker => (
                "orphan",
                import_metadata
                    .as_ref()
                    .map(|metadata| metadata.skill_id.clone()),
                "发现带托管标记的目录，但本地启用登记不存在。".to_string(),
            ),
            None => (
                "unmanaged",
                import_metadata
                    .as_ref()
                    .map(|metadata| metadata.skill_id.clone()),
                if import_metadata.is_some() {
                    "发现未托管 Skill，可纳入 Central Store 管理。".to_string()
                } else {
                    "发现未托管目录，但根目录缺少 SKILL.md，仅在诊断中展示。".to_string()
                },
            ),
        };
        findings.push(build_scan_finding(
            kind,
            skill_id,
            target_type,
            target_id,
            target_name,
            entry_path.to_string_lossy().as_ref(),
            &relative_path,
            checksum,
            import_metadata,
            &message,
        ));
    }

    for expected in expected_by_path.into_values() {
        findings.push(build_scan_finding(
            "orphan",
            Some(expected.skill_id),
            target_type,
            target_id,
            target_name,
            &expected.target_path,
            &relative_entry_name(&PathBuf::from(&expected.target_path), &root),
            None,
            None,
            "登记的启用目标不存在，需要重新启用或清理。",
        ));
    }

    findings.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(findings)
}

fn collect_scan_entry_paths(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut entry_paths = Vec::new();
    let entries =
        fs::read_dir(root).map_err(|error| format!("scan {}: {error}", root.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("scan {}: {error}", root.display()))?;
        let entry_path = entry.path();
        let nested_skill_dirs = nested_skill_dirs(&entry_path)?;
        if nested_skill_dirs.is_empty() {
            entry_paths.push(entry_path);
        } else {
            entry_paths.extend(nested_skill_dirs);
        }
    }
    Ok(entry_paths)
}

fn nested_skill_dirs(entry_path: &Path) -> Result<Vec<PathBuf>, String> {
    if !entry_path.is_dir() || entry_path.join("SKILL.md").is_file() {
        return Ok(Vec::new());
    }
    let mut nested = Vec::new();
    let entries = fs::read_dir(entry_path)
        .map_err(|error| format!("scan {}: {error}", entry_path.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("scan {}: {error}", entry_path.display()))?;
        let child_path = entry.path();
        if child_path.is_dir() && child_path.join("SKILL.md").is_file() {
            nested.push(child_path);
        }
    }
    Ok(nested)
}

fn list_enabled_project_scan_targets(
    conn: &Connection,
) -> rusqlite::Result<Vec<ProjectConfigPayload>> {
    let mut statement = conn.prepare(
        "
        SELECT project_id, display_name, project_path, skills_path, enabled, created_at, updated_at
        FROM project_configs
        WHERE enabled = 1
        ORDER BY updated_at DESC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        let project_id: String = row.get(0)?;
        let project_path: String = row.get(2)?;
        let (project_path_status, project_path_status_reason) =
            derive_project_path_status(&project_path);
        Ok(ProjectConfigPayload {
            project_id: project_id.clone(),
            name: row.get(1)?,
            display_name: row.get(1)?,
            project_path,
            skills_path: row.get(3)?,
            project_path_status,
            project_path_status_reason,
            enabled: int_to_bool(row.get(4)?),
            enabled_skill_count: count_enabled_targets_for_project(conn, &project_id)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

fn build_scan_counts(findings: &[ScanFindingPayload]) -> ScanFindingCountsPayload {
    let mut counts = ScanFindingCountsPayload {
        managed: 0,
        unmanaged: 0,
        conflict: 0,
        orphan: 0,
    };
    for finding in findings {
        match finding.kind.as_str() {
            "managed" => counts.managed += 1,
            "unmanaged" => counts.unmanaged += 1,
            "conflict" => counts.conflict += 1,
            "orphan" => counts.orphan += 1,
            _ => {}
        }
    }
    counts
}

fn build_scan_finding(
    kind: &str,
    skill_id: Option<String>,
    target_type: &str,
    target_id: &str,
    target_name: &str,
    target_path: &str,
    relative_path: &str,
    checksum: Option<String>,
    import_metadata: Option<SkillImportMetadata>,
    message: &str,
) -> ScanFindingPayload {
    ScanFindingPayload {
        id: format!("{target_type}:{target_id}:{relative_path}"),
        kind: kind.to_string(),
        skill_id,
        target_type: target_type.to_string(),
        target_id: target_id.to_string(),
        target_name: target_name.to_string(),
        target_path: target_path.to_string(),
        relative_path: relative_path.to_string(),
        checksum,
        can_import: import_metadata.is_some() && kind == "unmanaged",
        import_display_name: import_metadata
            .as_ref()
            .map(|metadata| metadata.display_name.clone()),
        import_description: import_metadata
            .as_ref()
            .and_then(|metadata| metadata.description.clone()),
        import_version: import_metadata.map(|metadata| metadata.version),
        message: message.to_string(),
    }
}

#[derive(Debug, Clone)]
pub(super) struct SkillImportMetadata {
    pub skill_id: String,
    pub display_name: String,
    pub description: Option<String>,
    pub version: String,
}

pub(super) fn read_import_metadata(
    entry_path: &Path,
    relative_path: &str,
) -> Option<SkillImportMetadata> {
    let skill_md = entry_path.join("SKILL.md");
    if !skill_md.is_file() {
        return None;
    }
    let text = fs::read_to_string(skill_md).ok()?;
    let frontmatter = parse_frontmatter(&text);
    let raw_name = frontmatter
        .get("name")
        .cloned()
        .or_else(|| first_heading(&text))
        .unwrap_or_else(|| relative_path.to_string());
    let skill_id = sanitize_import_skill_id(
        frontmatter
            .get("name")
            .map(String::as_str)
            .unwrap_or(relative_path),
    );
    if skill_id.is_empty() {
        return None;
    }
    Some(SkillImportMetadata {
        skill_id,
        display_name: raw_name,
        description: frontmatter.get("description").cloned(),
        version: frontmatter
            .get("version")
            .cloned()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "0.0.0-local".to_string()),
    })
}

fn parse_frontmatter(text: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("---") {
        return values;
    }
    for line in lines {
        let line = line.trim();
        if line == "---" {
            break;
        }
        if let Some((key, value)) = line.split_once(':') {
            values.insert(
                key.trim().to_ascii_lowercase(),
                value
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string(),
            );
        }
    }
    values
}

fn first_heading(text: &str) -> Option<String> {
    text.lines()
        .find_map(|line| {
            line.trim()
                .strip_prefix("# ")
                .map(|value| value.trim().to_string())
        })
        .filter(|value| !value.is_empty())
}

pub(super) fn sanitize_import_skill_id(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn relative_entry_name(entry_path: &Path, target_root: &Path) -> String {
    entry_path
        .strip_prefix(target_root)
        .ok()
        .and_then(|path| path.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            entry_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
        })
        .replace('\\', "/")
}
