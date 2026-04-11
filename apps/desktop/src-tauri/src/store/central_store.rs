use std::fmt;
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::hash::{hex_digest, Sha256};

pub const DEFAULT_MAX_PACKAGE_BYTES: u64 = 5 * 1024 * 1024;
pub const DEFAULT_MAX_PACKAGE_FILES: usize = 100;

#[derive(Debug)]
pub enum StoreError {
    Io { context: &'static str, source: io::Error },
    InvalidSkillId(String),
    InvalidVersion(String),
    PackageNotDirectory(PathBuf),
    PackageMissingSkillManifest(PathBuf),
    PackageTooLarge { actual_bytes: u64, max_bytes: u64 },
    PackageTooManyFiles { actual_files: usize, max_files: usize },
    PackageHashMismatch { expected: String, actual: String },
    CentralStoreMissing(PathBuf),
    IntegrationRequired(&'static str),
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { context, source } => write!(f, "{context}: {source}"),
            Self::InvalidSkillId(value) => write!(f, "invalid skillID: {value}"),
            Self::InvalidVersion(value) => write!(f, "invalid version: {value}"),
            Self::PackageNotDirectory(path) => write!(f, "package path is not a directory: {}", path.display()),
            Self::PackageMissingSkillManifest(path) => {
                write!(f, "package is missing SKILL.md: {}", path.display())
            }
            Self::PackageTooLarge { actual_bytes, max_bytes } => {
                write!(f, "package is {actual_bytes} bytes, above {max_bytes} byte limit")
            }
            Self::PackageTooManyFiles { actual_files, max_files } => {
                write!(f, "package has {actual_files} files, above {max_files} file limit")
            }
            Self::PackageHashMismatch { expected, actual } => {
                write!(f, "package hash mismatch: expected {expected}, actual {actual}")
            }
            Self::CentralStoreMissing(path) => write!(f, "Central Store path missing: {}", path.display()),
            Self::IntegrationRequired(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for StoreError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}

pub type StoreResult<T> = Result<T, StoreError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PackageLimits {
    pub max_bytes: u64,
    pub max_files: usize,
}

impl Default for PackageLimits {
    fn default() -> Self {
        Self {
            max_bytes: DEFAULT_MAX_PACKAGE_BYTES,
            max_files: DEFAULT_MAX_PACKAGE_FILES,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageValidation {
    pub file_count: usize,
    pub byte_count: u64,
    pub package_hash: String,
    pub manifest_path: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledPackage {
    pub skill_id: String,
    pub version: String,
    pub central_store_path: PathBuf,
    pub package_hash: String,
    pub byte_count: u64,
    pub file_count: usize,
}

pub fn default_central_store_root(app_data_dir: impl AsRef<Path>) -> PathBuf {
    app_data_dir.as_ref().join("EnterpriseAgentHub").join("central-store")
}

pub fn skill_version_dir(central_store_root: impl AsRef<Path>, skill_id: &str, version: &str) -> StoreResult<PathBuf> {
    validate_path_segment(skill_id).map_err(|_| StoreError::InvalidSkillId(skill_id.to_owned()))?;
    validate_path_segment(version).map_err(|_| StoreError::InvalidVersion(version.to_owned()))?;
    Ok(central_store_root
        .as_ref()
        .join("skills")
        .join(skill_id)
        .join(version))
}

pub fn validate_skill_package_dir(
    package_dir: impl AsRef<Path>,
    expected_sha256: Option<&str>,
    limits: PackageLimits,
) -> StoreResult<PackageValidation> {
    let package_dir = package_dir.as_ref();
    if !package_dir.is_dir() {
        return Err(StoreError::PackageNotDirectory(package_dir.to_path_buf()));
    }

    let manifest_path = package_dir.join("SKILL.md");
    if !manifest_path.is_file() {
        return Err(StoreError::PackageMissingSkillManifest(manifest_path));
    }

    let files = collect_files(package_dir)?;
    let mut byte_count = 0u64;
    let mut tree_hasher = Sha256::new();

    for file in files.iter() {
        let relative = file.strip_prefix(package_dir).expect("collected path is below package dir");
        tree_hasher.update(relative.to_string_lossy().replace('\\', "/").as_bytes());
        tree_hasher.update(&[0]);

        let mut handle = fs::File::open(file).map_err(|source| StoreError::Io {
            context: "open package file for hashing",
            source,
        })?;
        let mut buffer = [0; 16 * 1024];
        loop {
            let read = handle.read(&mut buffer).map_err(|source| StoreError::Io {
                context: "read package file for hashing",
                source,
            })?;
            if read == 0 {
                break;
            }
            byte_count += read as u64;
            if byte_count > limits.max_bytes {
                return Err(StoreError::PackageTooLarge {
                    actual_bytes: byte_count,
                    max_bytes: limits.max_bytes,
                });
            }
            tree_hasher.update(&buffer[..read]);
        }
    }

    if files.len() > limits.max_files {
        return Err(StoreError::PackageTooManyFiles {
            actual_files: files.len(),
            max_files: limits.max_files,
        });
    }

    let package_hash = hex_digest(&tree_hasher.finalize());
    if let Some(expected) = expected_sha256 {
        if !expected.eq_ignore_ascii_case(&package_hash) {
            return Err(StoreError::PackageHashMismatch {
                expected: expected.to_owned(),
                actual: package_hash,
            });
        }
    }

    Ok(PackageValidation {
        file_count: files.len(),
        byte_count,
        package_hash,
        manifest_path,
    })
}

pub fn install_or_replace_package(
    package_dir: impl AsRef<Path>,
    central_store_root: impl AsRef<Path>,
    skill_id: &str,
    version: &str,
    expected_sha256: Option<&str>,
) -> StoreResult<InstalledPackage> {
    let validation = validate_skill_package_dir(package_dir.as_ref(), expected_sha256, PackageLimits::default())?;
    let target_dir = skill_version_dir(central_store_root.as_ref(), skill_id, version)?;
    let parent = target_dir.parent().expect("skill version dir has parent");
    fs::create_dir_all(parent).map_err(|source| StoreError::Io {
        context: "create Central Store skill parent",
        source,
    })?;

    let tmp_dir = parent.join(format!(".{skill_id}-{version}.tmp-{}", now_millis()));
    if tmp_dir.exists() {
        remove_dir_all_if_exists(&tmp_dir)?;
    }
    copy_dir_recursive(package_dir.as_ref(), &tmp_dir)?;

    let backup_dir = if target_dir.exists() {
        let backup = parent.join(format!(".{skill_id}-{version}.backup-{}", now_millis()));
        fs::rename(&target_dir, &backup).map_err(|source| StoreError::Io {
            context: "move existing Central Store package aside",
            source,
        })?;
        Some(backup)
    } else {
        None
    };

    if let Err(error) = fs::rename(&tmp_dir, &target_dir) {
        if let Some(backup) = &backup_dir {
            let _ = fs::rename(backup, &target_dir);
        }
        let _ = remove_dir_all_if_exists(&tmp_dir);
        return Err(StoreError::Io {
            context: "atomically publish Central Store package",
            source: error,
        });
    }

    if let Some(backup) = backup_dir {
        remove_dir_all_if_exists(&backup)?;
    }

    Ok(InstalledPackage {
        skill_id: skill_id.to_owned(),
        version: version.to_owned(),
        central_store_path: target_dir,
        package_hash: validation.package_hash,
        byte_count: validation.byte_count,
        file_count: validation.file_count,
    })
}

pub fn uninstall_central_store_package(
    central_store_root: impl AsRef<Path>,
    skill_id: &str,
    version: Option<&str>,
) -> StoreResult<Option<PathBuf>> {
    let target = match version {
        Some(version) => skill_version_dir(central_store_root, skill_id, version)?,
        None => {
            validate_path_segment(skill_id).map_err(|_| StoreError::InvalidSkillId(skill_id.to_owned()))?;
            central_store_root.as_ref().join("skills").join(skill_id)
        }
    };

    if !target.exists() {
        return Ok(None);
    }
    remove_dir_all_if_exists(&target)?;
    Ok(Some(target))
}

pub fn ensure_central_store_root(path: impl AsRef<Path>) -> StoreResult<PathBuf> {
    let path = path.as_ref();
    fs::create_dir_all(path.join("skills")).map_err(|source| StoreError::Io {
        context: "create Central Store root",
        source,
    })?;
    fs::create_dir_all(path.join("downloads")).map_err(|source| StoreError::Io {
        context: "create Central Store downloads root",
        source,
    })?;
    fs::create_dir_all(path.join("derived")).map_err(|source| StoreError::Io {
        context: "create Central Store derived artifact root",
        source,
    })?;
    Ok(path.to_path_buf())
}

fn validate_path_segment(value: &str) -> Result<(), ()> {
    if value.is_empty()
        || value == "."
        || value == ".."
        || value.contains('/')
        || value.contains('\\')
        || value.contains('\0')
    {
        Err(())
    } else {
        Ok(())
    }
}

fn collect_files(root: &Path) -> StoreResult<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_files_inner(root, &mut files)?;
    files.sort_by(|a, b| a.to_string_lossy().cmp(&b.to_string_lossy()));
    Ok(files)
}

fn collect_files_inner(dir: &Path, files: &mut Vec<PathBuf>) -> StoreResult<()> {
    for entry in fs::read_dir(dir).map_err(|source| StoreError::Io {
        context: "read package directory",
        source,
    })? {
        let entry = entry.map_err(|source| StoreError::Io {
            context: "read package directory entry",
            source,
        })?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|source| StoreError::Io {
            context: "read package file type",
            source,
        })?;
        if file_type.is_dir() {
            collect_files_inner(&path, files)?;
        } else if file_type.is_file() {
            files.push(path);
        }
    }
    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> StoreResult<()> {
    fs::create_dir_all(target).map_err(|source| StoreError::Io {
        context: "create package copy target",
        source,
    })?;
    for entry in fs::read_dir(source).map_err(|source| StoreError::Io {
        context: "read package copy source",
        source,
    })? {
        let entry = entry.map_err(|source| StoreError::Io {
            context: "read package copy source entry",
            source,
        })?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type().map_err(|source| StoreError::Io {
            context: "read package copy file type",
            source,
        })?;
        if file_type.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &target_path).map_err(|source| StoreError::Io {
                context: "copy package file",
                source,
            })?;
        }
    }
    Ok(())
}

fn remove_dir_all_if_exists(path: &Path) -> StoreResult<()> {
    match fs::remove_dir_all(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(StoreError::Io {
            context: "remove directory",
            source,
        }),
    }
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_segments() {
        assert!(skill_version_dir("/tmp/store", "good", "1.0.0").is_ok());
        assert!(skill_version_dir("/tmp/store", "../bad", "1.0.0").is_err());
        assert!(skill_version_dir("/tmp/store", "good", "../1.0.0").is_err());
    }
}
