import type { EnabledTarget, LocalBootstrap, LocalEvent, LocalSkillInstall, ProjectConfig, RequestedMode, ScanTargetSummary, SkillSummary, TargetType, ToolConfig } from "../../domain/p1.ts";
import { seedProjects, seedSkills, seedTools } from "../../fixtures/p1SeedData.ts";
import { appendSkillPath, defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsCandidates, defaultToolSkillsPath, detectDesktopPlatform, previewCentralStorePath, type DesktopPlatform } from "../../utils/platformPaths.ts";

export function browserPreviewBootstrap(): LocalBootstrap {
  const platform = detectDesktopPlatform();
  return {
    installs: [],
    tools: [],
    projects: [],
    notifications: [],
    offlineEvents: [],
    pendingOfflineEventCount: 0,
    unreadLocalNotificationCount: 0,
    centralStorePath: `Browser preview: Tauri desktop app required for local state (${previewCentralStorePath(platform)})`
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
          message: "目标内容与本地登记一致，处于托管状态。"
        }
      ],
      lastError: null
    }
  ];
}
