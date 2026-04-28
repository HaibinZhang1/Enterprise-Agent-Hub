import type { EnabledTarget, ExtensionInstall, LocalBootstrap, LocalEvent, LocalSkillInstall, ProjectConfig, RequestedMode, ScanTargetSummary, SkillSummary, TargetType, ToolConfig } from "../../domain/p1.ts";
import { seedProjects, seedSkills, seedTools } from "../../fixtures/p1SeedData.ts";
import { appendSkillPath, defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsCandidates, defaultToolSkillsPath, detectDesktopPlatform, previewCentralStorePath, type DesktopPlatform } from "../../utils/platformPaths.ts";

export function browserPreviewBootstrap(): LocalBootstrap {
  const platform = detectDesktopPlatform();
  return {
    installs: [],
    extensions: [],
    tools: [],
    projects: [],
    notifications: [],
    offlineEvents: [],
    pendingOfflineEventCount: 0,
    unreadLocalNotificationCount: 0,
    centralStorePath: `Browser preview: Electron desktop app required for local state (${previewCentralStorePath(platform)})`
  };
}

export function buildTarget(skill: SkillSummary, targetType: TargetType, targetID: string, requestedMode: RequestedMode): EnabledTarget {
  const platform = detectDesktopPlatform();
  const tool = seedTools.find((item) => item.toolID === targetID);
  const project = seedProjects.find((item) => item.projectID === targetID);
  const previewTool = tool ? mapPreviewTool(tool, platform) : null;
  const previewProject = project ? mapPreviewProject(project, platform) : null;
  const targetPath = targetType === "tool" ? previewTool?.skillsPath : previewProject?.skillsPath;
  const targetName = targetType === "tool" ? previewTool?.name : previewProject?.name;
  const shouldFallback = targetID === "enterprise-agent-hub" || targetID === "opencode";

  return {
    targetType,
    targetID,
    targetName: targetName ?? targetID,
    targetPath: appendSkillPath(targetPath ?? "manual-target", skill.skillID, platform),
    requestedMode,
    resolvedMode: shouldFallback ? "copy" : requestedMode,
    fallbackReason: shouldFallback ? "symlink_permission_denied" : null,
    enabledAt: new Date().toISOString()
  };
}

export function buildLocalEvent(input: {
  eventType: LocalEvent["eventType"];
  skill: SkillSummary;
  targetType: TargetType;
  targetID: string;
  targetPath: string;
  requestedMode: RequestedMode;
  resolvedMode: RequestedMode;
  fallbackReason: string | null;
  occurredAt: string;
  result?: LocalEvent["result"];
}): LocalEvent {
  return {
    eventID: `evt_${crypto.randomUUID()}`,
    eventType: input.eventType,
    skillID: input.skill.skillID,
    version: input.skill.localVersion ?? input.skill.version,
    targetType: input.targetType,
    targetID: input.targetID,
    targetPath: input.targetPath,
    requestedMode: input.requestedMode,
    resolvedMode: input.resolvedMode,
    fallbackReason: input.fallbackReason,
    occurredAt: input.occurredAt,
    result: input.result ?? "success"
  };
}

export function mapPreviewTool(tool: ToolConfig, platform: DesktopPlatform): ToolConfig {
  if (tool.toolID === "custom_directory") {
    return {
      ...tool,
      configuredPath: platform === "windows" ? tool.configuredPath : "~/ai-skills/shared",
      skillsPath: platform === "windows" ? tool.skillsPath : "~/ai-skills/shared",
      configPath: "手动维护"
    };
  }
  const detectedPath = defaultToolSkillsCandidates(tool.toolID, platform)[0] ?? null;
  const configuredPath = platform === "windows" ? tool.configuredPath : null;
  return {
    ...tool,
    configPath: defaultToolConfigPath(tool.toolID, platform),
    detectedPath,
    configuredPath,
    skillsPath: configuredPath ?? detectedPath ?? defaultToolSkillsPath(tool.toolID, platform)
  };
}

