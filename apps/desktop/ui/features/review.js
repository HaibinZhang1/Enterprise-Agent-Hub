export function createReviewFeature(app) {
  return Object.freeze({
    async loadQueue() {
      return app.api.request('/api/reviews');
    },
    async claim(ticketId) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}/claim`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async approve(ticketId, comment) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
    },
  });
}
