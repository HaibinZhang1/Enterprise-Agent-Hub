use std::path::PathBuf;

use super::central_store::{
    install_or_replace_package, uninstall_central_store_package, InstalledPackage, StoreError,
};
use super::models::{
    EnabledTarget, EnabledTargetStatus, LocalSkillInstall, LocalStatus, UninstallResult,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallSkillPackageRequest {
    pub skill_id: String,
    pub display_name: String,
    pub version: String,
    pub downloaded_package_dir: PathBuf,
    pub central_store_root: PathBuf,
    pub source_package_hash: String,
    pub source_type: String,
    pub installed_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateSkillPackageRequest {
    pub skill_id: String,
    pub display_name: String,
    pub version: String,
    pub downloaded_package_dir: PathBuf,
    pub central_store_root: PathBuf,
    pub source_package_hash: String,
    pub source_type: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UninstallSkillRequest {
    pub skill_id: String,
    pub central_store_root: PathBuf,
    /// Store removes Central Store after distribution has removed managed targets.
    pub enabled_targets: Vec<EnabledTarget>,
    pub removed_at: String,
}

pub fn install_skill_package(
    request: InstallSkillPackageRequest,
) -> Result<LocalSkillInstall, StoreError> {
    let installed = install_or_replace_package(
        &request.downloaded_package_dir,
        &request.central_store_root,
        &request.skill_id,
        &request.version,
        None,
    )?;

    Ok(local_install_from_package(
        installed,
        request.display_name,
        request.source_package_hash,
        request.source_type,
        request.installed_at,
    ))
}

pub fn update_skill_package(
    request: UpdateSkillPackageRequest,
) -> Result<LocalSkillInstall, StoreError> {
    let installed = install_or_replace_package(
        &request.downloaded_package_dir,
        &request.central_store_root,
        &request.skill_id,
        &request.version,
        None,
    )?;

    Ok(local_install_from_package(
        installed,
        request.display_name,
        request.source_package_hash,
        request.source_type,
        request.updated_at,
    ))
}

pub fn uninstall_skill(request: UninstallSkillRequest) -> Result<UninstallResult, StoreError> {
    let removed =
        uninstall_central_store_package(&request.central_store_root, &request.skill_id, None)?;
    let removed_target_ids = request
        .enabled_targets
        .iter()
        .filter(|target| target.status != EnabledTargetStatus::Failed)
        .map(|target| target.target_id.clone())
        .collect();
    Ok(UninstallResult {
        skill_id: request.skill_id,
        removed_central_store_path: removed,
        removed_target_ids,
        failed_targets: request
            .enabled_targets
            .into_iter()
            .filter(|target| target.status.as_str() == "failed")
            .collect(),
        removed_at: request.removed_at,
    })
}

pub fn list_local_installs() -> Result<Vec<LocalSkillInstall>, StoreError> {
    Err(StoreError::IntegrationRequired(
        "list_local_installs is exposed by the Tauri app-level SQLite state command",
    ))
}

pub fn flush_offline_events() -> Result<(), StoreError> {
    Err(StoreError::IntegrationRequired(
        "flush_offline_events requires the API client and SQLite queue adapter",
    ))
}

fn local_install_from_package(
    installed: InstalledPackage,
    display_name: String,
    source_package_hash: String,
    source_type: String,
    timestamp: String,
) -> LocalSkillInstall {
    LocalSkillInstall {
        skill_id: installed.skill_id,
        display_name,
        local_version: installed.version,
        local_hash: format!("sha256:{}", installed.package_hash),
        source_package_hash,
        source_type,
        installed_at: timestamp.clone(),
        updated_at: timestamp,
        local_status: LocalStatus::Installed,
        central_store_path: installed.central_store_path,
        enabled_targets: Vec::new(),
        has_update: false,
        is_scope_restricted: false,
        can_update: true,
    }
}
