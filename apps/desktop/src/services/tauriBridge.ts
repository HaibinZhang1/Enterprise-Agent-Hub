import type { EnabledTarget, LocalEvent, ProjectConfig, RequestedMode, SkillSummary, TargetType, ToolConfig } from "../domain/p1";
import { seedProjects, seedTools } from "../fixtures/p1SeedData";

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
const allowTauriMocks = import.meta.env.VITE_P1_ALLOW_TAURI_MOCKS === "true";

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
  throw new Error("Tauri runtime is unavailable; local Store/Adapter commands cannot run in browser-only mode.");
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

export interface DesktopBridge {
  getLocalBootstrap(): Promise<{ tools: ToolConfig[]; projects: ProjectConfig[] }>;
  installSkillPackage(skill: SkillSummary): Promise<{ localVersion: string }>;
  updateSkillPackage(skill: SkillSummary): Promise<{ localVersion: string }>;
  uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[] }>;
  enableSkill(input: { skill: SkillSummary; targetType: TargetType; targetID: string; requestedMode: RequestedMode }): Promise<{ target: EnabledTarget; event: LocalEvent }>;
  disableSkill(input: { skill: SkillSummary; targetID: string }): Promise<{ event: LocalEvent }>;
  listLocalInstalls(): Promise<SkillSummary[]>;
  refreshToolDetection(): Promise<ToolConfig[]>;
}

export const desktopBridge: DesktopBridge = {
  async getLocalBootstrap() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("get_local_bootstrap");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait();
    return { tools: seedTools, projects: seedProjects };
  },

  async installSkillPackage(skill) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("install_skill_package", { skillID: skill.skillID, version: skill.version });
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    return { localVersion: skill.version };
  },

  async updateSkillPackage(skill) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("update_skill_package", { skillID: skill.skillID, version: skill.version });
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    return { localVersion: skill.version };
  },

  async uninstallSkill(skillID) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("uninstall_skill", { skillID });
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(220);
    return { removedTargetIDs: [] };
  },

  async enableSkill(input) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("enable_skill", {
        skillID: input.skill.skillID,
        targetType: input.targetType,
        targetID: input.targetID,
        requestedMode: input.requestedMode
      });
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(240);
    const target = buildTarget(input.skill, input.targetType, input.targetID, input.requestedMode);
    return {
      target,
      event: {
        eventID: `evt_${crypto.randomUUID()}`,
        eventType: "enable_result",
        skillID: input.skill.skillID,
        version: input.skill.localVersion ?? input.skill.version,
        targetType: input.targetType,
        targetID: input.targetID,
        targetPath: target.targetPath,
        requestedMode: input.requestedMode,
        resolvedMode: target.resolvedMode,
        fallbackReason: target.fallbackReason,
        occurredAt: target.enabledAt,
        result: "success"
      }
    };
  },

  async disableSkill(input) {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("disable_skill", { skillID: input.skill.skillID, targetID: input.targetID });
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(180);
    const existing = input.skill.enabledTargets.find((target) => target.targetID === input.targetID);
    return {
      event: {
        eventID: `evt_${crypto.randomUUID()}`,
        eventType: "disable_result",
        skillID: input.skill.skillID,
        version: input.skill.localVersion ?? input.skill.version,
        targetType: existing?.targetType ?? "tool",
        targetID: input.targetID,
        targetPath: existing?.targetPath ?? input.targetID,
        requestedMode: existing?.requestedMode ?? "symlink",
        resolvedMode: existing?.resolvedMode ?? "symlink",
        fallbackReason: existing?.fallbackReason ?? null,
        occurredAt: new Date().toISOString(),
        result: "success"
      }
    };
  },

  async listLocalInstalls() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("list_local_installs");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait();
    return [];
  },

  async refreshToolDetection() {
    const invoke = getInvoke();
    if (invoke) {
      return invoke("detect_tools");
    }
    if (!allowTauriMocks) {
      await requireInvoke();
    }
    await mockWait(240);
    return seedTools.map((tool) => (tool.toolID === "windsurf" ? { ...tool, status: "missing" } : tool));
  }
};
