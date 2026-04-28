import type { DownloadTicket, EnabledTarget, ExtensionInstall, ExtensionKind, ExtensionType, LocalEvent, LocalSkillInstall, PluginTarget, RequestedMode, SkillSummary, TargetType } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { seedSkills } from "../../fixtures/p1SeedData.ts";
import { appendSkillPath, detectDesktopPlatform, previewCentralStorePath } from "../../utils/platformPaths.ts";
import { localCommandErrorMessage, pendingLocalCommand } from "./common.ts";
import { buildDisableSkillArgs, buildEnableSkillArgs, buildUninstallSkillArgs, normalizeUninstallSkillResult } from "./localCommandArgs.ts";
import { buildLocalEvent, buildTarget } from "./preview.ts";
import { allowDesktopMocks, getInvoke, invokeWithTimeout, isBrowserPreviewMode, mockWait, requireInvoke, type DesktopInvoker } from "./runtime.ts";

async function callLocalCommand<T>(invoke: DesktopInvoker, command: string, args: Record<string, unknown> | undefined, actionLabel: string): Promise<T> {
  try {
    return await invokeWithTimeout<T>(invoke, command, args);
  } catch (error) {
    throw new Error(localCommandErrorMessage(error, actionLabel));
  }
}

function mockInstalledPackage(downloadTicket: DownloadTicket): LocalSkillInstall {
  return {
    skillID: downloadTicket.skillID,
    displayName: downloadTicket.skillID,
    localVersion: downloadTicket.version,
    localHash: downloadTicket.packageHash,
    sourcePackageHash: downloadTicket.packageHash,
    sourceType: "remote",
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
    tags: ["入门"],
    category: "其他",
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
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.installSkillPackage, { downloadTicket }, "安装 Skill");
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("install_skill_package");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return mockInstalledPackage(downloadTicket);
}

export async function updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall> {
  const invoke = getInvoke();
  if (invoke) {
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.updateSkillPackage, { downloadTicket }, "更新 Skill");
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("update_skill_package");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return mockInstalledPackage(downloadTicket);
}

export async function importLocalSkill(input: {
  targetType: TargetType;
  targetID: string;
  relativePath: string;
  skillID: string;
  conflictStrategy: "rename" | "replace";
}): Promise<LocalSkillInstall> {
  const invoke = getInvoke();
  if (invoke) {
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.importLocalSkill, { input }, "纳入本地 Skill");
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("import_local_skill");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return {
    skillID: input.skillID,
    displayName: input.skillID,
    localVersion: "0.0.0-local",
    localHash: `sha256:local-${input.skillID}`,
    sourcePackageHash: `sha256:local-${input.skillID}`,
    sourceType: "local_import",
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localStatus: "enabled",
    centralStorePath: appendSkillPath(previewCentralStorePath(), input.skillID, detectDesktopPlatform()),
    enabledTargets: [
      buildTarget(fallbackSkill(input.skillID), input.targetType, input.targetID, "copy")
    ],
    hasUpdate: false,
    isScopeRestricted: false,
    canUpdate: false
  };
}

export async function uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[]; failedTargetIDs: string[]; event: LocalEvent }> {
  const invoke = getInvoke();
  if (invoke) {
    const result = await callLocalCommand<Parameters<typeof normalizeUninstallSkillResult>[0]>(
      invoke,
      P1_LOCAL_COMMANDS.uninstallSkill,
      buildUninstallSkillArgs(skillID),
      "卸载 Skill"
    );
    return normalizeUninstallSkillResult(result);
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("uninstall_skill");
  }
  if (!allowDesktopMocks) {
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
    const target = await callLocalCommand<EnabledTarget>(invoke, P1_LOCAL_COMMANDS.enableSkill, buildEnableSkillArgs(input), "启用 Skill");
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
  if (!allowDesktopMocks) {
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
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.disableSkill, {
      ...buildDisableSkillArgs({
        skillID: input.skill.skillID,
        targetType: existing?.targetType ?? input.targetType ?? "tool",
        targetID: input.targetID
      })
    }, "停用 Skill");
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("disable_skill");
  }
  if (!allowDesktopMocks) {
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

function assertFileBackedSkillExtension(input: { extensionType: ExtensionType; extensionKind: ExtensionKind }) {
  if (input.extensionKind !== "file_backed" || input.extensionType !== "skill") {
    throw new Error("extension_write_denied: P0 仅允许 file_backed Skill 通过既有 Adapter 写入。");
  }
}

function skillFromExtension(extension: ExtensionInstall): SkillSummary {
  return {
    skillID: extension.extensionID,
    displayName: extension.displayName,
    description: extension.manifest.description ?? "本地 Extension。",
    version: extension.localVersion,
    localVersion: extension.localVersion,
    latestVersion: extension.localVersion,
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: false,
    installState: extension.targets.some((target) => target.status === "enabled") ? "enabled" : "installed",
    currentVersionUpdatedAt: extension.updatedAt,
    publishedAt: extension.installedAt,
    compatibleTools: extension.targets.map((target) => target.targetAgent),
    compatibleSystems: [],
    tags: ["本地托管"],
    category: "其他",
    riskLevel: extension.riskLevel,
    starred: false,
    starCount: 0,
    downloadCount: 0,
    isScopeRestricted: extension.enterpriseStatus !== "allowed",
    hasLocalHashDrift: false,
    enabledTargets: extension.targets
      .filter((target) => target.status === "enabled")
      .map((target) => ({
        id: target.id,
        skillID: target.extensionID,
        targetType: target.targetType,
        targetID: target.targetID,
        targetName: target.targetName,
        targetPath: target.targetPath ?? "",
        artifactPath: target.artifactPath ?? "",
        installMode: target.resolvedMode ?? "copy",
        requestedMode: target.requestedMode ?? "copy",
        resolvedMode: target.resolvedMode ?? "copy",
        fallbackReason: target.fallbackReason ?? null,
        artifactHash: target.artifactHash ?? "",
        enabledAt: target.enabledAt ?? extension.updatedAt,
        updatedAt: target.updatedAt,
        status: target.status === "enabled" ? "enabled" : "disabled",
        lastError: target.denialReason ?? null
      })),
    lastEnabledAt: extension.targets[0]?.enabledAt ?? null
  };
}

export async function importLocalExtension(input: {
  extensionID: string;
  extensionType: ExtensionType;
  extensionKind: ExtensionKind;
  targetType: TargetType;
  targetID: string;
  relativePath: string;
  conflictStrategy: "rename" | "replace";
}): Promise<ExtensionInstall> {
  assertFileBackedSkillExtension(input);
  const invoke = getInvoke();
  if (invoke) {
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.importLocalExtension, { input }, "纳入本地 Extension");
  }
  const install = await importLocalSkill({
    targetType: input.targetType,
    targetID: input.targetID,
    relativePath: input.relativePath,
    skillID: input.extensionID,
    conflictStrategy: input.conflictStrategy
  });
  return {
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
      description: "由本地 Skill 导入投影为 file-backed Extension。",
      permissions: [],
      riskLevel: "unknown",
      auditStatus: "unknown"
    },
    permissions: [],
    riskLevel: "unknown",
    auditStatus: "unknown",
    enterpriseStatus: "allowed",
    centralStorePath: install.centralStorePath,
    installedAt: install.installedAt,
    updatedAt: install.updatedAt,
    writeCapability: true,
    targets: []
  };
}

