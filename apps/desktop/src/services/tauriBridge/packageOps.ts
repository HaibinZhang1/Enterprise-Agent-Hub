import type { DownloadTicket, EnabledTarget, LocalEvent, LocalSkillInstall, RequestedMode, SkillSummary, TargetType } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedSkills } from "../../fixtures/p1SeedData.ts";
import { appendSkillPath, detectDesktopPlatform, previewCentralStorePath } from "../../utils/platformPaths.ts";
import { pendingLocalCommand } from "./common.ts";
import { buildLocalEvent, buildTarget } from "./preview.ts";
import { allowTauriMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

function mockInstalledPackage(downloadTicket: DownloadTicket): LocalSkillInstall {
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
}

function fallbackSkill(skillID: string): SkillSummary {
  return {
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
  };
}

export async function installSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.installSkillPackage, { downloadTicket });
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("install_skill_package");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return mockInstalledPackage(downloadTicket);
}

export async function updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.updateSkillPackage, { downloadTicket });
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("update_skill_package");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return mockInstalledPackage(downloadTicket);
}

export async function uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[]; failedTargetIDs: string[]; event: LocalEvent }> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.uninstallSkill, { skillID });
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
      skill: skill ?? fallbackSkill(skillID),
      targetType: "tool",
      targetID: "local_install",
      targetPath: appendSkillPath(previewCentralStorePath(), skillID, detectDesktopPlatform()),
      requestedMode: "copy",
      resolvedMode: "copy",
      fallbackReason: null,
      occurredAt: new Date().toISOString()
    })
  };
}

export async function enableSkill(input: { skill: SkillSummary; targetType: TargetType; targetID: string; requestedMode: RequestedMode; allowOverwrite?: boolean }): Promise<{ target: EnabledTarget; event: LocalEvent }> {
  const invoke = getInvoke();
  if (invoke) {
    const target = await invoke<EnabledTarget>(P1_LOCAL_COMMANDS.enableSkill, {
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
}

export async function disableSkill(input: { skill: SkillSummary; targetID: string; targetType?: TargetType }): Promise<{ event: LocalEvent }> {
  const invoke = getInvoke();
  const existing = input.skill.enabledTargets.find(
    (target) => target.targetID === input.targetID && (!input.targetType || target.targetType === input.targetType)
  );
  if (invoke) {
    return invoke(P1_LOCAL_COMMANDS.disableSkill, {
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
}
