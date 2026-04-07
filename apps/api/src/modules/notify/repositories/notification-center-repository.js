import { createNotificationCenter } from '../core/notification-center.js';

export function createNotificationCenterRepository() {
  const center = createNotificationCenter();

  return Object.freeze({
    /**
     * @param {{ userId: string; category: string; title: string; body: string; now?: Date; metadata?: Record<string, unknown> }} input
     */
    notify(input) {
      return center.notify(input);
    },

    /**
     * @param {{ userId: string; reviewTodoCount: number; overdueTickets?: number; now?: Date }} input
     */
    setReviewTodoCount(input) {
      return center.setReviewTodoCount(input);
    },

    /**
     * @param {{ userId: string; updateAvailableCount: number; now?: Date }} input
     */
    setUpdateAvailableCount(input) {
      return center.setUpdateAvailableCount(input);
    },

    /**
     * @param {{ userId: string }} input
     */
    getBadges(input) {
      return center.getBadges(input);
    },

    /**
     * @param {{ userId: string }} input
     */
    listNotifications(input) {
      return center.listNotifications(input);
    },

    /**
     * @param {{ userId: string; includeReconnect?: boolean }} input
     */
    drainEvents(input) {
      return center.drainEvents(input);
    },

    /**
     * @param {{ userId: string; notificationId: string; now?: Date }} input
     */
    markRead(input) {
      return center.markRead(input);
    },

    /**
     * @param {{ userId: string; now?: Date }} input
     */
    readAll(input) {
      return center.readAll(input);
    },
  });
}
