use std::path::PathBuf;
#[cfg(windows)]
use std::process::Command;

use super::config::{AdapterConfig, DetectionMethod, Platform, ResolvedAdapterConfig};
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionPathState {
    Existing,
    Creatable,
    MissingConfigurable,
    InvalidUnwritable,
    ManualRequired,
}

impl DetectionPathState {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectionResult {
    pub tool_id: String,
    pub status: AdapterStatus,
    pub detection_method: DetectionMethod,
    pub detected_path: Option<PathBuf>,
    pub reason: Option<String>,
    pub path_state: DetectionPathState,
}

pub fn detect_adapter(adapter: &AdapterConfig, manual_path: Option<PathBuf>) -> DetectionResult {
    detect_adapter_for_platform(adapter, manual_path, Platform::current())
}

pub fn detect_adapter_for_platform(
    adapter: &AdapterConfig,
    manual_path: Option<PathBuf>,
    platform: Platform,
) -> DetectionResult {
    let resolved = adapter.resolve(platform);

    if !resolved.enabled {
        return result(
            &resolved,
            AdapterStatus::Disabled,
            DetectionMethod::Manual,
            None,
            None,
            DetectionPathState::ManualRequired,
        );
    }

    if adapter.is_manual_only_for(platform) && manual_path.is_none() {
        return result(
            &resolved,
            AdapterStatus::Manual,
            DetectionMethod::Manual,
            None,
            Some("manual path is required for this adapter".to_string()),
            DetectionPathState::ManualRequired,
        );
    }

    if let Some(path) = manual_path {
        return match validate_target_path(&path) {
            Ok(_) => result(
                &resolved,
                AdapterStatus::Manual,
                DetectionMethod::Manual,
                Some(path.clone()),
                None,
                if path.exists() {
                    DetectionPathState::Existing
                } else {
                    DetectionPathState::Creatable
                },
            ),
            Err(error) => result(
                &resolved,
                AdapterStatus::Invalid,
                DetectionMethod::Manual,
                Some(path),
                Some(error.to_string()),
                DetectionPathState::InvalidUnwritable,
            ),
        };
    }

    if resolved
        .detection
        .methods
        .contains(&DetectionMethod::Registry)
    {
        if let Some(path) = detect_registry_path(adapter, platform) {
            return match validate_target_path(&path) {
                Ok(_) => result(
                    &resolved,
                    AdapterStatus::Detected,
                    DetectionMethod::Registry,
                    Some(path),
                    None,
                    DetectionPathState::Existing,
                ),
                Err(error) => result(
                    &resolved,
                    AdapterStatus::Invalid,
                    DetectionMethod::Registry,
                    Some(path),
                    Some(error.to_string()),
                    DetectionPathState::InvalidUnwritable,
                ),
            };
        }
    }

    if resolved
        .detection
        .methods
        .contains(&DetectionMethod::DefaultPath)
    {
        let mut first_creatable: Option<PathBuf> = None;
        for candidate in &resolved.detection.default_paths {
            let expanded = expand_platform_path(candidate, platform);
            if expanded.exists() {
                return match validate_target_path(&expanded) {
                    Ok(_) => result(
                        &resolved,
                        AdapterStatus::Detected,
                        DetectionMethod::DefaultPath,
                        Some(expanded),
                        None,
                        DetectionPathState::Existing,
                    ),
                    Err(error) => result(
                        &resolved,
                        AdapterStatus::Invalid,
                        DetectionMethod::DefaultPath,
                        Some(expanded),
                        Some(error.to_string()),
                        DetectionPathState::InvalidUnwritable,
                    ),
                };
            }
            match validate_target_path(&expanded) {
                Ok(validation) if validation.can_create => {
                    if first_creatable.is_none() {
                        first_creatable = Some(validation.path);
                    }
                }
                Ok(_) => {}
                Err(error) => {
                    return result(
                        &resolved,
                        AdapterStatus::Invalid,
                        DetectionMethod::DefaultPath,
                        Some(expanded),
                        Some(error.to_string()),
                        DetectionPathState::InvalidUnwritable,
                    );
                }
            }
        }
        if let Some(path) = first_creatable {
            return result(
                &resolved,
                AdapterStatus::Missing,
                DetectionMethod::DefaultPath,
                None,
                Some(format!(
                    "default path is not created yet but can be configured: {}",
                    path.display()
                )),
                DetectionPathState::MissingConfigurable,
            );
        }
    }

    result(
        &resolved,
        AdapterStatus::Missing,
        DetectionMethod::DefaultPath,
        None,
        Some("no registry/default path match; manual configuration is allowed".to_string()),
        DetectionPathState::MissingConfigurable,
    )
}

#[cfg(windows)]
fn detect_registry_path(adapter: &AdapterConfig, platform: Platform) -> Option<PathBuf> {
    if platform != Platform::Windows {
        return None;
    }
    let search_terms = registry_search_terms(adapter);
    for root in uninstall_registry_roots() {
        if let Some(path) = query_registry_root_for_tool(root, &search_terms) {
            return Some(path);
        }
    }
    None
}

#[cfg(not(windows))]
fn detect_registry_path(_adapter: &AdapterConfig, _platform: Platform) -> Option<PathBuf> {
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
    const REG_MARKERS: [&str; 5] = [
        "REG_SZ",
        "REG_EXPAND_SZ",
        "REG_MULTI_SZ",
        "REG_DWORD",
        "REG_QWORD",
    ];
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

pub fn expand_platform_path(template: &str, platform: Platform) -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "~".to_string());
    let user_profile = std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())
        .unwrap_or_else(|| "%USERPROFILE%".to_string());
    let app_data = std::env::var("APPDATA")
        .ok()
        .or_else(|| {
            std::env::var("HOME")
                .ok()
                .map(|path| format!("{path}\\AppData\\Roaming"))
        })
        .unwrap_or_else(|| "%APPDATA%".to_string());
    let expanded = match platform {
        Platform::Windows => template
            .replace("%USERPROFILE%", &user_profile)
            .replace("%APPDATA%", &app_data),
        Platform::Macos => {
            if let Some(stripped) = template.strip_prefix("~/") {
                format!("{home}/{stripped}")
            } else if template == "~" {
                home
            } else {
                template.replace("%USERPROFILE%", &home)
            }
        }
    };
    PathBuf::from(expanded)
}

