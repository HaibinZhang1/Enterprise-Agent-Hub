import type { EnabledTarget, ExtensionInstall, ExtensionKind, ExtensionType, LocalSkillInstall, PluginTarget, SkillSummary } from "../../domain/p1.ts";

export function assertFileBackedSkillExtension(input: { extensionType: ExtensionType; extensionKind: ExtensionKind }) {
  if (input.extensionKind !== "file_backed" || input.extensionType !== "skill") {
    throw new Error("extension_write_denied: P0 仅允许 file_backed Skill 通过既有 Adapter 写入。");
  }
}

export function fallbackSkill(skillID: string): SkillSummary {
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

export function skillFromExtension(extension: ExtensionInstall): SkillSummary {
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

export function extensionInstallFromLocalSkillInstall(install: LocalSkillInstall): ExtensionInstall {
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

export function pluginTargetFromEnabledSkillTarget(input: {
  readonly extension: ExtensionInstall;
  readonly target: EnabledTarget;
}): PluginTarget {
  return {
    id: `${input.extension.extensionID}:${input.target.targetType}:${input.target.targetID}`,
    extensionID: input.extension.extensionID,
    extensionType: input.extension.extensionType,
    extensionKind: input.extension.extensionKind,
    targetType: input.target.targetType,
    targetAgent: input.target.targetID,
    targetID: input.target.targetID,
    targetName: input.target.targetName,
    targetPath: input.target.targetPath,
    artifactPath: null,
    configPath: null,
    requestedMode: input.target.requestedMode,
    resolvedMode: input.target.resolvedMode,
    fallbackReason: input.target.fallbackReason,
    artifactHash: null,
    status: "enabled",
    denialReason: null,
    enabledAt: input.target.enabledAt,
    updatedAt: input.target.enabledAt
  };
}
