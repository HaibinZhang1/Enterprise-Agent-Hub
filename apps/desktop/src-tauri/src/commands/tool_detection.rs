#[cfg(test)]
#[path = "../adapters/mod.rs"]
mod adapters;

#[cfg(test)]
use self::adapters::{builtin_adapters, detect_adapter, AdapterConfig, DetectionResult};
#[cfg(not(test))]
use crate::adapters::{builtin_adapters, detect_adapter, AdapterConfig, DetectionResult};

use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolDetectionRequest {
    pub tool_id: Option<String>,
    pub manual_path: Option<PathBuf>,
}

pub fn list_builtin_tool_adapters() -> Vec<AdapterConfig> {
    builtin_adapters()
}

pub fn detect_tools(request: ToolDetectionRequest) -> Vec<DetectionResult> {
    builtin_adapters()
        .into_iter()
        .filter(|adapter| {
            request
                .tool_id
                .as_ref()
                .map_or(true, |tool_id| adapter.tool_id.as_str() == tool_id)
        })
        .map(|adapter| detect_adapter(&adapter, request.manual_path.clone()))
        .collect()
}
