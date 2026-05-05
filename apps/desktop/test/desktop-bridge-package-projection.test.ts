import assert from "node:assert/strict";
import test from "node:test";
import type { EnabledTarget, ExtensionInstall, LocalSkillInstall } from "../src/domain/p1.ts";
import {
  assertFileBackedSkillExtension,
  extensionInstallFromLocalSkillInstall,
  pluginTargetFromEnabledSkillTarget,
  skillFromExtension
} from "../src/services/desktopBridge/packageProjection.ts";

const localInstall: LocalSkillInstall = {
  skillID: "demo-skill",
  displayName: "Demo Skill",
  localVersion: "1.0.0",
  localHash: "sha256:demo",
  sourcePackageHash: "sha256:demo",
  sourceType: "local_import",
  installedAt: "2026-04-28T12:00:00.000Z",
  updatedAt: "2026-04-28T12:00:00.000Z",
  localStatus: "enabled",
  centralStorePath: "/tmp/central-store/demo-skill",
  enabledTargets: [],
  hasUpdate: false,
  isScopeRestricted: false,
  canUpdate: false
};

const extension: ExtensionInstall = {
  extensionID: "demo-skill",
  extensionType: "skill",
  extensionKind: "file_backed",
  displayName: "Demo Skill",
  localVersion: "1.0.0",
  localHash: "sha256:demo",
  sourceType: "local_import",
  sourceURI: null,
  manifest: {
    extensionID: "demo-skill",
    extensionType: "skill",
    extensionKind: "file_backed",
    displayName: "Demo Skill",
    version: "1.0.0",
    description: "Demo description",
    permissions: [],
    riskLevel: "low",
    auditStatus: "passed"
  },
  permissions: [],
  riskLevel: "low",
  auditStatus: "passed",
  enterpriseStatus: "allowed",
  centralStorePath: "/tmp/central-store/demo-skill",
  installedAt: "2026-04-28T12:00:00.000Z",
  updatedAt: "2026-04-28T12:30:00.000Z",
  writeCapability: true,
  targets: [
    {
      id: "demo-skill:tool:codex",
      extensionID: "demo-skill",
      extensionType: "skill",
      extensionKind: "file_backed",
      targetType: "tool",
      targetAgent: "codex",
      targetID: "codex",
      targetName: "Codex",
      targetPath: "/tmp/codex/skills",
      artifactPath: "/tmp/codex/skills/demo-skill",
      configPath: null,
      requestedMode: "symlink",
      resolvedMode: "copy",
      fallbackReason: "symlink_failed",
      artifactHash: "sha256:artifact",
      status: "enabled",
      denialReason: null,
      enabledAt: "2026-04-28T12:10:00.000Z",
      updatedAt: "2026-04-28T12:10:00.000Z"
    }
  ]
};

const enabledTarget: EnabledTarget = {
  targetType: "tool",
  targetID: "codex",
  targetName: "Codex",
  targetPath: "/tmp/codex/skills",
  installMode: "symlink",
  requestedMode: "symlink",
  resolvedMode: "copy",
  fallbackReason: "symlink_failed",
  enabledAt: "2026-04-28T12:10:00.000Z",
  status: "enabled"
};

test("package projection keeps local Skill imports as file-backed Skill extensions", () => {
  const projected = extensionInstallFromLocalSkillInstall(localInstall);

  assert.equal(projected.extensionID, "demo-skill");
  assert.equal(projected.extensionType, "skill");
  assert.equal(projected.extensionKind, "file_backed");
  assert.equal(projected.centralStorePath, "/tmp/central-store/demo-skill");
  assert.equal(projected.writeCapability, true);
  assert.deepEqual(projected.targets, []);
});

test("package projection maps enabled extension targets back into Skill summaries", () => {
  const skill = skillFromExtension(extension);

  assert.equal(skill.skillID, "demo-skill");
  assert.equal(skill.installState, "enabled");
  assert.equal(skill.enabledTargets[0]?.requestedMode, "symlink");
  assert.equal(skill.enabledTargets[0]?.resolvedMode, "copy");
  assert.equal(skill.enabledTargets[0]?.fallbackReason, "symlink_failed");
});

test("package projection keeps enabled Skill target fields when creating plugin targets", () => {
  const target = pluginTargetFromEnabledSkillTarget({ extension, target: enabledTarget });

  assert.equal(target.id, "demo-skill:tool:codex");
  assert.equal(target.extensionType, "skill");
  assert.equal(target.extensionKind, "file_backed");
  assert.equal(target.requestedMode, "symlink");
  assert.equal(target.resolvedMode, "copy");
  assert.equal(target.fallbackReason, "symlink_failed");
  assert.equal(target.status, "enabled");
});

test("package projection denies non-file-backed extension writes", () => {
  assert.throws(
    () => assertFileBackedSkillExtension({ extensionType: "plugin", extensionKind: "native_plugin" }),
    /extension_write_denied/
  );
});
