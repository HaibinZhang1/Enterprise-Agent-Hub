import type { LocalEvent } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON } from "./core.ts";

export function createDesktopSyncClient() {
  return {
    async syncLocalEvents(events: LocalEvent[]): Promise<{ acceptedEventIDs: string[]; rejectedEvents: LocalEvent[]; serverStateChanged: boolean }> {
      return requestJSON(P1_API_ROUTES.desktopLocalEvents, {
        method: "POST",
        body: JSON.stringify({ deviceID: "desktop_p1_default", events })
      });
    },
  };
}
