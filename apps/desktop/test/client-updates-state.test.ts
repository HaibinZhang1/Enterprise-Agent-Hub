import assert from "node:assert/strict";
import test from "node:test";
import { buildSettingsPanels } from "../src/state/useDesktopUIState.ts";
import {
  cacheClientUpdateCheck,
  defaultAppUpdateState,
  deriveAppUpdateState,
  dismissOptionalClientUpdate
} from "../src/state/ui/clientUpdates.ts";

test("cached client update state replaces the placeholder and keeps release identity", () => {
  const cache = cacheClientUpdateCheck(
    {
      status: "update_available",
      updateType: "optional",
      currentVersion: "1.5.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      channel: "stable",
      packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
      sizeBytes: 124_000_000,
      sha256: "hex-encoded-sha256",
      publishedAt: "2026-04-19T10:00:00.000Z",
      releaseNotes: "修复发布中心稳定性问题，并优化设置页更新提示。",
      mandatory: false,
      minSupportedVersion: "1.4.0",
      downloadTicketRequired: true,
      releaseURL: "https://downloads.example.com/client-updates/rel_01",
      lastCheckedAt: "2026-04-22T10:00:00.000Z"
    },
    null
  );

  const appUpdate = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache,
    notifications: []
  });

  assert.equal(appUpdate.available, true);
  assert.equal(appUpdate.currentVersion, "1.5.0");
  assert.equal(appUpdate.latestVersion, "1.6.0");
  assert.equal(appUpdate.releaseID, "rel_01");
  assert.equal(appUpdate.unread, true);
  assert.match(appUpdate.summary, /修复发布中心稳定性问题/);
  assert.equal(defaultAppUpdateState("1.5.0").available, false);
});

test("optional dismiss suppresses unread until a mandatory status reopens the prompt", () => {
  const optionalCache = cacheClientUpdateCheck(
    {
      status: "update_available",
      updateType: "optional",
      currentVersion: "1.5.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      channel: "stable",
      packageName: null,
      sizeBytes: null,
      sha256: null,
      publishedAt: "2026-04-19T10:00:00.000Z",
      releaseNotes: "可选更新。",
      mandatory: false,
      minSupportedVersion: null,
      downloadTicketRequired: true,
      releaseURL: null,
      lastCheckedAt: "2026-04-22T10:00:00.000Z"
    },
    null
  );

  const dismissedCache = dismissOptionalClientUpdate(optionalCache, {
    available: true,
    latestVersion: "1.6.0",
    releaseID: "rel_01",
    blocking: false
  });
  const optionalState = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache: dismissedCache,
    notifications: []
  });
  assert.equal(optionalState.unread, false);

  const mandatoryCache = cacheClientUpdateCheck(
    {
      status: "mandatory_update",
      updateType: "mandatory",
      currentVersion: "1.5.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      channel: "stable",
      packageName: null,
      sizeBytes: null,
      sha256: null,
      publishedAt: "2026-04-19T10:00:00.000Z",
      releaseNotes: "必须升级。",
      mandatory: true,
      minSupportedVersion: "1.5.0",
      downloadTicketRequired: true,
      releaseURL: null,
      lastCheckedAt: "2026-04-22T10:05:00.000Z"
    },
    dismissedCache
  );
  const mandatoryState = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache: mandatoryCache,
    notifications: []
  });

  assert.equal(mandatoryState.unread, true);
  assert.equal(mandatoryState.blocking, true);
  assert.equal(mandatoryState.reasonBadge, "强制更新");
});

test("settings panel reflects blocking update states", () => {
  const panels = buildSettingsPanels({
    language: "zh-CN",
    theme: "classic",
    hasAgentKey: false,
    connectionStatus: "connected",
    appUpdate: {
      ...defaultAppUpdateState("1.5.0"),
      available: true,
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      status: "mandatory_update",
      summary: "必须升级。",
      releaseNotes: "必须升级。",
      highlights: ["必须升级。"],
      unread: true,
      mandatory: true,
      blocking: true,
      reasonBadge: "强制更新"
    }
  });

  assert.equal(panels.find((panel) => panel.id === "sync")?.status, "必须更新");
});
