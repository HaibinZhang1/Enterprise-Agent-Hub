function projectSkillPath(projectId, skillId, suffix) {
  return `/api/projects/${encodeURIComponent(projectId)}/skills/${encodeURIComponent(skillId)}/${suffix}`;
}

export function createProjectsFeature(app) {
  return Object.freeze({
    async loadProjects() {
      return app.api.request('/api/projects');
    },
    async createProject(payload) {
      return app.api.request('/api/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async validate(projectId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/validate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async rescan(projectId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/rescan`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async buildSwitchPreview(projectId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/switch-preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    async confirmSwitch(projectId, previewId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/switch`, {
        method: 'POST',
        body: JSON.stringify({ previewId }),
      });
    },
    async buildRepairPreview(projectId, projectPath) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/repair-preview`, {
        method: 'POST',
        body: JSON.stringify({ projectPath }),
      });
    },
    async confirmRepair(projectId, previewId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}/repair`, {
        method: 'POST',
        body: JSON.stringify({ previewId }),
      });
    },
    async buildSkillBindingPreview(projectId, skillId, payload) {
      return app.api.request(projectSkillPath(projectId, skillId, 'bind-preview'), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async confirmSkillBinding(projectId, skillId, previewId) {
      return app.api.request(projectSkillPath(projectId, skillId, 'bind'), {
        method: 'POST',
        body: JSON.stringify({ previewId }),
      });
    },
    async remove(projectId) {
      return app.api.request(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      });
    },
  });
}
