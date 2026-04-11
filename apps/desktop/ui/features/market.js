export function createMarketFeature(app) {
  return Object.freeze({
    async loadMarket(query) {
      return app.api.request(`/api/market?query=${encodeURIComponent(query ?? '')}`);
    },
    async requestInstallCandidate(payload) {
      return app.api.request('/api/market/install-candidate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  });
}
