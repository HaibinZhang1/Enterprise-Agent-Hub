import { PendingLocalCommandError, type DownloadTicket, type EnabledTarget, type LocalBootstrap, type LocalEvent, type LocalNotification, type LocalSkillInstall, type ProjectConfig, type ProjectDirectorySelection, type RequestedMode, type ScanTargetSummary, type SkillSummary, type TargetType, type ToolConfig, type ValidateTargetPathResult } from "../domain/p1";
import { seedProjects, seedSkills, seedTools } from "../fixtures/p1SeedData";
import { appendSkillPath, defaultProjectSkillsPath, defaultToolConfigPath, defaultToolSkillsCandidates, defaultToolSkillsPath, detectDesktopPlatform, previewCentralStorePath, type DesktopPlatform } from "../utils/platformPaths";

type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoker;
      };
    };
  }
}

const mockWait = (ms = 160) => new Promise((resolve) => window.setTimeout(resolve, ms));
const allowTauriMocks = import.meta.env.DEV && import.meta.env.VITE_P1_ALLOW_TAURI_MOCKS === "true";

function getInvoke(): TauriInvoker | null {
  return window.__TAURI__?.core?.invoke ?? null;
}

async function requireInvoke(): Promise<TauriInvoker> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke;
  }
  if (allowTauriMocks) {
    await mockWait();
    return async () => {
      throw new Error("Tauri mock dispatcher must be handled by the caller");
    };
  }
  throw new Error("Tauri runtime is unavailable; local Store/Adapter commands cannot run outside the Tauri desktop app.");
}

function isBrowserPreviewMode(): boolean {
  return getInvoke() === null && !allowTauriMocks;
}

