use std::fs;
use std::path::Path;

use crate::store::hash::{hex_digest, Sha256};

pub(super) fn hash_path(path: &Path) -> Result<String, String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|error| format!("stat {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    hash_path_into(path, path, &metadata, &mut hasher)?;
    Ok(hex_digest(&hasher.finalize()))
}

fn hash_path_into(
    root: &Path,
    path: &Path,
    metadata: &fs::Metadata,
    hasher: &mut Sha256,
) -> Result<(), String> {
    let relative = path
        .strip_prefix(root)
        .ok()
        .and_then(|value| value.to_str())
        .unwrap_or(".");
    hasher.update(relative.as_bytes());
    if metadata.file_type().is_symlink() {
        let target = fs::read_link(path)
            .map_err(|error| format!("read link {}: {error}", path.display()))?;
        hasher.update(target.to_string_lossy().as_bytes());
        return Ok(());
    }
    if metadata.is_file() {
        let bytes =
            fs::read(path).map_err(|error| format!("read file {}: {error}", path.display()))?;
        hasher.update(&bytes);
        return Ok(());
    }
    if metadata.is_dir() {
        let mut children = fs::read_dir(path)
            .map_err(|error| format!("read dir {}: {error}", path.display()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("read dir {}: {error}", path.display()))?;
        children.sort_by(|left, right| left.path().cmp(&right.path()));
        for child in children {
            let child_path = child.path();
            let child_metadata = fs::symlink_metadata(&child_path)
                .map_err(|error| format!("stat {}: {error}", child_path.display()))?;
            hash_path_into(root, &child_path, &child_metadata, hasher)?;
        }
    }
    Ok(())
}
