use std::fs;
use std::path::{Path, PathBuf};

use super::config::TransformStrategy;
use super::distribution::MANAGED_MARKER_FILE;
use super::errors::{AdapterError, AdapterResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivedArtifact {
    pub skill_id: String,
    pub version: String,
    pub strategy: TransformStrategy,
    pub artifact_path: PathBuf,
    pub entry_file: PathBuf,
}

pub fn transform_skill(
    source_skill_path: impl AsRef<Path>,
    derived_root: impl AsRef<Path>,
    skill_id: &str,
    version: &str,
    strategy: TransformStrategy,
) -> AdapterResult<DerivedArtifact> {
    validate_skill_id(skill_id)?;
    let source_skill_path = source_skill_path.as_ref();
    let derived_root = derived_root.as_ref();

    if !source_skill_path.is_dir() {
        return Err(AdapterError::MissingSkillSource(source_skill_path.to_path_buf()));
    }

    let skill_md = source_skill_path.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(AdapterError::MissingMarkerFile {
            path: source_skill_path.to_path_buf(),
            marker: "SKILL.md".to_string(),
        });
    }

    let artifact_path = derived_root
        .join(skill_id)
        .join(version)
        .join(strategy.as_str());

    if artifact_path.exists() {
        fs::remove_dir_all(&artifact_path).map_err(|error| {
            AdapterError::io(
                format!("clear derived artifact {}", artifact_path.display()),
                error,
            )
        })?;
    }
    fs::create_dir_all(&artifact_path).map_err(|error| {
        AdapterError::io(
            format!("create derived artifact {}", artifact_path.display()),
            error,
        )
    })?;

    let skill_text = fs::read_to_string(&skill_md)
        .map_err(|error| AdapterError::io(format!("read {}", skill_md.display()), error))?;

    let entry_file = match strategy {
        TransformStrategy::CodexSkill | TransformStrategy::ClaudeSkill | TransformStrategy::GenericDirectory => {
            copy_dir(source_skill_path, &artifact_path)?;
            artifact_path.join("SKILL.md")
        }
        TransformStrategy::CursorRule => {
            let path = artifact_path.join(format!("{}.mdc", sanitize_file_stem(skill_id)));
            let description = first_heading(&skill_text).unwrap_or(skill_id);
            fs::write(
                &path,
                format!(
                    "---\ndescription: {}\nglobs: [\"**/*\"]\nalwaysApply: false\n---\n\n{}",
                    escape_frontmatter(description), skill_text
                ),
            )
            .map_err(|error| AdapterError::io(format!("write {}", path.display()), error))?;
            path
        }
        TransformStrategy::WindsurfRule => {
            let path = artifact_path.join(format!("{}.md", sanitize_file_stem(skill_id)));
            fs::write(
                &path,
                format!(
                    "---\ntrigger: manual\ndescription: {}\n---\n\n{}",
                    escape_frontmatter(first_heading(&skill_text).unwrap_or(skill_id)),
                    skill_text
                ),
            )
            .map_err(|error| AdapterError::io(format!("write {}", path.display()), error))?;
            path
        }
        TransformStrategy::OpencodeSkill => {
            copy_supporting_files(source_skill_path, &artifact_path)?;
            let path = artifact_path.join("AGENTS.md");
            fs::write(
                &path,
                format!(
                    "# {}\n\nThis file was generated from EnterpriseAgentHub Skill `{}` for opencode.\n\n{}",
                    first_heading(&skill_text).unwrap_or(skill_id),
                    skill_id,
                    skill_text
                ),
            )
            .map_err(|error| AdapterError::io(format!("write {}", path.display()), error))?;
            path
        }
    };

    write_managed_marker(&artifact_path, skill_id, version, strategy)?;

    Ok(DerivedArtifact {
        skill_id: skill_id.to_string(),
        version: version.to_string(),
        strategy,
        artifact_path,
        entry_file,
    })
}

pub fn validate_skill_id(skill_id: &str) -> AdapterResult<()> {
    let valid = !skill_id.is_empty()
        && skill_id
            .chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_');
    if valid {
        Ok(())
    } else {
        Err(AdapterError::InvalidSkillID(skill_id.to_string()))
    }
}

fn write_managed_marker(
    artifact_path: &Path,
    skill_id: &str,
    version: &str,
    strategy: TransformStrategy,
) -> AdapterResult<()> {
    let marker = artifact_path.join(MANAGED_MARKER_FILE);
    fs::write(
        &marker,
        format!(
            "{{\n  \"managedBy\": \"EnterpriseAgentHub\",\n  \"skillID\": \"{}\",\n  \"version\": \"{}\",\n  \"transformStrategy\": \"{}\"\n}}\n",
            skill_id,
            version,
            strategy.as_str()
        ),
    )
    .map_err(|error| AdapterError::io(format!("write {}", marker.display()), error))
}

fn copy_supporting_files(source: &Path, dest: &Path) -> AdapterResult<()> {
    for entry in fs::read_dir(source)
        .map_err(|error| AdapterError::io(format!("read {}", source.display()), error))?
    {
        let entry = entry.map_err(|error| AdapterError::io("read source entry", error))?;
        let file_name = entry.file_name();
        if file_name == "SKILL.md" {
            continue;
        }
        let target = dest.join(file_name);
        copy_path(&entry.path(), &target)?;
    }
    Ok(())
}

pub fn copy_dir(source: &Path, dest: &Path) -> AdapterResult<()> {
    fs::create_dir_all(dest)
        .map_err(|error| AdapterError::io(format!("create {}", dest.display()), error))?;
    for entry in fs::read_dir(source)
        .map_err(|error| AdapterError::io(format!("read {}", source.display()), error))?
    {
        let entry = entry.map_err(|error| AdapterError::io("read source entry", error))?;
        let target = dest.join(entry.file_name());
        copy_path(&entry.path(), &target)?;
    }
    Ok(())
}

pub fn copy_path(source: &Path, dest: &Path) -> AdapterResult<()> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| AdapterError::io(format!("stat {}", source.display()), error))?;
    if metadata.is_dir() {
        copy_dir(source, dest)
    } else if metadata.is_file() {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                AdapterError::io(format!("create parent {}", parent.display()), error)
            })?;
        }
        fs::copy(source, dest).map(|_| ()).map_err(|error| {
            AdapterError::io(
                format!("copy {} -> {}", source.display(), dest.display()),
                error,
            )
        })
    } else {
        Ok(())
    }
}

fn first_heading(text: &str) -> Option<&str> {
    text.lines()
        .find_map(|line| line.strip_prefix("# ").map(str::trim))
        .filter(|line| !line.is_empty())
}

fn escape_frontmatter(value: &str) -> String {
    value.replace('"', "'")
}

fn sanitize_file_stem(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect()
}
