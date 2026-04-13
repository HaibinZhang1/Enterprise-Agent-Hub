use std::path::PathBuf;
#[cfg(windows)]
use std::process::Command;

use super::config::{AdapterConfig, DetectionMethod};
use super::path_validation::validate_target_path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdapterStatus {
    Detected,
    Manual,
    Missing,
    Invalid,
    Disabled,
}

impl AdapterStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Detected => "detected",
            Self::Manual => "manual",
            Self::Missing => "missing",
            Self::Invalid => "invalid",
            Self::Disabled => "disabled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectionResult {
    pub tool_id: String,
    pub status: AdapterStatus,
    pub detection_method: DetectionMethod,
    pub detected_path: Option<PathBuf>,
    pub reason: Option<String>,
}

pub fn detect_adapter(adapter: &AdapterConfig, manual_path: Option<PathBuf>) -> DetectionResult {
    if !adapter.enabled {
        return result(
            adapter,
            AdapterStatus::Disabled,
            DetectionMethod::Manual,
            None,
            None,
        );
    }

    if let Some(path) = manual_path {
        return match validate_target_path(&path) {
            Ok(_) => result(
                adapter,
                AdapterStatus::Manual,
                DetectionMethod::Manual,
                Some(path),
                None,
            ),
            Err(error) => result(
                adapter,
                AdapterStatus::Invalid,
                DetectionMethod::Manual,
                Some(path),
                Some(error.to_string()),
            ),
        };
    }

    if adapter
        .detection
        .methods
        .contains(&DetectionMethod::Registry)
    {
        if let Some(path) = detect_registry_path(adapter) {
            return match validate_target_path(&path) {
                Ok(_) => result(
                    adapter,
                    AdapterStatus::Detected,
                    DetectionMethod::Registry,
                    Some(path),
                    None,
                ),
                Err(error) => result(
                    adapter,
                    AdapterStatus::Invalid,
                    DetectionMethod::Registry,
                    Some(path),
                    Some(error.to_string()),
                ),
            };
        }
    }

    if adapter
        .detection
        .methods
        .contains(&DetectionMethod::DefaultPath)
    {
        for candidate in &adapter.detection.default_paths {
            let expanded = expand_windows_user_profile(candidate);
            if expanded.exists() {
                return match validate_target_path(&expanded) {
                    Ok(_) => result(
                        adapter,
                        AdapterStatus::Detected,
                        DetectionMethod::DefaultPath,
                        Some(expanded),
                        None,
                    ),
                    Err(error) => result(
                        adapter,
                        AdapterStatus::Invalid,
                        DetectionMethod::DefaultPath,
                        Some(expanded),
                        Some(error.to_string()),
                    ),
                };
            }
        }
    }

    result(
        adapter,
        AdapterStatus::Missing,
        DetectionMethod::DefaultPath,
        None,
        Some("no registry/default path match; manual configuration is allowed".to_string()),
    )
}

#[cfg(windows)]
fn detect_registry_path(adapter: &AdapterConfig) -> Option<PathBuf> {
    let search_terms = registry_search_terms(adapter);
    for root in uninstall_registry_roots() {
        if let Some(path) = query_registry_root_for_tool(root, &search_terms) {
            return Some(path);
        }
    }
    None
}

#[cfg(not(windows))]
fn detect_registry_path(_adapter: &AdapterConfig) -> Option<PathBuf> {
    None
}

#[cfg(windows)]
fn uninstall_registry_roots() -> [&'static str; 3] {
    [
        r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall",
        r"HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ]
}

#[cfg(windows)]
fn registry_search_terms(adapter: &AdapterConfig) -> Vec<String> {
    let mut terms = adapter.detection.registry_keys.clone();
    if terms.is_empty() {
        terms.push(adapter.display_name.to_ascii_lowercase());
        terms.push(adapter.tool_id.as_str().to_ascii_lowercase());
    }
    terms.sort();
    terms.dedup();
    terms
}

#[cfg(windows)]
fn query_registry_root_for_tool(root: &str, search_terms: &[String]) -> Option<PathBuf> {
    let output = Command::new("reg")
        .args(["query", root, "/s", "/v", "DisplayName"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut current_key: Option<String> = None;
    for raw_line in stdout.lines() {
        let line = raw_line.trim();
        if line.starts_with("HKEY_") {
            current_key = Some(line.to_string());
            continue;
        }
        if !line.contains("DisplayName") {
            continue;
        }
        let display_name = parse_registry_value_data(line)?;
        let normalized = display_name.to_ascii_lowercase();
        if !search_terms.iter().any(|term| normalized.contains(term)) {
            continue;
        }
        let key = current_key.clone()?;
        if let Some(path) = query_registry_value_path(&key, "InstallLocation") {
            return Some(path);
        }
        if let Some(path) = query_registry_value_path(&key, "DisplayIcon") {
            return Some(path);
        }
    }
    None
}

#[cfg(windows)]
fn query_registry_value_path(key: &str, value_name: &str) -> Option<PathBuf> {
    let output = Command::new("reg")
        .args(["query", key, "/v", value_name])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    for raw_line in stdout.lines() {
        let line = raw_line.trim();
        if !line.starts_with(value_name) {
            continue;
        }
        let value = parse_registry_value_data(line)?;
        let cleaned = value.trim_matches('"').split(',').next()?.trim();
        let path = PathBuf::from(cleaned);
        if path.is_file() {
            return path.parent().map(|parent| parent.to_path_buf());
        }
        if !cleaned.is_empty() {
            return Some(path);
        }
    }
    None
}

#[cfg(windows)]
fn parse_registry_value_data(line: &str) -> Option<String> {
    const REG_MARKERS: [&str; 5] = ["REG_SZ", "REG_EXPAND_SZ", "REG_MULTI_SZ", "REG_DWORD", "REG_QWORD"];
    for marker in REG_MARKERS {
        if let Some((_, value)) = line.split_once(marker) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }
    None
}

pub fn expand_windows_user_profile(template: &str) -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| "%USERPROFILE%".to_string());
    PathBuf::from(template.replace("%USERPROFILE%", &home))
}

fn result(
    adapter: &AdapterConfig,
    status: AdapterStatus,
    detection_method: DetectionMethod,
    detected_path: Option<PathBuf>,
    reason: Option<String>,
) -> DetectionResult {
    DetectionResult {
        tool_id: adapter.tool_id.as_str().to_string(),
        status,
        detection_method,
        detected_path,
        reason,
    }
}
