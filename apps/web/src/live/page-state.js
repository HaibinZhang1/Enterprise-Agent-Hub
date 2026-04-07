import { SSE_PAYLOAD_FIXTURE } from '@enterprise-agent-hub/contracts';

/**
 * @param {string} [reason]
 */
export function permissionDenied(reason = 'actor_required') {
  return Object.freeze({
    state: 'permission-denied',
    reason,
  });
}

/**
 * @param {readonly unknown[]} items
 * @param {Record<string, unknown>} [payload]
 */
export function resolveCollectionState(items, payload = {}) {
  return Object.freeze({
    state: items.length === 0 ? 'empty' : 'ready',
    ...payload,
  });
}

/**
 * @param {readonly { event: string; payload?: { fallback?: string | null } }[]} events
 */
export function buildReconnectBanner(events) {
  const reconnectEvent = events.find(
    /** @param {{ event: string; payload?: { fallback?: string | null } }} entry */
    (entry) => entry.event === SSE_PAYLOAD_FIXTURE.streams.reconnect.event,
  );
  return Object.freeze({
    visible: Boolean(reconnectEvent),
    fallback: reconnectEvent?.payload?.fallback ?? null,
  });
}
