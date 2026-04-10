import { createPageModule } from '../core/page-lifecycle.js';
import { renderNotice, renderSectionHeader } from '../components/states.js';

export function createToolsPage(app) {
  return createPageModule({
    id: 'tools',
    async render({ host }) {
      const session = app?.store?.getState?.()?.session ?? null;
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Desktop workspace',
          title: 'Tools',
          body: 'This page module owns the Tools surface inside the desktop shell.',
        })}
        ${renderNotice({
          title: 'Tools page module ready',
          body: session ? 'Session-aware page rendering is routed through feature modules.' : 'Guest-safe shell rendering stays inside the page boundary until sign-in.',
        })}
      `;
    },
  });
}
