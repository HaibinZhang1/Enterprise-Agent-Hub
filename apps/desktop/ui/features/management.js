export function createManagementFeature(app) {
  return Object.freeze({
    async loadManageableSkills() {
      return app.api.request('/api/skills/manageable');
    },
  });
}
