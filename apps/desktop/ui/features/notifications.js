import { computeUnreadCount } from '../core/utils.js';

export function createNotificationsFeature(app) {
  return Object.freeze({
    async loadNotifications() {
      const payload = await app.api.request('/api/notifications');
      return {
        ...payload,
        badges: payload.badges ?? {
          unreadCount: computeUnreadCount(payload.items ?? []),
        },
      };
    },
    async markRead(notificationId) {
      return app.api.request(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async readAll() {
      return app.api.request('/api/notifications/read-all', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
  });
}
