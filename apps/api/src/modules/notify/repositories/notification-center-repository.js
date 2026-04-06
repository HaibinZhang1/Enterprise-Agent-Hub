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
  });
}
