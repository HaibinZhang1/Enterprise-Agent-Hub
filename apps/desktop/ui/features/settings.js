function parseScanCommands(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function createSettingsFeature(app) {
  return Object.freeze({
    async loadSettings() {
      return app.api.request('/api/settings');
    },
    async saveSettings(values) {
      return app.api.request('/api/settings', {
        method: 'POST',
        body: JSON.stringify({
          apiBaseUrl: values.apiBaseUrl,
          scanCommands: parseScanCommands(values.scanCommands),
          defaultProjectBehavior: values.defaultProjectBehavior,
          appearance: values.appearance,
          updateChannel: values.updateChannel,
          language: values.language,
        }),
      });
    },
  });
}