function browserPreviewBootstrap(): LocalBootstrap {
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

function pendingLocalCommand(action: string): PendingLocalCommandError {
  return new PendingLocalCommandError(
    action,
    "当前运行在浏览器预览模式；登录和远端页面可用，但本地 Store/Adapter 操作需要在 Tauri desktop app 中执行。"
  );
}

function buildTarget(skill: SkillSummary, targetType: TargetType, targetID: string, requestedMode: RequestedMode): EnabledTarget {
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

function buildLocalEvent(input: {
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

function mapPreviewTool(tool: ToolConfig, platform: DesktopPlatform): ToolConfig {
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

function mapPreviewProject(project: ProjectConfig, platform: DesktopPlatform): ProjectConfig {
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

function seedLocalInstalls(): LocalSkillInstall[] {
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

function mockScanSummaries(): ScanTargetSummary[] {
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

export interface DesktopBridge {
  getLocalBootstrap(): Promise<LocalBootstrap>;
  installSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  saveToolConfig(tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }): Promise<ToolConfig>;
  saveProjectConfig(project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }): Promise<ProjectConfig>;
  uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[]; failedTargetIDs: string[]; event: LocalEvent }>;
  enableSkill(input: { skill: SkillSummary; targetType: TargetType; targetID: string; requestedMode: RequestedMode; allowOverwrite?: boolean }): Promise<{ target: EnabledTarget; event: LocalEvent }>;
  disableSkill(input: { skill: SkillSummary; targetID: string; targetType?: TargetType }): Promise<{ event: LocalEvent }>;
  upsertLocalNotifications(notifications: LocalNotification[]): Promise<void>;
  markLocalNotificationsRead(notificationIDs: string[] | "all"): Promise<void>;
  markOfflineEventsSynced(eventIDs: string[]): Promise<string[]>;
  listLocalInstalls(): Promise<LocalSkillInstall[]>;
  refreshToolDetection(): Promise<ToolConfig[]>;
  scanLocalTargets(): Promise<ScanTargetSummary[]>;
  validateTargetPath(targetPath: string): Promise<ValidateTargetPathResult>;
  pickProjectDirectory(): Promise<ProjectDirectorySelection | null>;
}

export const desktopBridge: DesktopBridge = {
  async getLocalBootstrap() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("get_local_bootstrap");
    }
    if (isBrowserPreviewMode()) {
      return browserPreviewBootstrap();
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait();
    return {
      installs: seedLocalInstalls(),
      tools: seedTools.map((tool) => mapPreviewTool(tool, detectDesktopPlatform())),
      projects: seedProjects.map((project) => mapPreviewProject(project, detectDesktopPlatform())),
      notifications: [],
      offlineEvents: [],
      pendingOfflineEventCount: 0,
      unreadLocalNotificationCount: 0,
      centralStorePath: previewCentralStorePath()
    };
  },

  async installSkillPackage(downloadTicket) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("install_skill_package", { downloadTicket });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("install_skill_package");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    return {
      skillID: downloadTicket.skillID,
      displayName: downloadTicket.skillID,
      localVersion: downloadTicket.version,
      localHash: downloadTicket.packageHash,
      sourcePackageHash: downloadTicket.packageHash,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localStatus: "installed",
      centralStorePath: "",
      enabledTargets: [],
      hasUpdate: false,
      isScopeRestricted: false,
      canUpdate: true
    };
  },

  async updateSkillPackage(downloadTicket) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("update_skill_package", { downloadTicket });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("update_skill_package");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    return {
      skillID: downloadTicket.skillID,
      displayName: downloadTicket.skillID,
      localVersion: downloadTicket.version,
      localHash: downloadTicket.packageHash,
      sourcePackageHash: downloadTicket.packageHash,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localStatus: "installed",
      centralStorePath: "",
      enabledTargets: [],
      hasUpdate: false,
      isScopeRestricted: false,
      canUpdate: true
    };
  },

  async saveToolConfig(tool) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("save_tool_config", { tool });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("save_tool_config");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(180);
    const base = seedTools.find((item) => item.toolID === tool.toolID);
    const platform = detectDesktopPlatform();
    const baseTool = base ? mapPreviewTool(base, platform) : null;
    return {
      toolID: tool.toolID,
      name: tool.name ?? base?.name ?? tool.toolID,
      displayName: tool.name ?? base?.displayName ?? tool.toolID,
      configPath: tool.configPath || baseTool?.configPath || defaultToolConfigPath(tool.toolID, platform),
      detectedPath: baseTool?.detectedPath ?? defaultToolSkillsCandidates(tool.toolID, platform)[0] ?? null,
      configuredPath: tool.configPath || null,
      skillsPath: tool.skillsPath,
      enabled: tool.enabled ?? true,
      status: "manual",
      adapterStatus: "manual",
      detectionMethod: "manual",
      transform: baseTool?.transform ?? "generic_directory",
      transformStrategy: baseTool?.transformStrategy ?? "generic_directory",
      enabledSkillCount: 0,
      lastScannedAt: null
    };
  },

  async saveProjectConfig(project) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("save_project_config", { project });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("save_project_config");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(200);
    const platform = detectDesktopPlatform();
    return {
      projectID: project.projectID ?? project.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: project.name,
      displayName: project.name,
      projectPath: project.projectPath,
      skillsPath: project.skillsPath || defaultProjectSkillsPath(project.projectPath, platform),
      enabled: project.enabled ?? true,
      enabledSkillCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  async uninstallSkill(skillID) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("uninstall_skill", { skillID });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("uninstall_skill");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    const skill = seedSkills.find((item) => item.skillID === skillID);
    return {
      removedTargetIDs: skill?.enabledTargets.map((target) => target.targetID) ?? [],
      failedTargetIDs: [],
      event: buildLocalEvent({
        eventType: "uninstall_result",
        skill: skill ?? {
          skillID,
          displayName: skillID,
          description: "",
          version: "0.0.0",
          localVersion: "0.0.0",
          status: "published",
          visibilityLevel: "detail_visible",
          detailAccess: "summary",
          canInstall: false,
          canUpdate: false,
          installState: "installed",
          currentVersionUpdatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          compatibleTools: [],
          compatibleSystems: [],
          tags: [],
          category: "local",
          riskLevel: "unknown",
          starCount: 0,
          downloadCount: 0,
          starred: false,
          isScopeRestricted: false,
          hasLocalHashDrift: false,
          enabledTargets: [],
          lastEnabledAt: null
        },
        targetType: "tool",
        targetID: "local_install",
        targetPath: appendSkillPath(previewCentralStorePath(), skillID, detectDesktopPlatform()),
        requestedMode: "copy",
        resolvedMode: "copy",
        fallbackReason: null,
        occurredAt: new Date().toISOString()
      })
    };
  },

  async enableSkill(input) {
    const invoke = getInvoke();
    if (invoke) {
      const target = await invoke<EnabledTarget>("enable_skill", {
        skillID: input.skill.skillID,
        version: input.skill.localVersion ?? input.skill.version,
        targetType: input.targetType,
        targetID: input.targetID,
        preferredMode: input.requestedMode,
        allowOverwrite: input.allowOverwrite ?? false
      });
      return {
        target,
        event: buildLocalEvent({
          eventType: "enable_result",
          skill: input.skill,
          targetType: input.targetType,
          targetID: input.targetID,
          targetPath: target.targetPath,
          requestedMode: target.requestedMode,
          resolvedMode: target.resolvedMode,
          fallbackReason: target.fallbackReason,
          occurredAt: target.enabledAt
        })
      };
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("enable_skill");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(240);
    const target = buildTarget(input.skill, input.targetType, input.targetID, input.requestedMode);
    return {
      target,
      event: buildLocalEvent({
        eventType: "enable_result",
        skill: input.skill,
        targetType: input.targetType,
        targetID: input.targetID,
        targetPath: target.targetPath,
        requestedMode: input.requestedMode,
        resolvedMode: target.resolvedMode,
        fallbackReason: target.fallbackReason,
        occurredAt: target.enabledAt
      })
    };
  },

  async disableSkill(input) {
    const invoke = getInvoke();
    const existing = input.skill.enabledTargets.find(
      (target) => target.targetID === input.targetID && (!input.targetType || target.targetType === input.targetType)
    );
    if (invoke) {
      return invoke("disable_skill", {
        skillID: input.skill.skillID,
        targetType: existing?.targetType ?? input.targetType ?? "tool",
        targetID: input.targetID
      });
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("disable_skill");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(180);
    return {
      event: buildLocalEvent({
        eventType: "disable_result",
        skill: input.skill,
        targetType: existing?.targetType ?? input.targetType ?? "tool",
        targetID: input.targetID,
        targetPath: existing?.targetPath ?? input.targetID,
        requestedMode: existing?.requestedMode ?? "symlink",
        resolvedMode: existing?.resolvedMode ?? "symlink",
        fallbackReason: existing?.fallbackReason ?? null,
        occurredAt: new Date().toISOString()
      })
    };
  },

  async upsertLocalNotifications(notifications) {
    if (notifications.length === 0) {
      return;
    }
    const invoke = getInvoke();
    if (invoke) {
      await invoke("upsert_local_notifications", { notifications });
      return;
    }
    if (isBrowserPreviewMode()) {
      return;
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(80);
  },

  async markLocalNotificationsRead(notificationIDs) {
    const invoke = getInvoke();
    if (invoke) {
      await invoke("mark_local_notifications_read", {
        notificationIDs: notificationIDs === "all" ? [] : notificationIDs,
        all: notificationIDs === "all"
      });
      return;
    }
    if (isBrowserPreviewMode()) {
      return;
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(80);
  },

  async markOfflineEventsSynced(eventIDs) {
    const invoke = getInvoke();
    if (invoke) {
      const result = await invoke<{ syncedEventIDs: string[] }>("mark_offline_events_synced", { eventIDs });
      return result.syncedEventIDs;
    }
    if (isBrowserPreviewMode()) {
      throw pendingLocalCommand("mark_offline_events_synced");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(120);
    return eventIDs;
  },

  async listLocalInstalls() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("list_local_installs");
    }
    if (isBrowserPreviewMode()) {
      return [];
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait();
    return seedLocalInstalls();
  },

  async refreshToolDetection() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("detect_tools");
    }
    if (isBrowserPreviewMode()) {
      return [];
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(240);
    return seedTools
      .map((tool) => mapPreviewTool(tool, detectDesktopPlatform()))
      .map((tool) => (tool.toolID === "windsurf" ? { ...tool, status: "missing" } : tool));
  },

  async scanLocalTargets() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("scan_local_targets");
    }
    if (isBrowserPreviewMode()) {
      return [];
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(240);
    return mockScanSummaries();
  },

  async validateTargetPath(targetPath) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("validate_target_path", { targetPath });
    }
    if (isBrowserPreviewMode()) {
      return {
        valid: false,
        writable: false,
        exists: false,
        canCreate: false,
        reason: "当前运行在浏览器预览模式；本地路径校验需要在 Tauri desktop app 中执行。"
      };
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(120);
    return {
      valid: targetPath.trim().length > 0,
      writable: targetPath.trim().length > 0,
      exists: false,
      canCreate: targetPath.trim().length > 0,
      reason: targetPath.trim().length > 0 ? null : "路径不能为空"
    };
  },

  async pickProjectDirectory() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("pick_project_directory");
    }
    if (isBrowserPreviewMode()) {
      return null;
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(120);
    return {
      projectPath: detectDesktopPlatform() === "windows" ? "D:\\workspace\\selected-project" : "~/workspace/selected-project"
    };
  }
};
