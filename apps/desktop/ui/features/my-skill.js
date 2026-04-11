function parseDepartmentIds(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createMySkillFeature(app) {
  return Object.freeze({
    async loadInstalledSkills() {
      return app.api.request('/api/skills/installed');
    },
    async loadOwnedSkills() {
      return app.api.request('/api/skills/my');
    },
    async submitPublish(values) {
      const packageId = `pkg-desktop-${Date.now()}`;
      const summary = String(values.summary ?? '').trim();
      const title = String(values.title ?? '').trim();
      const skillId = String(values.skillId ?? '').trim();
      const version = String(values.version ?? '').trim();

      await app.api.request('/api/packages/upload', {
        method: 'POST',
        body: JSON.stringify({
          packageId,
          manifest: {
            skillId,
            version,
            title,
            summary,
          },
          files: [
            {
              path: 'README.md',
              contentText: String(values.readme ?? '').trim() || `# ${title}\n\n${summary}\n`,
            },
            {
              path: 'SKILL.md',
              contentText:
                String(values.skillDefinition ?? '').trim() ||
                `name: ${skillId}\ndescription: ${summary || title}\n`,
            },
          ],
        }),
      });

      return app.api.request('/api/reviews/submit', {
        method: 'POST',
        body: JSON.stringify({
          packageId,
          skillId,
          reviewerUsername: String(values.reviewerUsername ?? '').trim(),
          visibility: String(values.visibility ?? 'private'),
          allowedDepartmentIds: parseDepartmentIds(values.allowedDepartmentIds),
        }),
      });
    },
  });
}