fn result(
    adapter: &ResolvedAdapterConfig,
    status: AdapterStatus,
    detection_method: DetectionMethod,
    detected_path: Option<PathBuf>,
    reason: Option<String>,
    path_state: DetectionPathState,
) -> DetectionResult {
    DetectionResult {
        tool_id: adapter.tool_id.as_str().to_string(),
        status,
        detection_method,
        detected_path,
        reason,
        path_state,
    }
}

#[cfg(test)]
mod tests {
    use super::super::config::{builtin_adapters, AdapterID, PlatformPathTable};
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn expands_platform_paths_for_windows_and_macos() {
        assert!(
            expand_platform_path("%USERPROFILE%\\.codex\\skills", Platform::Windows)
                .to_string_lossy()
                .contains(".codex")
        );
        let expanded = expand_platform_path("~/.codex/skills", Platform::Macos);
        assert!(expanded.to_string_lossy().ends_with(".codex/skills"));
        assert!(!expanded.to_string_lossy().contains('~'));
    }

    #[test]
    fn manual_only_adapter_reports_manual_required_without_fake_detection() {
        let adapter = builtin_adapters()
            .into_iter()
            .find(|candidate| candidate.tool_id == AdapterID::CustomDirectory)
            .expect("custom adapter");
        let result = detect_adapter_for_platform(&adapter, None, Platform::Macos);
        assert_eq!(result.status, AdapterStatus::Manual);
        assert_eq!(result.path_state, DetectionPathState::ManualRequired);
        assert!(result.detected_path.is_none());
    }

    #[test]
    fn mac_default_path_can_report_missing_configurable_without_detecting() {
        let temp = TestTemp::new("detect-adapter-macos");
        let missing_path = temp.path.join("macos").join(".codex").join("skills");
        fs::create_dir_all(missing_path.parent().expect("missing path parent")).unwrap();
        let mut adapter = builtin_adapters()
            .into_iter()
            .find(|candidate| candidate.tool_id == AdapterID::Codex)
            .expect("codex adapter");
        adapter.detection.default_paths = PlatformPathTable {
            windows: vec![],
            macos: vec![missing_path.to_string_lossy().to_string()],
        };

        let result = detect_adapter_for_platform(&adapter, None, Platform::Macos);
        assert_eq!(result.status, AdapterStatus::Missing);
        assert_eq!(result.path_state, DetectionPathState::MissingConfigurable);
        assert!(result.detected_path.is_none());
    }

    struct TestTemp {
        path: PathBuf,
    }

    impl TestTemp {
        fn new(name: &str) -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("eah-{name}-{nonce}"));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestTemp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
