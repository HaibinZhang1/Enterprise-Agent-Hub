use std::ffi::OsStr;
use std::path::{Component, Path, PathBuf};

use super::errors::{AdapterError, AdapterResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathValidation {
    pub path: PathBuf,
    pub exists: bool,
    pub writable: bool,
    pub can_create: bool,
}

pub fn validate_target_path(path: impl AsRef<Path>) -> AdapterResult<PathValidation> {
    let path = path.as_ref();
    reject_ambiguous_path(path)?;

    let exists = path.exists();
    let writable = exists && is_writable(path);
    let can_create = if exists {
        writable
    } else {
        nearest_existing_parent(path).map_or(false, |parent| is_writable(&parent))
    };

    if !exists && !can_create {
        return Err(AdapterError::InvalidTargetPath {
            path: path.to_path_buf(),
            reason: "path does not exist and no writable parent directory was found".to_string(),
        });
    }

    Ok(PathValidation {
        path: path.to_path_buf(),
        exists,
        writable,
        can_create,
    })
}

pub fn ensure_target_root(path: impl AsRef<Path>) -> AdapterResult<()> {
    let path = path.as_ref();
    reject_ambiguous_path(path)?;
    if path.exists() {
        if !path.is_dir() {
            return Err(AdapterError::InvalidTargetPath {
                path: path.to_path_buf(),
                reason: "target root exists but is not a directory".to_string(),
            });
        }
        return Ok(());
    }

    std::fs::create_dir_all(path)
        .map_err(|error| AdapterError::io(format!("create target root {}", path.display()), error))
}

pub fn reject_ambiguous_path(path: &Path) -> AdapterResult<()> {
    if path.as_os_str().is_empty() {
        return Err(AdapterError::InvalidTargetPath {
            path: path.to_path_buf(),
            reason: "path is empty".to_string(),
        });
    }

    for component in path.components() {
        match component {
            Component::ParentDir => {
                return Err(AdapterError::InvalidTargetPath {
                    path: path.to_path_buf(),
                    reason: "parent-directory traversal is not allowed in target paths".to_string(),
                });
            }
            Component::Normal(value) if value == OsStr::new("") => {
                return Err(AdapterError::InvalidTargetPath {
                    path: path.to_path_buf(),
                    reason: "path contains an empty component".to_string(),
                });
            }
            _ => {}
        }
    }

    Ok(())
}

fn nearest_existing_parent(path: &Path) -> Option<PathBuf> {
    let mut current = path.parent();
    while let Some(parent) = current {
        if parent.exists() {
            return Some(parent.to_path_buf());
        }
        current = parent.parent();
    }
    None
}

fn is_writable(path: &Path) -> bool {
    if path.is_file() {
        return path
            .metadata()
            .map(|metadata| !metadata.permissions().readonly())
            .unwrap_or(false);
    }

    path.metadata()
        .map(|metadata| !metadata.permissions().readonly())
        .unwrap_or(false)
}
