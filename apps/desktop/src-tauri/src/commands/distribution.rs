#[cfg(test)]
#[path = "../adapters/mod.rs"]
pub(crate) mod adapters;

#[cfg(test)]
use self::adapters::{
    builtin_adapters, enable_artifact_with_options, transform_skill, AdapterError, AdapterID,
    AdapterResult, DistributionOptions, DistributionOutcome, InstallMode,
};
#[cfg(not(test))]
use crate::adapters::{
    builtin_adapters, enable_artifact_with_options, transform_skill, AdapterError, AdapterID,
    AdapterResult, DistributionOptions, DistributionOutcome, InstallMode,
};

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnableDistributionRequest {
    pub skill_id: String,
    pub version: String,
    pub adapter_id: AdapterID,
    pub central_store_skill_path: PathBuf,
    pub derived_root: PathBuf,
    pub target_root: PathBuf,
    pub requested_mode: InstallMode,
    pub allow_overwrite: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnableDistributionResponse {
    pub skill_id: String,
    pub version: String,
    pub target_path: PathBuf,
    pub artifact_path: PathBuf,
    pub requested_mode: InstallMode,
    pub resolved_mode: InstallMode,
    pub fallback_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisableDistributionRequest {
    pub managed_target_path: PathBuf,
}

pub fn enable_distribution(
    request: EnableDistributionRequest,
) -> AdapterResult<EnableDistributionResponse> {
    let adapter = builtin_adapters()
        .into_iter()
        .find(|adapter| adapter.tool_id == request.adapter_id)
        .ok_or_else(|| {
            AdapterError::UnsupportedTransform(request.adapter_id.as_str().to_string())
        })?;

    if !adapter
        .install
        .supported_modes
        .contains(&request.requested_mode)
    {
        return Err(AdapterError::UnsupportedMode(
            request.requested_mode.as_str().to_string(),
        ));
    }

    // Store remains the source of truth: this command receives a Store-owned
    // Central Store path and only derives/distributes adapter artifacts from it.
    let artifact = transform_skill(
        &request.central_store_skill_path,
        &request.derived_root,
        &request.skill_id,
        &request.version,
        adapter.transform_strategy,
    )?;
    let target_name = adapter.target_name_for_skill(&request.skill_id);
    let artifact_path = artifact.artifact_path;
    let outcome = enable_artifact_with_options(
        &artifact_path,
        request.target_root,
        &target_name,
        request.requested_mode,
        DistributionOptions {
            allow_overwrite_target: request.allow_overwrite,
            simulated_symlink_failure: None,
        },
    )?;

    Ok(response(
        request.skill_id,
        request.version,
        artifact_path,
        outcome,
    ))
}

pub fn disable_distribution(request: DisableDistributionRequest) -> AdapterResult<()> {
    #[cfg(test)]
    use self::adapters::disable_managed_target;
    #[cfg(not(test))]
    use crate::adapters::disable_managed_target;

    disable_managed_target(request.managed_target_path)
}

pub fn managed_target_path(target_root: impl AsRef<Path>, skill_id: &str) -> PathBuf {
    target_root.as_ref().join(skill_id)
}

fn response(
    skill_id: String,
    version: String,
    artifact_path: PathBuf,
    outcome: DistributionOutcome,
) -> EnableDistributionResponse {
    EnableDistributionResponse {
        skill_id,
        version,
        target_path: outcome.target_path,
        artifact_path,
        requested_mode: outcome.requested_mode,
        resolved_mode: outcome.resolved_mode,
        fallback_reason: outcome.fallback_reason,
    }
}
