import type { LocalEvent } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON } from "./core.ts";

const LOCAL_EVENT_TIMESTAMP_PREFIX = "p1-local-";

export function normalizeLocalEventOccurredAt(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith(LOCAL_EVENT_TIMESTAMP_PREFIX)) {
    const millisText = trimmed.slice(LOCAL_EVENT_TIMESTAMP_PREFIX.length);
    if (/^\d+$/.test(millisText)) {
      const millis = Number(millisText);
      const timestamp = new Date(millis);
      if (Number.isFinite(millis) && !Number.isNaN(timestamp.getTime())) {
        return timestamp.toISOString();
      }
    }
    return value;
  }

  const parsedAt = Date.parse(trimmed);
  if (!Number.isNaN(parsedAt)) {
    return new Date(parsedAt).toISOString();
  }

  return value;
}

function normalizeLocalEventForSync(event: LocalEvent): LocalEvent {
  return {
    ...event,
    occurredAt: normalizeLocalEventOccurredAt(event.occurredAt)
  };
}

export function createDesktopSyncClient() {
  return {
    async syncLocalEvents(events: LocalEvent[]): Promise<{ acceptedEventIDs: string[]; rejectedEvents: LocalEvent[]; serverStateChanged: boolean }> {
      return requestJSON(P1_API_ROUTES.desktopLocalEvents, {
        method: "POST",
        body: JSON.stringify({ deviceID: "desktop_p1_default", events: events.map(normalizeLocalEventForSync) })
      });
    },
  };
}
