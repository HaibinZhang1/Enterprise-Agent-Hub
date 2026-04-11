export function createReviewFeature(app) {
  return Object.freeze({
    async loadQueue() {
      return app.api.request('/api/reviews');
    },
    async loadTicket(ticketId) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}`);
    },
    async loadHistory(ticketId) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}/history`);
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
    async reject(ticketId, comment) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
    },
    async returnForModification(ticketId, comment) {
      return app.api.request(`/api/reviews/${encodeURIComponent(ticketId)}/return`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
    },
  });
}
