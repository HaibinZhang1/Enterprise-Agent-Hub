#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Platform {
    Windows,
    Macos,
}

impl Platform {
    pub fn current() -> Self {
        std::env::var("EAH_P1_PLATFORM")
            .ok()
            .as_deref()
            .map(Self::from_os_name)
            .unwrap_or_else(|| Self::from_os_name(std::env::consts::OS))
    }

    pub fn from_os_name(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "windows" | "win32" => Self::Windows,
            "darwin" | "mac" | "macos" | "osx" => Self::Macos,
            _ => {
                if cfg!(windows) {
                    Self::Windows
                } else {
                    Self::Macos
                }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionMethod {
    Registry,
    DefaultPath,
    Manual,
}

impl DetectionMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Registry => "registry",
            Self::DefaultPath => "default_path",
            Self::Manual => "manual",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallMode {
    Symlink,
    Copy,
}

impl InstallMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Symlink => "symlink",
            Self::Copy => "copy",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransformStrategy {
    CodexSkill,
    ClaudeSkill,
    CursorRule,
    WindsurfRule,
    OpencodeSkill,
    GenericDirectory,
}

impl TransformStrategy {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CodexSkill => "codex_skill",
            Self::ClaudeSkill => "claude_skill",
            Self::CursorRule => "cursor_rule",
            Self::WindsurfRule => "windsurf_rule",
            Self::OpencodeSkill => "opencode_skill",
            Self::GenericDirectory => "generic_directory",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdapterID {
    Codex,
    Claude,
    Cursor,
    Windsurf,
    Opencode,
    CustomDirectory,
}

impl AdapterID {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Cursor => "cursor",
            Self::Windsurf => "windsurf",
            Self::Opencode => "opencode",
            Self::CustomDirectory => "custom_directory",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectionConfig {
    pub methods: Vec<DetectionMethod>,
    pub registry_keys: Vec<String>,
    pub default_paths: PlatformPathTable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TargetConfig {
    pub global_paths: PlatformPathTable,
    pub project_paths: PlatformPathTable,
    pub config_path: PlatformValueTable,
    pub path_editable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallConfig {
    pub supported_modes: Vec<InstallMode>,
    pub default_mode: InstallMode,
    pub fallback_mode: InstallMode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayoutConfig {
    pub layout_type: String,
    pub target_name_template: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdapterConfig {
    pub tool_id: AdapterID,
    pub display_name: String,
    pub enabled: bool,
    pub platforms: Vec<Platform>,
    pub detection: DetectionConfig,
    pub target: TargetConfig,
    pub install: InstallConfig,
    pub layout: LayoutConfig,
    pub transform_strategy: TransformStrategy,
    pub marker_files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformPathTable {
    pub windows: Vec<String>,
    pub macos: Vec<String>,
}

impl PlatformPathTable {
    pub fn for_platform(&self, platform: Platform) -> Vec<String> {
        match platform {
            Platform::Windows => self.windows.clone(),
            Platform::Macos => self.macos.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformValueTable {
    pub windows: Option<String>,
    pub macos: Option<String>,
}

impl PlatformValueTable {
    pub fn for_platform(&self, platform: Platform) -> Option<String> {
        match platform {
            Platform::Windows => self.windows.clone(),
            Platform::Macos => self.macos.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedDetectionConfig {
    pub methods: Vec<DetectionMethod>,
    pub registry_keys: Vec<String>,
    pub default_paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedTargetConfig {
    pub global_paths: Vec<String>,
    pub project_paths: Vec<String>,
    pub config_path: Option<String>,
    pub path_editable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedAdapterConfig {
    pub tool_id: AdapterID,
    pub display_name: String,
    pub enabled: bool,
    pub platform: Platform,
    pub detection: ResolvedDetectionConfig,
    pub target: ResolvedTargetConfig,
    pub install: InstallConfig,
    pub layout: LayoutConfig,
    pub transform_strategy: TransformStrategy,
    pub marker_files: Vec<String>,
}

impl AdapterConfig {
    pub fn target_name_for_skill(&self, skill_id: &str) -> String {
        self.layout
            .target_name_template
            .replace("{{skillID}}", skill_id)
    }

    pub fn supports_platform(&self, platform: Platform) -> bool {
        self.platforms.contains(&platform)
    }

    pub fn resolve(&self, platform: Platform) -> ResolvedAdapterConfig {
        let methods = self
            .detection
            .methods
            .iter()
            .copied()
            .filter(|method| *method != DetectionMethod::Registry || platform == Platform::Windows)
            .collect();
        ResolvedAdapterConfig {
            tool_id: self.tool_id,
            display_name: self.display_name.clone(),
            enabled: self.enabled,
            platform,
            detection: ResolvedDetectionConfig {
                methods,
                registry_keys: self.detection.registry_keys.clone(),
                default_paths: self.detection.default_paths.for_platform(platform),
            },
            target: ResolvedTargetConfig {
                global_paths: self.target.global_paths.for_platform(platform),
                project_paths: self.target.project_paths.for_platform(platform),
                config_path: self.target.config_path.for_platform(platform),
                path_editable: self.target.path_editable,
            },
            install: self.install.clone(),
            layout: self.layout.clone(),
            transform_strategy: self.transform_strategy,
            marker_files: self.marker_files.clone(),
        }
    }

    pub fn is_manual_only_for(&self, platform: Platform) -> bool {
        let resolved = self.resolve(platform);
        resolved.detection.methods == vec![DetectionMethod::Manual]
            && resolved.detection.default_paths.is_empty()
            && resolved.target.global_paths.is_empty()
    }
}

pub fn builtin_adapters() -> Vec<AdapterConfig> {
    vec![
        adapter(
            AdapterID::Codex,
            "Codex",
            vec!["%USERPROFILE%\\.codex\\skills"],
            vec!["~/.codex/skills"],
            vec![".codex\\skills"],
            vec![".codex/skills"],
            Some("%USERPROFILE%\\.codex\\config.toml"),
            Some("~/.codex/config.toml"),
            TransformStrategy::CodexSkill,
            vec![
                DetectionMethod::Registry,
                DetectionMethod::DefaultPath,
                DetectionMethod::Manual,
            ],
        ),
        adapter(
            AdapterID::Claude,
            "Claude",
            vec!["%USERPROFILE%\\.claude\\skills"],
            vec!["~/.claude/skills"],
            vec![".claude\\skills"],
            vec![".claude/skills"],
            Some("%USERPROFILE%\\.claude\\settings.json"),
            Some("~/.claude/settings.json"),
            TransformStrategy::ClaudeSkill,
            vec![
                DetectionMethod::Registry,
                DetectionMethod::DefaultPath,
                DetectionMethod::Manual,
            ],
        ),
        adapter(
            AdapterID::Cursor,
            "Cursor",
            vec!["%USERPROFILE%\\.cursor\\rules"],
            vec!["~/.cursor/rules"],
            vec![".cursor\\rules"],
            vec![".cursor/rules"],
            Some("%USERPROFILE%\\.cursor\\settings.json"),
            Some("~/.cursor/cli-config.json"),
            TransformStrategy::CursorRule,
            vec![
                DetectionMethod::Registry,
                DetectionMethod::DefaultPath,
                DetectionMethod::Manual,
            ],
        ),
        adapter(
            AdapterID::Windsurf,
            "Windsurf",
            vec!["%USERPROFILE%\\.windsurf\\skills"],
            vec!["~/.codeium/windsurf/memories"],
            vec![".windsurf\\rules"],
            vec![".windsurf/rules"],
            Some("%USERPROFILE%\\.windsurf\\settings.json"),
            Some("~/.codeium/windsurf/memories/global_rules.md"),
            TransformStrategy::WindsurfRule,
            vec![
                DetectionMethod::Registry,
                DetectionMethod::DefaultPath,
                DetectionMethod::Manual,
            ],
        ),
        adapter(
            AdapterID::Opencode,
            "opencode",
            vec!["%USERPROFILE%\\.opencode\\skills"],
            vec!["~/.config/opencode/skills"],
            vec![".opencode\\skills"],
            vec![".opencode/skills"],
            Some("%USERPROFILE%\\.opencode\\config.json"),
            Some("~/.config/opencode/opencode.json"),
            TransformStrategy::OpencodeSkill,
            vec![
                DetectionMethod::Registry,
                DetectionMethod::DefaultPath,
                DetectionMethod::Manual,
            ],
        ),
        adapter(
            AdapterID::CustomDirectory,
            "Custom Directory",
            vec![],
            vec![],
            vec![],
            vec![],
            None,
            None,
            TransformStrategy::GenericDirectory,
            vec![DetectionMethod::Manual],
        ),
    ]
}

fn adapter(
    tool_id: AdapterID,
    display_name: &str,
    windows_global_paths: Vec<&str>,
    macos_global_paths: Vec<&str>,
    windows_project_paths: Vec<&str>,
    macos_project_paths: Vec<&str>,
    windows_config_path: Option<&str>,
    macos_config_path: Option<&str>,
    transform_strategy: TransformStrategy,
    methods: Vec<DetectionMethod>,
) -> AdapterConfig {
    AdapterConfig {
        tool_id,
        display_name: display_name.to_string(),
        enabled: true,
        platforms: vec![Platform::Windows, Platform::Macos],
        detection: DetectionConfig {
            methods,
            registry_keys: vec![],
            default_paths: platform_paths(windows_global_paths.clone(), macos_global_paths.clone()),
        },
        target: TargetConfig {
            global_paths: platform_paths(windows_global_paths, macos_global_paths),
            project_paths: platform_paths(windows_project_paths, macos_project_paths),
            config_path: platform_value(windows_config_path, macos_config_path),
            path_editable: true,
        },
        install: InstallConfig {
            supported_modes: vec![InstallMode::Symlink, InstallMode::Copy],
            default_mode: InstallMode::Symlink,
            fallback_mode: InstallMode::Copy,
        },
        layout: LayoutConfig {
            layout_type: "directory".to_string(),
            target_name_template: "{{skillID}}".to_string(),
        },
        transform_strategy,
        marker_files: vec!["SKILL.md".to_string()],
    }
}

fn platform_paths(windows: Vec<&str>, macos: Vec<&str>) -> PlatformPathTable {
    PlatformPathTable {
        windows: windows.into_iter().map(|path| path.to_string()).collect(),
        macos: macos.into_iter().map(|path| path.to_string()).collect(),
    }
}

fn platform_value(windows: Option<&str>, macos: Option<&str>) -> PlatformValueTable {
    PlatformValueTable {
        windows: windows.map(|value| value.to_string()),
        macos: macos.map(|value| value.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_resolution_is_injectable() {
        assert_eq!(Platform::from_os_name("windows"), Platform::Windows);
        assert_eq!(Platform::from_os_name("darwin"), Platform::Macos);
        assert_eq!(Platform::from_os_name("linux"), Platform::Macos);
    }

    #[test]
    fn resolved_adapter_config_switches_paths_by_platform() {
        let adapter = builtin_adapters()
            .into_iter()
            .find(|candidate| candidate.tool_id == AdapterID::Codex)
            .expect("codex adapter");
        let windows = adapter.resolve(Platform::Windows);
        let macos = adapter.resolve(Platform::Macos);
        assert_eq!(
            windows.target.global_paths,
            vec!["%USERPROFILE%\\.codex\\skills".to_string()]
        );
        assert_eq!(
            macos.target.global_paths,
            vec!["~/.codex/skills".to_string()]
        );
        assert_eq!(
            macos.target.project_paths,
            vec![".codex/skills".to_string()]
        );
        assert_eq!(
            macos.target.config_path.as_deref(),
            Some("~/.codex/config.toml")
        );
    }
}
