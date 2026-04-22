import assert from "node:assert/strict";
import test from "node:test";
import type { LocalNotification } from "../src/domain/p1.ts";
import { deriveDesktopNotifications } from "../src/state/ui/desktopNotifications.ts";
import {
  cacheClientUpdateCheck,
  deriveAppUpdateState,
  type ServerAppUpdateNotification
} from "../src/state/ui/clientUpdates.ts";

type UpdateNotificationFixture = LocalNotification & Partial<ServerAppUpdateNotification> & {
  updateStatus?: "update_available" | "mandatory_update" | "unsupported_version";
};

function createServerUpdateNotification(overrides: Partial<UpdateNotificationFixture> = {}): UpdateNotificationFixture {
  return {
    notificationID: "notify-client-update",
    type: "app_update" as LocalNotification["type"],
    title: "桌面客户端更新 rel_01",
    summary: "升级到 1.6.0",
    relatedSkillID: null,
    targetPage: "home",
    occurredAt: "2026-04-22T10:00:00.000Z",
    unread: true,
    source: "server",
    releaseID: "rel_01",
    latestVersion: "1.6.0",
    updateStatus: "update_available",
    releaseNotes: "修复发布中心稳定性问题。",
    ...overrides
  };
}

test("desktop notifications dedupe check state and server app-update notices by release identity", () => {
  const cache = cacheClientUpdateCheck(
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
      publishedAt: "2026-04-22T09:58:00.000Z",
      releaseNotes: "修复发布中心稳定性问题。",
      mandatory: false,
      minSupportedVersion: null,
      downloadTicketRequired: true,
      releaseURL: null,
      lastCheckedAt: "2026-04-22T10:01:00.000Z"
    },
    null
  );
  const notifications = [createServerUpdateNotification()];
  const appUpdate = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache,
    notifications
  });

  const desktopNotifications = deriveDesktopNotifications({
    appUpdate,
    notifications
  });
  const appUpdateNotifications = desktopNotifications.filter((notification) => notification.kind === "app_update");

  assert.equal(appUpdateNotifications.length, 1);
  assert.equal(appUpdateNotifications[0]?.rawNotificationID, "notify-client-update");
  assert.equal(appUpdateNotifications[0]?.releaseID, "rel_01");
  assert.equal(appUpdateNotifications[0]?.latestVersion, "1.6.0");
});

test("mandatory server state reopens the prompt as unread after an optional dismiss", () => {
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
      publishedAt: "2026-04-22T09:58:00.000Z",
      releaseNotes: "可选更新。",
      mandatory: false,
      minSupportedVersion: null,
      downloadTicketRequired: true,
      releaseURL: null,
      lastCheckedAt: "2026-04-22T10:01:00.000Z"
    },
    null
  );
  const dismissedCache = {
    ...optionalCache,
    dismissedVersion: "1.6.0"
  };

  const optionalState = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache: dismissedCache,
    notifications: []
  });
  assert.equal(optionalState.unread, false);

  const mandatoryState = deriveAppUpdateState({
    currentVersion: "1.5.0",
    cache: dismissedCache,
    notifications: [
      createServerUpdateNotification({
        notificationID: "notify-client-update-mandatory",
        unread: false,
        updateStatus: "mandatory_update",
        summary: "当前版本必须升级到 1.6.0。",
        releaseNotes: "当前版本必须升级到 1.6.0。"
      })
    ]
  });

  assert.equal(mandatoryState.unread, true);
  assert.equal(mandatoryState.blocking, true);
});

test("an up-to-date check clears stale server app-update notices", () => {
  const upToDateCache = cacheClientUpdateCheck(
    {
      status: "up_to_date",
      updateType: "optional",
      currentVersion: "1.6.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      channel: "stable",
      packageName: null,
      sizeBytes: null,
      sha256: null,
      publishedAt: "2026-04-22T10:05:00.000Z",
      releaseNotes: "",
      mandatory: false,
      minSupportedVersion: null,
      downloadTicketRequired: true,
      releaseURL: null,
      lastCheckedAt: "2026-04-22T10:06:00.000Z"
    },
    null
  );
  const notifications = [createServerUpdateNotification()];
  const appUpdate = deriveAppUpdateState({
    currentVersion: "1.6.0",
    cache: upToDateCache,
    notifications
  });

  assert.equal(appUpdate.available, false);
  assert.equal(
    deriveDesktopNotifications({
      appUpdate,
      notifications
    }).some((notification) => notification.kind === "app_update"),
    false
  );
});
