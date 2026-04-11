function toolSkillPath(toolId, skillId, suffix) {
  return `/api/tools/${encodeURIComponent(toolId)}/skills/${encodeURIComponent(skillId)}/${suffix}`;
}

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
    async buildSkillBindingPreview(toolId, skillId, payload) {
      return app.api.request(toolSkillPath(toolId, skillId, 'bind-preview'), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async confirmSkillBinding(toolId, skillId, previewId) {
      return app.api.request(toolSkillPath(toolId, skillId, 'bind'), {
        method: 'POST',
        body: JSON.stringify({ previewId }),
      });
    },
  });
}
