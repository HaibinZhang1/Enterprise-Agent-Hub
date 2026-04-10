export function createAuthFeature(app) {
  return Object.freeze({
    async loadSession() {
      const payload = await app.api.request('/api/session');
      app.setSession(payload.session ?? null);
      return payload;
    },
    async login(credentials) {
      const payload = await app.api.request('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      app.setSession(payload.session ?? null);
      return payload;
    },
    async logout() {
      try {
        await app.api.request('/api/logout', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } finally {
        app.setSession(null);
      }
    },
  });
}
