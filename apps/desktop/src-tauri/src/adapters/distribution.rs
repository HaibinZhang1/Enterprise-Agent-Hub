use std::fs;
use std::path::{Path, PathBuf};

use super::config::InstallMode;
use super::errors::{AdapterError, AdapterResult};
use super::path_validation::ensure_target_root;
use super::transform::copy_dir;

pub const MANAGED_MARKER_FILE: &str = ".enterprise-agent-hub-managed.json";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DistributionOptions {
    pub allow_overwrite_target: bool,
    pub simulated_symlink_failure: Option<String>,
}

impl Default for DistributionOptions {
    fn default() -> Self {
        Self {
            allow_overwrite_target: false,
            simulated_symlink_failure: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DistributionOutcome {
    pub target_path: PathBuf,
    pub requested_mode: InstallMode,
    pub resolved_mode: InstallMode,
    pub fallback_reason: Option<String>,
}

pub fn enable_artifact(
    artifact_path: impl AsRef<Path>,
    target_root: impl AsRef<Path>,
    target_name: &str,
    requested_mode: InstallMode,
) -> AdapterResult<DistributionOutcome> {
    enable_artifact_with_options(
        artifact_path,
        target_root,
        target_name,
        requested_mode,
        DistributionOptions::default(),
    )
}

pub fn enable_artifact_with_options(
    artifact_path: impl AsRef<Path>,
    target_root: impl AsRef<Path>,
    target_name: &str,
    requested_mode: InstallMode,
    options: DistributionOptions,
) -> AdapterResult<DistributionOutcome> {
    let artifact_path = artifact_path.as_ref();
    let target_root = target_root.as_ref();
    if !artifact_path.is_dir() {
        return Err(AdapterError::MissingSkillSource(
            artifact_path.to_path_buf(),
        ));
    }

    ensure_target_root(target_root)?;
    let target_path = target_root.join(target_name);
    prepare_target(&target_path, options.allow_overwrite_target)?;

    match requested_mode {
        InstallMode::Copy => {
            copy_dir(artifact_path, &target_path)?;
            Ok(DistributionOutcome {
                target_path,
                requested_mode,
                resolved_mode: InstallMode::Copy,
                fallback_reason: None,
            })
        }
        InstallMode::Symlink => {
            if let Some(reason) = options.simulated_symlink_failure {
                copy_dir(artifact_path, &target_path)?;
                return Ok(DistributionOutcome {
                    target_path,
                    requested_mode,
                    resolved_mode: InstallMode::Copy,
                    fallback_reason: Some(reason),
                });
            }

            match create_dir_symlink(artifact_path, &target_path) {
                Ok(()) => Ok(DistributionOutcome {
                    target_path,
                    requested_mode,
                    resolved_mode: InstallMode::Symlink,
                    fallback_reason: None,
                }),
                Err(error) => {
                    let fallback_reason = normalize_symlink_error(&error);
                    prepare_target(&target_path, options.allow_overwrite_target)?;
                    copy_dir(artifact_path, &target_path)?;
                    Ok(DistributionOutcome {
                        target_path,
                        requested_mode,
                        resolved_mode: InstallMode::Copy,
                        fallback_reason: Some(fallback_reason),
                    })
                }
            }
        }
    }
}

pub fn disable_managed_target(path: impl AsRef<Path>) -> AdapterResult<()> {
    let path = path.as_ref();
    if !path.exists() && fs::symlink_metadata(path).is_err() {
        return Ok(());
    }

    let metadata = fs::symlink_metadata(path)
        .map_err(|error| AdapterError::io(format!("stat target {}", path.display()), error))?;
    if metadata.file_type().is_symlink() {
        fs::remove_file(path).map_err(|error| {
            AdapterError::io(format!("remove symlink {}", path.display()), error)
        })?;
        return Ok(());
    }

    if is_managed_copy(path) {
        fs::remove_dir_all(path).map_err(|error| {
            AdapterError::io(format!("remove target {}", path.display()), error)
        })?;
        return Ok(());
    }

    Err(AdapterError::UnmanagedTarget {
        path: path.to_path_buf(),
    })
}

pub fn is_managed_target(path: impl AsRef<Path>) -> bool {
    let path = path.as_ref();
    fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_symlink() || is_managed_copy(path))
        .unwrap_or(false)
}

fn is_managed_copy(path: &Path) -> bool {
    path.join(MANAGED_MARKER_FILE).is_file()
}

fn prepare_target(path: &Path, allow_overwrite_target: bool) -> AdapterResult<()> {
    if !path.exists() && fs::symlink_metadata(path).is_err() {
        return Ok(());
    }

    if allow_overwrite_target {
        remove_existing_target(path)?;
        return Ok(());
    }

    Err(AdapterError::TargetConflict {
        path: path.to_path_buf(),
    })
}

fn remove_existing_target(path: &Path) -> AdapterResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => fs::remove_file(path)
            .map_err(|error| AdapterError::io(format!("remove symlink {}", path.display()), error)),
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path)
            .map_err(|error| AdapterError::io(format!("remove target {}", path.display()), error)),
        Ok(_) => fs::remove_file(path)
            .map_err(|error| AdapterError::io(format!("remove file {}", path.display()), error)),
        Err(error) => Err(AdapterError::io(
            format!("stat target {}", path.display()),
            error,
        )),
    }
}

fn normalize_symlink_error(error: &std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => "symlink_permission_denied".to_string(),
        std::io::ErrorKind::AlreadyExists => "symlink_target_conflict".to_string(),
        std::io::ErrorKind::Unsupported => "symlink_unsupported".to_string(),
        _ => format!("symlink_failed:{}", error.kind()),
    }
}

#[cfg(unix)]
fn create_dir_symlink(source: &Path, target: &Path) -> std::io::Result<()> {
    std::os::unix::fs::symlink(source, target)
}

#[cfg(windows)]
fn create_dir_symlink(source: &Path, target: &Path) -> std::io::Result<()> {
    std::os::windows::fs::symlink_dir(source, target)
}

#[cfg(not(any(unix, windows)))]
fn create_dir_symlink(_source: &Path, _target: &Path) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "directory symlink is unsupported on this platform",
    ))
}
