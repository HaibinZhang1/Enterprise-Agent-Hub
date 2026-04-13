export type DesktopPlatform = "windows" | "macos";

type ToolPathDefaults = {
  configPath: string;
  skillsPaths: string[];
};

const WINDOWS_PROJECT_SUFFIX = ".codex\\skills";
const MACOS_PROJECT_SUFFIX = ".codex/skills";

const TOOL_DEFAULTS: Record<DesktopPlatform, Record<string, ToolPathDefaults>> = {
  windows: {
    codex: {
      configPath: "%USERPROFILE%\\.codex\\config.toml",
      skillsPaths: ["%USERPROFILE%\\.codex\\skills"]
    },
    claude: {
      configPath: "%USERPROFILE%\\.claude\\settings.json",
      skillsPaths: ["%USERPROFILE%\\.claude\\skills"]
    },
    cursor: {
      configPath: "%USERPROFILE%\\.cursor\\settings.json",
      skillsPaths: ["%USERPROFILE%\\.cursor\\rules"]
    },
    windsurf: {
      configPath: "%USERPROFILE%\\.windsurf\\settings.json",
      skillsPaths: ["%USERPROFILE%\\.windsurf\\skills"]
    },
    opencode: {
      configPath: "%USERPROFILE%\\.opencode\\config.json",
      skillsPaths: ["%USERPROFILE%\\.opencode\\skills"]
    },
    custom_directory: {
      configPath: "手动维护",
      skillsPaths: []
    }
  },
  macos: {
    codex: {
      configPath: "~/.codex/config.toml",
      skillsPaths: ["~/.codex/skills"]
    },
    claude: {
      configPath: "~/.claude/settings.json",
      skillsPaths: ["~/.claude/skills"]
    },
    cursor: {
      configPath: "~/.cursor/cli-config.json",
      skillsPaths: ["~/.cursor/rules"]
    },
    windsurf: {
      configPath: "~/.codeium/windsurf/memories/global_rules.md",
      skillsPaths: ["~/.codeium/windsurf/memories"]
    },
    opencode: {
      configPath: "~/.config/opencode/opencode.json",
      skillsPaths: ["~/.config/opencode/skills"]
    },
    custom_directory: {
      configPath: "手动维护",
      skillsPaths: []
    }
  }
};

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator !== "undefined") {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    if (platform.includes("win") || userAgent.includes("windows")) {
      return "windows";
    }
    if (platform.includes("mac") || userAgent.includes("mac os") || userAgent.includes("darwin")) {
      return "macos";
    }
  }

  const maybeProcess = globalThis as typeof globalThis & { process?: { platform?: string } };
  if (maybeProcess.process?.platform === "win32") {
      return "windows";
  }
  if (maybeProcess.process?.platform === "darwin") {
      return "macos";
  }

  return "windows";
}

export function defaultProjectSkillsPath(projectPath: string, platform = detectDesktopPlatform()): string {
  if (!projectPath.trim()) return "";
  const normalized = projectPath.replace(/[\\/]+$/, "");
  return platform === "windows"
    ? `${normalized}\\${WINDOWS_PROJECT_SUFFIX}`
    : `${normalized}/${MACOS_PROJECT_SUFFIX}`;
}

export function previewCentralStorePath(platform = detectDesktopPlatform()): string {
  return platform === "windows"
    ? "%APPDATA%\\EnterpriseAgentHub\\central-store"
    : "~/Library/Application Support/com.enterpriseagenthub.desktop/EnterpriseAgentHub/central-store";
}

export function defaultToolConfigPath(toolID: string, platform = detectDesktopPlatform()): string {
  return TOOL_DEFAULTS[platform][toolID]?.configPath ?? "手动维护";
}

export function defaultToolSkillsPath(toolID: string, platform = detectDesktopPlatform()): string {
  return TOOL_DEFAULTS[platform][toolID]?.skillsPaths[0] ?? "";
}

export function defaultToolSkillsCandidates(toolID: string, platform = detectDesktopPlatform()): string[] {
  return TOOL_DEFAULTS[platform][toolID]?.skillsPaths ?? [];
}

export function appendSkillPath(basePath: string, skillID: string, platform = detectDesktopPlatform()): string {
  if (!basePath) {
    return skillID;
  }
  const separator = platform === "windows" ? "\\" : "/";
  if (basePath.endsWith("\\") || basePath.endsWith("/")) {
    return `${basePath}${skillID}`;
  }
  return `${basePath}${separator}${skillID}`;
}
