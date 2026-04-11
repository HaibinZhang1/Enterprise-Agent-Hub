use std::path::PathBuf;

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
        return result(adapter, AdapterStatus::Disabled, DetectionMethod::Manual, None, None);
    }

    if let Some(path) = manual_path {
        return match validate_target_path(&path) {
            Ok(_) => result(adapter, AdapterStatus::Manual, DetectionMethod::Manual, Some(path), None),
            Err(error) => result(
                adapter,
                AdapterStatus::Invalid,
                DetectionMethod::Manual,
                Some(path),
                Some(error.to_string()),
            ),
        };
    }

    if adapter.detection.methods.contains(&DetectionMethod::DefaultPath) {
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
