#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    Windows,
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
    pub default_paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TargetConfig {
    pub global_paths: Vec<String>,
    pub project_paths: Vec<String>,
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

impl AdapterConfig {
    pub fn target_name_for_skill(&self, skill_id: &str) -> String {
        self.layout
            .target_name_template
            .replace("{{skillID}}", skill_id)
    }
}

pub fn builtin_adapters() -> Vec<AdapterConfig> {
    vec![
        adapter(
            AdapterID::Codex,
            "Codex",
            vec!["%USERPROFILE%\\.codex\\skills"],
            vec![],
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
            vec![".claude\\skills"],
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
            vec![".cursor\\rules"],
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
            vec![],
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
            vec![".opencode\\skills"],
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
            TransformStrategy::GenericDirectory,
            vec![DetectionMethod::Manual],
        ),
    ]
}

fn adapter(
    tool_id: AdapterID,
    display_name: &str,
    global_paths: Vec<&str>,
    project_paths: Vec<&str>,
    transform_strategy: TransformStrategy,
    methods: Vec<DetectionMethod>,
) -> AdapterConfig {
    AdapterConfig {
        tool_id,
        display_name: display_name.to_string(),
        enabled: true,
        platforms: vec![Platform::Windows],
        detection: DetectionConfig {
            methods,
            registry_keys: vec![],
            default_paths: global_paths.iter().map(|path| path.to_string()).collect(),
        },
        target: TargetConfig {
            global_paths: global_paths.iter().map(|path| path.to_string()).collect(),
            project_paths: project_paths.iter().map(|path| path.to_string()).collect(),
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
