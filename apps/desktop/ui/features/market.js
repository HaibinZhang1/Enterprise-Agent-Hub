export function createMarketFeature(app) {
  return Object.freeze({
    async loadMarket(query) {
      return app.api.request(`/api/market?query=${encodeURIComponent(query ?? '')}`);
    },
  });
}
