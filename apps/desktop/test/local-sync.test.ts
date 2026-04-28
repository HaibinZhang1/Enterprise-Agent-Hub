import assert from "node:assert/strict";
import test from "node:test";
import { syncPendingOfflineEvents } from "../src/state/workspace/useWorkspaceLocalSync.ts";

const offlineEvent = {
  eventID: "evt-1",
  eventType: "enable_result",
  skillID: "codex-review-helper",
  version: "1.2.0",
  targetType: "tool",
  targetID: "codex",
  targetPath: "/Users/example/.codex/skills",
  requestedMode: "symlink",
  resolvedMode: "symlink",
  occurredAt: "2026-04-24T00:00:00.000Z",
  result: "success"
} as const;

test("syncPendingOfflineEvents uploads accepted events and marks them synced locally", async () => {
  const uploadedEvents: unknown[] = [];
  const markedEventIDs: string[] = [];
  let refreshed = false;
  let currentEvents = [offlineEvent];

  const synced = await syncPendingOfflineEvents({
    authState: "authenticated",
    connectionStatus: "connected",
    offlineEvents: currentEvents,
    async handleRemoteError() {
      throw new Error("sync should not report remote error");
    },
    async refreshLocalBootstrap() {
      refreshed = true;
      return {} as never;
    },
    setOfflineEvents(updater) {
      currentEvents = typeof updater === "function" ? updater(currentEvents) : updater;
    },
    async syncLocalEvents(events) {
      uploadedEvents.push(...events);
      return {
        acceptedEventIDs: ["evt-1"],
        rejectedEvents: [],
        serverStateChanged: true
      };
    },
    async markOfflineEventsSynced(eventIDs) {
      markedEventIDs.push(...eventIDs);
      return eventIDs;
    }
  });

  assert.equal(synced, true);
  assert.deepEqual(uploadedEvents, [offlineEvent]);
  assert.deepEqual(markedEventIDs, ["evt-1"]);
  assert.deepEqual(currentEvents, []);
  assert.equal(refreshed, true);
});

test("syncPendingOfflineEvents skips when workspace is offline", async () => {
  let called = false;
  const synced = await syncPendingOfflineEvents({
    authState: "authenticated",
    connectionStatus: "offline",
    offlineEvents: [offlineEvent],
    async handleRemoteError() {},
    async refreshLocalBootstrap() {
      return {} as never;
    },
    setOfflineEvents() {},
    async syncLocalEvents() {
      called = true;
      throw new Error("offline sync should not run");
    },
    async markOfflineEventsSynced() {
      return [];
    }
  });

  assert.equal(synced, false);
  assert.equal(called, false);
});
