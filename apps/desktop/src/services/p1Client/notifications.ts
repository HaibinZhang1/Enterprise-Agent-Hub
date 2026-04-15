import type { LocalNotification } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON } from "./core.ts";
import type { ApiNotification, ApiPage } from "./shared.ts";
import { normalizeNotification } from "./shared.ts";

export function createNotificationsClient() {
  return {
    async listNotifications(unreadOnly = false): Promise<LocalNotification[]> {
      const response = await requestJSON<ApiPage<ApiNotification>>(`${P1_API_ROUTES.notifications}?unreadOnly=${String(unreadOnly)}`);
      return response.items.map(normalizeNotification);
    },

    async markNotificationsRead(notificationIDs: string[] | "all"): Promise<{ unreadNotificationCount: number }> {
      return requestJSON<{ unreadNotificationCount: number }>(P1_API_ROUTES.notificationsMarkRead, {
        method: "POST",
        body: JSON.stringify({ notificationIDs: notificationIDs === "all" ? [] : notificationIDs, all: notificationIDs === "all" })
      });
    },
  };
}