export function mapPreviewProject(project: ProjectConfig, platform: DesktopPlatform): ProjectConfig {
  const macProjectPath = project.projectPath
    .replaceAll("\\", "/")
    .replace(/^D:\/workspace/i, "~/workspace");
  const macSkillsPath = project.skillsPath
    .replaceAll("\\", "/")
    .replace(/^D:\/workspace/i, "~/workspace");
  return {
    ...project,
    projectPath: platform === "windows" ? project.projectPath : macProjectPath,
    skillsPath: platform === "windows" ? project.skillsPath : macSkillsPath
  };
}

export function seedLocalInstalls(): LocalSkillInstall[] {
  const platform = detectDesktopPlatform();
  return seedSkills
    .filter((skill) => skill.localVersion !== null)
    .map((skill) => ({
      skillID: skill.skillID,
      displayName: skill.displayName,
      localVersion: skill.localVersion ?? skill.version,
      localHash: skill.localVersion ? `sha256:local-${skill.skillID}` : skill.version,
      sourcePackageHash: `sha256:source-${skill.skillID}`,
      sourceType: "remote",
      installedAt: skill.lastEnabledAt ?? skill.publishedAt,
      updatedAt: skill.currentVersionUpdatedAt,
      localStatus: skill.enabledTargets.length > 0 ? "enabled" : "installed",
      centralStorePath: appendSkillPath(
        appendSkillPath(previewCentralStorePath(platform), skill.skillID, platform),
        skill.localVersion ?? skill.version,
        platform
      ),
      enabledTargets: skill.enabledTargets.map((target) => ({
        ...target,
        targetPath: target.targetType === "tool"
          ? appendSkillPath(defaultToolSkillsPath(target.targetID, platform) || "manual-target", skill.skillID, platform)
          : appendSkillPath(
              defaultProjectSkillsPath(
                platform === "windows" ? "D:\\workspace\\EnterpriseAgentHub" : "~/workspace/EnterpriseAgentHub",
                platform
              ),
              skill.skillID,
              platform
            )
      })),
      hasUpdate: skill.installState === "update_available",
      isScopeRestricted: skill.isScopeRestricted,
      canUpdate: skill.canUpdate
    }));
}

