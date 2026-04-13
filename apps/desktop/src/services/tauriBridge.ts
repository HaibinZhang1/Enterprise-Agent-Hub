import { PendingLocalCommandError, type DownloadTicket, type EnabledTarget, type LocalBootstrap, type LocalEvent, type LocalSkillInstall, type ProjectConfig, type RequestedMode, type ScanTargetSummary, type SkillSummary, type TargetType, type ToolConfig, type ValidateTargetPathResult } from "../domain/p1";
import { seedProjects, seedSkills, seedTools } from "../fixtures/p1SeedData";

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
  return {
    installs: [],
    tools: [],
    projects: [],
    offlineEvents: [],
    pendingOfflineEventCount: 0,
    unreadLocalNotificationCount: 0,
    centralStorePath: "Browser preview: Tauri desktop app required for local state"
  };
}

function pendingLocalCommand(action: string): PendingLocalCommandError {
  return new PendingLocalCommandError(
    action,
    "当前运行在浏览器预览模式；登录和远端页面可用，但本地 Store/Adapter 操作需要在 Tauri desktop app 中执行。"
  );
}

function buildTarget(skill: SkillSummary, targetType: TargetType, targetID: string, requestedMode: RequestedMode): EnabledTarget {
  const tool = seedTools.find((item) => item.toolID === targetID);
  const project = seedProjects.find((item) => item.projectID === targetID);
  const targetPath = targetType === "tool" ? tool?.skillsPath : project?.skillsPath;
  const targetName = targetType === "tool" ? tool?.name : project?.name;
  const shouldFallback = targetID === "enterprise-agent-hub" || targetID === "opencode";

  return {
    targetType,
    targetID,
    targetName: targetName ?? targetID,
    targetPath: `${targetPath ?? "manual-target"}\\${skill.skillID}`,
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

function seedLocalInstalls(): LocalSkillInstall[] {
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
      centralStorePath: `%APPDATA%\\EnterpriseAgentHub\\CentralStore\\${skill.skillID}\\${skill.localVersion ?? skill.version}`,
      enabledTargets: skill.enabledTargets,
      hasUpdate: skill.installState === "update_available",
      isScopeRestricted: skill.isScopeRestricted,
      canUpdate: skill.canUpdate
    }));
}

function mockScanSummaries(): ScanTargetSummary[] {
  return [
    {
      id: "tool:codex",
      targetType: "tool",
      targetID: "codex",
      targetName: "Codex",
      targetPath: "%USERPROFILE%\\.codex\\skills",
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
          targetPath: "%USERPROFILE%\\.codex\\skills\\context-router",
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
          targetPath: "%USERPROFILE%\\.codex\\skills\\manual-note",
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
      targetPath: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills",
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
          targetPath: "D:\\workspace\\EnterpriseAgentHub\\.codex\\skills\\context-router",
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
  markOfflineEventsSynced(eventIDs: string[]): Promise<string[]>;
  listLocalInstalls(): Promise<LocalSkillInstall[]>;
  refreshToolDetection(): Promise<ToolConfig[]>;
  scanLocalTargets(): Promise<ScanTargetSummary[]>;
  validateTargetPath(targetPath: string): Promise<ValidateTargetPathResult>;
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
      tools: seedTools,
      projects: seedProjects,
      offlineEvents: [],
      pendingOfflineEventCount: 0,
      unreadLocalNotificationCount: 1,
      centralStorePath: "%APPDATA%\\EnterpriseAgentHub\\CentralStore"
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
    return {
      toolID: tool.toolID,
      name: tool.name ?? base?.name ?? tool.toolID,
      displayName: tool.name ?? base?.displayName ?? tool.toolID,
      configPath: tool.configPath || base?.configPath || "手动维护",
      detectedPath: base?.detectedPath ?? null,
      configuredPath: tool.configPath || null,
      skillsPath: tool.skillsPath,
      enabled: tool.enabled ?? true,
      status: "manual",
      adapterStatus: "manual",
      detectionMethod: "manual",
      transform: base?.transform ?? "generic_directory",
      transformStrategy: base?.transformStrategy ?? "generic_directory",
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
    return {
      projectID: project.projectID ?? project.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: project.name,
      displayName: project.name,
      projectPath: project.projectPath,
      skillsPath: project.skillsPath || `${project.projectPath}\\.codex\\skills`,
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
        targetPath: `%APPDATA%\\EnterpriseAgentHub\\CentralStore\\${skillID}`,
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
    return seedTools.map((tool) => (tool.toolID === "windsurf" ? { ...tool, status: "missing" } : tool));
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
  }
};
