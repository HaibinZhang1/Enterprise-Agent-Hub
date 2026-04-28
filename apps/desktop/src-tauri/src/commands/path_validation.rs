#[cfg(test)]
#[path = "../adapters/mod.rs"]
mod adapters;

#[cfg(test)]
use self::adapters::{validate_target_path, AdapterResult, PathValidation};
#[cfg(not(test))]
use crate::adapters::{validate_target_path, AdapterResult, PathValidation};

use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidateTargetPathRequest {
    pub path: PathBuf,
}

pub fn validate_distribution_target_path(
    request: ValidateTargetPathRequest,
) -> AdapterResult<PathValidation> {
    validate_target_path(request.path)
}