export function seedLocalExtensions(): ExtensionInstall[] {
  const fileBackedExtensions = seedLocalInstalls().map((install): ExtensionInstall => ({
    extensionID: install.skillID,
    extensionType: "skill",
    extensionKind: "file_backed",
    displayName: install.displayName,
    localVersion: install.localVersion,
    localHash: install.localHash,
    sourceType: install.sourceType,
    sourceURI: null,
    manifest: {
      extensionID: install.skillID,
      extensionType: "skill",
      extensionKind: "file_backed",
      displayName: install.displayName,
      version: install.localVersion,
      description: "由本地 Skill 安装投影为 file-backed Extension。",
      permissions: [
        {
          id: "file_backed",
          label: "文件部署",
          riskLevel: "low",
          description: "通过既有 Adapter 分发为托管文件。"
        }
      ],
      riskLevel: "unknown",
      auditStatus: "unknown"
    },
    permissions: [
      {
        id: "file_backed",
        label: "文件部署",
        riskLevel: "low",
        description: "通过既有 Adapter 分发为托管文件。"
      }
    ],
    riskLevel: "unknown",
    auditStatus: "unknown",
    enterpriseStatus: "allowed",
    centralStorePath: install.centralStorePath,
    installedAt: install.installedAt,
    updatedAt: install.updatedAt,
    writeCapability: true,
    targets: install.enabledTargets.map((target) => ({
      id: `${install.skillID}:${target.targetType}:${target.targetID}`,
      extensionID: install.skillID,
      extensionType: "skill",
      extensionKind: "file_backed",
      targetType: target.targetType,
      targetAgent: target.targetID,
      targetID: target.targetID,
      targetName: target.targetName,
      targetPath: target.targetPath,
      artifactPath: null,
      configPath: null,
      requestedMode: target.requestedMode,
      resolvedMode: target.resolvedMode,
      fallbackReason: target.fallbackReason,
      artifactHash: null,
      status: target.status ?? "enabled",
      denialReason: null,
      enabledAt: target.enabledAt,
      updatedAt: target.enabledAt
    }))
  }));
  const now = new Date().toISOString();
  const readOnlyExtensions: ExtensionInstall[] = [
    {
      extensionID: "p0-mcp-server-precheck",
      extensionType: "mcp_server",
      extensionKind: "config_backed",
      displayName: "MCP Server 预检样例",
      localVersion: "0.0.0-policy",
      localHash: "sha256:readonly-p0-mcp-server-precheck",
      sourceType: "policy",
      sourceURI: "policy://plugin-central-management/p0",
      manifest: {
        extensionID: "p0-mcp-server-precheck",
        extensionType: "mcp_server",
        extensionKind: "config_backed",
        displayName: "MCP Server 预检样例",
        version: "0.0.0-policy",
        description: "P0 仅展示 MCP Server 的审计/预检状态，不写入 MCP 配置。",
        permissions: [{ id: "config_read", label: "配置读取", riskLevel: "medium" }],
        riskLevel: "medium",
        auditStatus: "pending"
      },
      permissions: [{ id: "config_read", label: "配置读取", riskLevel: "medium" }],
      riskLevel: "medium",
      auditStatus: "pending",
      enterpriseStatus: "allowed",
      centralStorePath: null,
      installedAt: now,
      updatedAt: now,
      writeCapability: false,
      targets: []
    },
    {
      extensionID: "p0-native-plugin-precheck",
      extensionType: "plugin",
      extensionKind: "native_plugin",
      displayName: "原生 Plugin 预检样例",
      localVersion: "0.0.0-policy",
      localHash: "sha256:readonly-p0-native-plugin-precheck",
      sourceType: "policy",
      sourceURI: "policy://plugin-central-management/p0",
      manifest: {
        extensionID: "p0-native-plugin-precheck",
        extensionType: "plugin",
        extensionKind: "native_plugin",
        displayName: "原生 Plugin 预检样例",
        version: "0.0.0-policy",
        description: "P0 仅展示原生 Plugin 的来源、风险和审计状态。",
        permissions: [{ id: "native_runtime", label: "原生运行时", riskLevel: "high" }],
        riskLevel: "high",
        auditStatus: "warning"
      },
      permissions: [{ id: "native_runtime", label: "原生运行时", riskLevel: "high" }],
      riskLevel: "high",
      auditStatus: "warning",
      enterpriseStatus: "allowed",
      centralStorePath: null,
      installedAt: now,
      updatedAt: now,
      writeCapability: false,
      targets: []
    },
    {
      extensionID: "p0-hook-precheck",
      extensionType: "hook",
      extensionKind: "config_backed",
      displayName: "Hook 预检样例",
      localVersion: "0.0.0-policy",
      localHash: "sha256:readonly-p0-hook-precheck",
      sourceType: "policy",
      sourceURI: "policy://plugin-central-management/p0",
      manifest: {
        extensionID: "p0-hook-precheck",
        extensionType: "hook",
        extensionKind: "config_backed",
        displayName: "Hook 预检样例",
        version: "0.0.0-policy",
        description: "P0 仅展示 Hook 预检，不修改任何工具 hook 配置。",
        permissions: [{ id: "hook_config", label: "Hook 配置", riskLevel: "medium" }],
        riskLevel: "medium",
        auditStatus: "pending"
      },
      permissions: [{ id: "hook_config", label: "Hook 配置", riskLevel: "medium" }],
      riskLevel: "medium",
      auditStatus: "pending",
      enterpriseStatus: "allowed",
      centralStorePath: null,
      installedAt: now,
      updatedAt: now,
      writeCapability: false,
      targets: []
    },
    {
      extensionID: "p0-agent-cli-precheck",
      extensionType: "agent_cli",
      extensionKind: "agent_cli",
      displayName: "Agent CLI 预检样例",
      localVersion: "0.0.0-policy",
      localHash: "sha256:readonly-p0-agent-cli-precheck",
      sourceType: "policy",
      sourceURI: "policy://plugin-central-management/p0",
      manifest: {
        extensionID: "p0-agent-cli-precheck",
        extensionType: "agent_cli",
        extensionKind: "agent_cli",
        displayName: "Agent CLI 预检样例",
        version: "0.0.0-policy",
        description: "P0 不安装外部 CLI 二进制，只展示 CLI 型扩展预检状态。",
        permissions: [{ id: "binary_install", label: "外部二进制", riskLevel: "high" }],
        riskLevel: "high",
        auditStatus: "pending"
      },
      permissions: [{ id: "binary_install", label: "外部二进制", riskLevel: "high" }],
      riskLevel: "high",
      auditStatus: "pending",
      enterpriseStatus: "allowed",
      centralStorePath: null,
      installedAt: now,
      updatedAt: now,
      writeCapability: false,
      targets: []
    }
  ];
  return [...fileBackedExtensions, ...readOnlyExtensions];
}