export async function enableExtension(input: {
  extension: ExtensionInstall;
  targetType: TargetType;
  targetID: string;
  requestedMode: RequestedMode;
  allowOverwrite?: boolean;
}): Promise<PluginTarget> {
  assertFileBackedSkillExtension(input.extension);
  if (input.extension.enterpriseStatus !== "allowed") {
    throw new Error(`extension_policy_denied: ${input.extension.extensionID} is ${input.extension.enterpriseStatus}`);
  }
  const invoke = getInvoke();
  const commandInput = {
    extensionID: input.extension.extensionID,
    extensionType: input.extension.extensionType,
    extensionKind: input.extension.extensionKind,
    version: input.extension.localVersion,
    targetType: input.targetType,
    targetID: input.targetID,
    requestedMode: input.requestedMode,
    allowOverwrite: input.allowOverwrite ?? false
  };
  if (invoke) {
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.enableExtension, { input: commandInput }, "启用 Extension");
  }
  const result = await enableSkill({
    skill: skillFromExtension(input.extension),
    targetType: input.targetType,
    targetID: input.targetID,
    requestedMode: input.requestedMode,
    allowOverwrite: input.allowOverwrite
  });
  return {
    id: `${input.extension.extensionID}:${result.target.targetType}:${result.target.targetID}`,
    extensionID: input.extension.extensionID,
    extensionType: "skill",
    extensionKind: "file_backed",
    targetType: result.target.targetType,
    targetAgent: result.target.targetID,
    targetID: result.target.targetID,
    targetName: result.target.targetName,
    targetPath: result.target.targetPath,
    artifactPath: null,
    configPath: null,
    requestedMode: result.target.requestedMode,
    resolvedMode: result.target.resolvedMode,
    fallbackReason: result.target.fallbackReason,
    artifactHash: null,
    status: "enabled",
    denialReason: null,
    enabledAt: result.target.enabledAt,
    updatedAt: result.target.enabledAt
  };
}

export async function disableExtension(input: {
  extension: ExtensionInstall;
  targetID: string;
  targetType?: TargetType;
}): Promise<PluginTarget> {
  assertFileBackedSkillExtension(input.extension);
  const existing = input.extension.targets.find(
    (target) => target.targetID === input.targetID && (!input.targetType || target.targetType === input.targetType)
  );
  const commandInput = {
    extensionID: input.extension.extensionID,
    extensionType: input.extension.extensionType,
    extensionKind: input.extension.extensionKind,
    targetType: existing?.targetType ?? input.targetType ?? "tool",
    targetID: input.targetID
  };
  const invoke = getInvoke();
  if (invoke) {
    return callLocalCommand(invoke, P1_LOCAL_COMMANDS.disableExtension, { input: commandInput }, "停用 Extension");
  }
  await disableSkill({
    skill: skillFromExtension(input.extension),
    targetID: input.targetID,
    targetType: commandInput.targetType
  });
  return {
    ...(existing ?? {
      id: `${input.extension.extensionID}:${commandInput.targetType}:${input.targetID}`,
      extensionID: input.extension.extensionID,
      extensionType: input.extension.extensionType,
      extensionKind: input.extension.extensionKind,
      targetType: commandInput.targetType,
      targetAgent: input.targetID,
      targetID: input.targetID,
      targetName: input.targetID,
      updatedAt: new Date().toISOString()
    }),
    status: "disabled",
    updatedAt: new Date().toISOString()
  };
}
