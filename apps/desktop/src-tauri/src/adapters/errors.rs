use std::fmt;
use std::io;
use std::path::PathBuf;

pub type AdapterResult<T> = Result<T, AdapterError>;

#[derive(Debug)]
pub enum AdapterError {
    InvalidSkillID(String),
    InvalidTargetPath { path: PathBuf, reason: String },
    MissingMarkerFile { path: PathBuf, marker: String },
    MissingSkillSource(PathBuf),
    TargetConflict { path: PathBuf },
    UnmanagedTarget { path: PathBuf },
    UnsupportedMode(String),
    UnsupportedTransform(String),
    Io { context: String, source: io::Error },
}

impl AdapterError {
    pub fn io(context: impl Into<String>, source: io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidSkillID(_) => "invalid_skill_id",
            Self::InvalidTargetPath { .. } => "target_path_invalid",
            Self::MissingMarkerFile { .. } => "skill_marker_missing",
            Self::MissingSkillSource(_) => "central_store_skill_missing",
            Self::TargetConflict { .. } => "target_conflict",
            Self::UnmanagedTarget { .. } => "unmanaged_target",
            Self::UnsupportedMode(_) => "unsupported_install_mode",
            Self::UnsupportedTransform(_) => "conversion_failed",
            Self::Io { .. } => "io_error",
        }
    }
}

impl fmt::Display for AdapterError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidSkillID(skill_id) => write!(f, "invalid skillID: {skill_id}"),
            Self::InvalidTargetPath { path, reason } => {
                write!(f, "invalid target path {}: {reason}", path.display())
            }
            Self::MissingMarkerFile { path, marker } => {
                write!(
                    f,
                    "skill source {} is missing marker file {marker}",
                    path.display()
                )
            }
            Self::MissingSkillSource(path) => {
                write!(
                    f,
                    "central store skill source is missing: {}",
                    path.display()
                )
            }
            Self::TargetConflict { path } => {
                write!(
                    f,
                    "target path already exists and is not managed: {}",
                    path.display()
                )
            }
            Self::UnmanagedTarget { path } => {
                write!(f, "refusing to remove unmanaged target: {}", path.display())
            }
            Self::UnsupportedMode(mode) => write!(f, "unsupported install mode: {mode}"),
            Self::UnsupportedTransform(strategy) => {
                write!(f, "unsupported transform strategy: {strategy}")
            }
            Self::Io { context, source } => write!(f, "{context}: {source}"),
        }
    }
}

impl std::error::Error for AdapterError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}