export function mockScanSummaries(): ScanTargetSummary[] {
  const platform = detectDesktopPlatform();
  const codexSkillsPath = defaultToolSkillsPath("codex", platform);
  const projectRoot = platform === "windows" ? "D:\\workspace\\EnterpriseAgentHub" : "~/workspace/EnterpriseAgentHub";
  const projectSkillsPath = defaultProjectSkillsPath(projectRoot, platform);
  return [
    {
      id: "tool:codex",
      targetType: "tool",
      targetID: "codex",
      targetName: "Codex",
      targetPath: codexSkillsPath,
      transformStrategy: "codex_skill",
      scannedAt: new Date().toISOString(),
      counts: { managed: 1, unmanaged: 0, conflict: 1, orphan: 0 },
      findings: [
        {
          id: "tool:codex:context-router",
          kind: "managed",
          skillID: "context-router",
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: appendSkillPath(codexSkillsPath, "context-router", platform),
          relativePath: "context-router",
          checksum: "mock-managed",
          canImport: false,
          message: "目标内容与本地登记一致，处于托管状态。"
        },
        {
          id: "tool:codex:manual-note",
          kind: "conflict",
          skillID: null,
          targetType: "tool",
          targetID: "codex",
          targetName: "Codex",
          targetPath: appendSkillPath(codexSkillsPath, "manual-note", platform),
          relativePath: "manual-note",
          checksum: "mock-conflict",
          canImport: false,
          message: "发现未托管目录，启用时不会在未确认前覆盖。"
        }
      ],
      lastError: null
    },
    {
      id: "project:enterprise-agent-hub",
      targetType: "project",
      targetID: "enterprise-agent-hub",
      targetName: "Enterprise Agent Hub",
      targetPath: projectSkillsPath,
      transformStrategy: "codex_skill",
      scannedAt: new Date().toISOString(),
      counts: { managed: 1, unmanaged: 0, conflict: 0, orphan: 0 },
      findings: [
        {
          id: "project:enterprise-agent-hub:context-router",
          kind: "managed",
          skillID: "context-router",
          targetType: "project",
          targetID: "enterprise-agent-hub",
          targetName: "Enterprise Agent Hub",
          targetPath: appendSkillPath(projectSkillsPath, "context-router", platform),
          relativePath: "context-router",
          checksum: "mock-managed-project",
          canImport: false,
          message: "目标内容与本地登记一致，处于托管状态。"
        }
      ],
      lastError: null
    }
  ];
}
