import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { P1_LOCAL_COMMANDS, type DownloadTicketResponse, type LocalNotification } from "@enterprise-agent-hub/shared-contracts";
import { getElectronLocalStatePaths, migrateLegacyUserData } from "../src/electron/local/dataMigration.ts";
import { createElectronLocalRuntime } from "../src/electron/local/runtime.ts";

async function tempDir(label: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), `eah-${label}-`));
}

const fixedNow = () => new Date("2026-04-28T12:00:00.000Z");

test("legacy user-data migration copies legacy DB and central store into Electron data root", async () => {
  const legacyRoot = await tempDir("legacy-root");
  const electronUserData = await tempDir("electron-user-data");
  const legacyProduct = path.join(legacyRoot, "EnterpriseAgentHub");
  await mkdir(path.join(legacyProduct, "central-store", "demo-skill"), { recursive: true });
  await writeFile(path.join(legacyProduct, "skills.db"), "legacy db", "utf8");
  await writeFile(path.join(legacyProduct, "central-store", "demo-skill", "SKILL.md"), "# Demo", "utf8");

  const result = await migrateLegacyUserData({
    electronUserDataDir: electronUserData,
    legacyRoots: [legacyRoot],
    appVersion: "0.1.0",
    now: fixedNow
  });

  assert.equal(result.manifest.status, "copied");
  assert.deepEqual(result.manifest.copiedItems, ["skills.db", "central-store"]);
  assert.equal(await readFile(result.skillsDbPath, "utf8"), "legacy db");
  assert.equal(await readFile(path.join(result.centralStorePath, "demo-skill", "SKILL.md"), "utf8"), "# Demo");
  assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).appVersion, "0.1.0");
});

test("legacy user-data migration is idempotent and refuses conflicting target data", async () => {
  const legacyRoot = await tempDir("legacy-conflict");
  const electronUserData = await tempDir("electron-conflict");
  const legacyProduct = path.join(legacyRoot, "EnterpriseAgentHub");
  await mkdir(legacyProduct, { recursive: true });
  await writeFile(path.join(legacyProduct, "skills.db"), "legacy db", "utf8");

  const first = await migrateLegacyUserData({
    electronUserDataDir: electronUserData,
    legacyRoots: [legacyRoot],
    appVersion: "0.1.0",
    now: fixedNow
  });
  assert.equal(first.manifest.status, "copied");

  const second = await migrateLegacyUserData({
    electronUserDataDir: electronUserData,
    legacyRoots: [legacyRoot],
    appVersion: "0.1.1",
    now: fixedNow
  });
  assert.equal(second.manifest.status, "idempotent");

  await writeFile(path.join(getElectronLocalStatePaths(electronUserData).dataRoot, "skills.db"), "different db", "utf8");
  const third = await migrateLegacyUserData({
    electronUserDataDir: electronUserData,
    legacyRoots: [legacyRoot],
    appVersion: "0.1.2",
    now: fixedNow
  });
  assert.equal(third.manifest.status, "conflict");
  assert.deepEqual(third.manifest.conflictItems, ["skills.db"]);
  assert.equal(await readFile(third.skillsDbPath, "utf8"), "different db");
});

test("legacy user-data migration records source_missing without failing fresh installs", async () => {
  const electronUserData = await tempDir("electron-fresh");
  const result = await migrateLegacyUserData({
    electronUserDataDir: electronUserData,
    legacyRoots: [path.join(electronUserData, "missing")],
    appVersion: "0.1.0",
    now: fixedNow
  });

  assert.equal(result.manifest.status, "source_missing");
  assert.equal(result.manifest.sourceRoot, null);
});

