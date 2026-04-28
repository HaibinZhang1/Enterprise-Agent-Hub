import type { LocalNotification } from "../../domain/p1.ts";
import { P1_LOCAL_COMMANDS } from "@enterprise-agent-hub/shared-contracts";
import { pendingLocalCommand } from "./common.ts";
import { allowTauriMocks, getInvoke, isBrowserPreviewMode, mockWait, requireInvoke } from "./runtime.ts";

export async function upsertLocalNotifications(notifications: LocalNotification[]): Promise<void> {
  if (notifications.length === 0) {
    return;
  }
  const invoke = getInvoke();
  if (invoke) {
    await invoke(P1_LOCAL_COMMANDS.upsertLocalNotifications, { notifications });
    return;
  }
  if (isBrowserPreviewMode()) {
    return;
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(80);
}

export async function markLocalNotificationsRead(notificationIDs: string[] | "all"): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    await invoke(P1_LOCAL_COMMANDS.markLocalNotificationsRead, buildMarkLocalNotificationsReadArgs(notificationIDs));
    return;
  }
  if (isBrowserPreviewMode()) {
    return;
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(80);
}

export function buildMarkLocalNotificationsReadArgs(notificationIDs: string[] | "all") {
  const ids = notificationIDs === "all" ? [] : notificationIDs;
  return {
    notificationIds: ids,
    notificationIDs: ids,
    all: notificationIDs === "all"
  };
}

export function buildMarkOfflineEventsSyncedArgs(eventIDs: string[]) {
  return {
    eventIds: eventIDs,
    eventIDs
  };
}

export async function markOfflineEventsSynced(eventIDs: string[]): Promise<string[]> {
  const invoke = getInvoke();
  if (invoke) {
    const result = await invoke<{ syncedEventIDs?: string[]; syncedEventIds?: string[] }>(
      P1_LOCAL_COMMANDS.markOfflineEventsSynced,
      buildMarkOfflineEventsSyncedArgs(eventIDs)
    );
    return result.syncedEventIDs ?? result.syncedEventIds ?? [];
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("mark_offline_events_synced");
  }
  if (!allowTauriMocks) {
    await requireInvoke();
  }
  await mockWait(120);
  return eventIDs;
}
