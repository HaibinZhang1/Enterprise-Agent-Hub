import { SSE_PAYLOAD_FIXTURE } from '@enterprise-agent-hub/contracts';

/**
 * @param {string} generatedAt
 */
function createDefaultBadgeState(generatedAt) {
  return {
    unreadCount: 0,
    reviewTodoCount: 0,
    updateAvailableCount: 0,
    generatedAt,
  };
}

/**
 * @param {Map<string, { notifications: Array<Record<string, unknown>>; badges: { unreadCount: number; reviewTodoCount: number; updateAvailableCount: number; generatedAt: string }; events: Array<{ event: string; payload: Record<string, unknown> }> }>} store
 * @param {string} userId
 * @param {Date} now
 */
function ensureUserState(store, userId, now) {
  if (!store.has(userId)) {
    store.set(userId, {
      notifications: [],
      badges: createDefaultBadgeState(now.toISOString()),
      events: [],
    });
  }

  return /** @type {{ notifications: Array<Record<string, unknown>>; badges: { unreadCount: number; reviewTodoCount: number; updateAvailableCount: number; generatedAt: string }; events: Array<{ event: string; payload: Record<string, unknown> }> }} */ (store.get(userId));
}

/**
 * @param {{ unreadCount: number; reviewTodoCount: number; updateAvailableCount: number; generatedAt: string }} badges
 */
function cloneBadges(badges) {
  return Object.freeze({ ...badges });
}

export function createNotificationCenter() {
  const stateByUser = new Map();

  /**
   * @param {{ userId: string; now?: Date }} input
   */
  function emitBadgeEvent(input) {
    const now = input.now ?? new Date();
    const userState = ensureUserState(stateByUser, input.userId, now);
    userState.badges.generatedAt = now.toISOString();
    userState.events.push({
      event: SSE_PAYLOAD_FIXTURE.streams.badge.event,
      payload: cloneBadges(userState.badges),
    });
  }

  return Object.freeze({
    /**
     * @param {{
     *   userId: string;
     *   category: string;
     *   title: string;
     *   body: string;
     *   now?: Date;
     *   metadata?: Record<string, unknown>;
     * }} input
     */
    notify(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      const notification = Object.freeze({
        id: `${input.userId}-${userState.notifications.length + 1}`,
        category: input.category,
        title: input.title,
        body: input.body,
        readAt: null,
        createdAt: now.toISOString(),
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
      });

      userState.notifications.unshift(notification);
      userState.badges.unreadCount = userState.notifications.filter((entry) => entry.readAt === null).length;
      emitBadgeEvent({ userId: input.userId, now });
      return notification;
    },

    /**
     * @param {{ userId: string; reviewTodoCount: number; overdueTickets?: number; now?: Date }} input
     */
    setReviewTodoCount(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      userState.badges.reviewTodoCount = input.reviewTodoCount;
      userState.badges.generatedAt = now.toISOString();
      userState.events.push({
        event: SSE_PAYLOAD_FIXTURE.streams.reviewQueue.event,
        payload: Object.freeze({
          openTickets: input.reviewTodoCount,
          overdueTickets: input.overdueTickets ?? 0,
          generatedAt: now.toISOString(),
        }),
      });
      emitBadgeEvent({ userId: input.userId, now });
      return cloneBadges(userState.badges);
    },

    /**
     * @param {{ userId: string; updateAvailableCount: number; now?: Date }} input
     */
    setUpdateAvailableCount(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      userState.badges.updateAvailableCount = input.updateAvailableCount;
      emitBadgeEvent({ userId: input.userId, now });
      return cloneBadges(userState.badges);
    },

    /**
     * @param {{ userId: string; notificationId: string; now?: Date }} input
     */
    markRead(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      userState.notifications = userState.notifications.map((entry) =>
        entry.id === input.notificationId && entry.readAt === null
          ? Object.freeze({ ...entry, readAt: now.toISOString() })
          : entry,
      );
      userState.badges.unreadCount = userState.notifications.filter((entry) => entry.readAt === null).length;
      emitBadgeEvent({ userId: input.userId, now });
      return cloneBadges(userState.badges);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    readAll(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      userState.notifications = userState.notifications.map((entry) =>
        entry.readAt === null ? Object.freeze({ ...entry, readAt: now.toISOString() }) : entry,
      );
      userState.badges.unreadCount = 0;
      emitBadgeEvent({ userId: input.userId, now });
      return cloneBadges(userState.badges);
    },

    /**
     * @param {{ userId: string; includeReconnect?: boolean; now?: Date }} input
     */
    drainEvents(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      const drained = userState.events.splice(0, userState.events.length);
      if (input.includeReconnect) {
        drained.push({
          event: SSE_PAYLOAD_FIXTURE.streams.reconnect.event,
          payload: Object.freeze({ ...SSE_PAYLOAD_FIXTURE.streams.reconnect.payload }),
        });
      }
      return Object.freeze(drained.map((entry) => Object.freeze({ ...entry })));
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    listNotifications(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      return Object.freeze([...userState.notifications]);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    getBadges(input) {
      const now = input.now ?? new Date();
      const userState = ensureUserState(stateByUser, input.userId, now);
      return cloneBadges(userState.badges);
    },
  });
}