test("Electron local runtime preserves local command contracts for bootstrap, config, package, scan, and notifications", async () => {
  const electronUserData = await tempDir("runtime");
  const runtime = createElectronLocalRuntime({
    electronUserDataDir: electronUserData,
    appVersion: "0.1.0",
    selectedProjectDirectory: async () => "/workspace/project-a",
    now: fixedNow
  });

  const tool = await runtime.invoke(P1_LOCAL_COMMANDS.saveToolConfig, {
    toolID: "codex",
    name: "Codex",
    configPath: "/tmp/codex/config.toml",
    skillsPath: "/tmp/codex/skills",
    enabled: true
  });
  assert.equal(tool.toolID, "codex");
  assert.equal(tool.adapterStatus, "manual");

  const project = await runtime.invoke(P1_LOCAL_COMMANDS.saveProjectConfig, {
    name: "Project A",
    projectPath: "/workspace/project-a",
    skillsPath: "/workspace/project-a/.codex/skills",
    enabled: true
  });
  assert.equal(project.projectID, "project-a");

  const ticket: DownloadTicketResponse = {
    skillID: "demo-skill",
    version: "1.0.0",
    packageRef: "pkg-demo-skill",
    packageURL: "https://example.test/demo.zip",
    packageHash: "sha256:abc123",
    packageSize: 42,
    packageFileCount: 2,
    expiresAt: "2026-04-28T13:00:00.000Z"
  };
  const installed = await runtime.invoke(P1_LOCAL_COMMANDS.installSkillPackage, { downloadTicket: ticket });
  assert.equal(installed.skillID, "demo-skill");
  assert.equal(installed.sourcePackageHash, "sha256:abc123");

  const enabled = await runtime.invoke(P1_LOCAL_COMMANDS.enableSkill, {
    skillId: "demo-skill",
    version: "1.0.0",
    targetType: "tool",
    targetId: "codex",
    preferredMode: "copy"
  });
  assert.equal(enabled.status, "enabled");
  assert.equal(enabled.targetPath, "/tmp/codex/skills");

  const bootstrap = await runtime.invoke(P1_LOCAL_COMMANDS.getLocalBootstrap, undefined);
  assert.equal(bootstrap.installs[0]?.enabledTargets[0]?.targetID, "codex");
  assert.equal(bootstrap.pendingOfflineEventCount, 1);
  assert.match(bootstrap.centralStorePath, /central-store$/);

  const scan = await runtime.invoke(P1_LOCAL_COMMANDS.scanLocalTargets, undefined);
  assert.equal(scan.find((target) => target.targetID === "codex")?.counts.managed, 1);

  const extensionScan = await runtime.invoke(P1_LOCAL_COMMANDS.scanExtensionTargets, undefined);
  assert.ok((extensionScan.find((target) => target.targetID === "codex")?.counts.unmanaged ?? 0) > 0);

  const notification: LocalNotification = {
    notificationID: "notice-1",
    type: "client_update",
    title: "Update",
    summary: "Ready",
    relatedSkillID: null,
    targetPage: "settings",
    occurredAt: "2026-04-28T12:00:00.000Z",
    unread: true,
    source: "local"
  };
  await runtime.invoke(P1_LOCAL_COMMANDS.upsertLocalNotifications, { notifications: [notification] });
  await runtime.invoke(P1_LOCAL_COMMANDS.markLocalNotificationsRead, { notificationIds: ["notice-1"], all: false });
  const afterNotifications = await runtime.invoke(P1_LOCAL_COMMANDS.getLocalBootstrap, undefined);
  assert.equal(afterNotifications.unreadLocalNotificationCount, 0);

  const syncResult = await runtime.invoke(P1_LOCAL_COMMANDS.markOfflineEventsSynced, { eventIds: [bootstrap.offlineEvents[0]!.eventID] });
  assert.deepEqual(syncResult.syncedEventIDs, [bootstrap.offlineEvents[0]!.eventID]);
  assert.equal((await runtime.invoke(P1_LOCAL_COMMANDS.getLocalBootstrap, undefined)).pendingOfflineEventCount, 0);

  assert.deepEqual(await runtime.invoke(P1_LOCAL_COMMANDS.pickProjectDirectory, undefined), { projectPath: "/workspace/project-a" });
});

test("Electron local runtime rejects path traversal IDs and relative target paths", async () => {
  const electronUserData = await tempDir("runtime-security");
  const runtime = createElectronLocalRuntime({
    electronUserDataDir: electronUserData,
    appVersion: "0.1.0",
    now: fixedNow
  });

  await assert.rejects(
    () => runtime.invoke(P1_LOCAL_COMMANDS.installSkillPackage, {
      downloadTicket: {
        skillID: "../escape",
        version: "1.0.0",
        packageRef: "pkg-escape",
        packageURL: "https://example.test/escape.zip",
        packageHash: "sha256:abc123",
        packageSize: 42,
        packageFileCount: 2,
        expiresAt: "2026-04-28T13:00:00.000Z"
      }
    }),
    /skillID must be a stable local identifier/
  );

  await assert.rejects(
    () => runtime.invoke(P1_LOCAL_COMMANDS.importLocalExtension, {
      input: {
        extensionID: "safe-extension",
        extensionType: "skill",
        extensionKind: "file_backed",
        targetType: "tool",
        targetID: "codex",
        relativePath: "../outside",
        conflictStrategy: "rename"
      }
    }),
    /relativePath cannot contain traversal segments/
  );

  const relativeValidation = await runtime.invoke(P1_LOCAL_COMMANDS.validateTargetPath, { targetPath: "relative/path" });
  assert.equal(relativeValidation.valid, false);
  assert.equal(relativeValidation.canCreate, false);
  assert.match(relativeValidation.reason ?? "", /绝对路径/);

  const missingParentValidation = await runtime.invoke(P1_LOCAL_COMMANDS.validateTargetPath, {
    targetPath: path.join(electronUserData, "missing-parent", "skills")
  });
  assert.equal(missingParentValidation.valid, false);
  assert.equal(missingParentValidation.canCreate, false);
});
