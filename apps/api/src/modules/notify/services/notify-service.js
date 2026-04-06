/**
 * @param {{ notificationRepository: ReturnType<typeof import('../repositories/notification-center-repository.js').createNotificationCenterRepository> }} input
 */
export function createNotifyService(input) {
  return Object.freeze({
    /**
     * @param {{ userId: string; category: string; title: string; body: string; now?: Date; metadata?: Record<string, unknown> }} event
     */
    notify(event) {
      return input.notificationRepository.notify(event);
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return input.notificationRepository.getBadges({ userId });
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return input.notificationRepository.listNotifications({ userId });
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return input.notificationRepository.drainEvents({ userId, includeReconnect: true });
    },
  });
}
