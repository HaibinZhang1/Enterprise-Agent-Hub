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
     * @param {{ userId: string; reviewTodoCount: number; overdueTickets?: number; now?: Date }} inputValue
     */
    setReviewTodoCount(inputValue) {
      return input.notificationRepository.setReviewTodoCount(inputValue);
    },

    /**
     * @param {{ userId: string; updateAvailableCount: number; now?: Date }} inputValue
     */
    setUpdateAvailableCount(inputValue) {
      return input.notificationRepository.setUpdateAvailableCount(inputValue);
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
     * @param {{ userId: string; notificationId: string; now?: Date }} inputValue
     */
    markRead(inputValue) {
      return input.notificationRepository.markRead(inputValue);
    },

    /**
     * @param {{ userId: string; now?: Date }} inputValue
     */
    readAll(inputValue) {
      return input.notificationRepository.readAll(inputValue);
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return input.notificationRepository.drainEvents({ userId, includeReconnect: true });
    },
  });
}
