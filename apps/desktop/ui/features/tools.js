export function createToolsFeature(app) {
  return Object.freeze({
    async loadTools() {
      return app.api.request('/api/tools');
    },
    async scan() {
      return app.api.request('/api/tools/scan', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async buildRepairPreview(toolId) {
      return app.api.request(`/api/tools/${encodeURIComponent(toolId)}/repair-preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async confirmRepair(toolId, previewId) {
      return app.api.request(`/api/tools/${encodeURIComponent(toolId)}/repair`, {
        method: 'POST',
        body: JSON.stringify({ previewId }),
      });
    },
  });
}
