import { SSE_PAYLOAD_FIXTURE } from '@enterprise-agent-hub/contracts';

/**
 * @typedef {{ id: string; readAt: string | null }} NotificationRecord
 */

/**
 * @param {{
 *   notifications: NotificationRecord[];
 *   reviewTickets: Array<{ status: string }>;
 *   updateSignals: Array<{ status: string }>;
 *   now: Date;
 * }} input
 */
export function createNotificationBadgeProjection(input) {
  const unreadCount = input.notifications.filter((notification) => notification.readAt === null).length;
  const reviewTodoCount = input.reviewTickets.filter((ticket) => ticket.status === 'todo').length;
  const updateAvailableCount = input.updateSignals.filter((update) => update.status === 'available').length;

  return Object.freeze({
    unreadCount,
    reviewTodoCount,
    updateAvailableCount,
    generatedAt: input.now.toISOString(),
  });
}

/**
 * @param {{
 *   notifications: NotificationRecord[];
 *   notificationIds?: string[];
 *   now: Date;
 * }} input
 */
export function markNotificationsRead(input) {
  const notificationIds = new Set(input.notificationIds ?? input.notifications.map((notification) => notification.id));
  const readAt = input.now.toISOString();

  return Object.freeze(
    input.notifications.map((notification) =>
      notificationIds.has(notification.id)
        ? Object.freeze({ ...notification, readAt })
        : notification,
    ),
  );
}

/**
 * @param {{
 *   badgeProjection: ReturnType<typeof createNotificationBadgeProjection>;
 *   openTickets: number;
 *   overdueTickets: number;
 *   updateSignal?: { skillId: string; version: string; severity: string };
 * }} input
 */
export function buildNotificationSsePayloads(input) {
  /** @type {Array<{ event: string; payload: Record<string, unknown> }>} */
  const events = [
    Object.freeze({
      event: SSE_PAYLOAD_FIXTURE.streams.badge.event,
      payload: input.badgeProjection,
    }),
    Object.freeze({
      event: SSE_PAYLOAD_FIXTURE.streams.reviewQueue.event,
      payload: {
        openTickets: input.openTickets,
        overdueTickets: input.overdueTickets,
        generatedAt: input.badgeProjection.generatedAt,
      },
    }),
  ];

  if (input.updateSignal) {
    events.push(
      Object.freeze({
        event: SSE_PAYLOAD_FIXTURE.streams.installUpdate.event,
        payload: input.updateSignal,
      }),
    );
  }

  return Object.freeze(events);
}
