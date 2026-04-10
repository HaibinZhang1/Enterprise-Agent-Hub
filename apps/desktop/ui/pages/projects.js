import { createPageModule } from '../core/page-lifecycle.js';
import { renderNotice, renderSectionHeader } from '../components/states.js';

export function createProjectsPage(app) {
  return createPageModule({
    id: 'projects',
    async render({ host }) {
      const session = app?.store?.getState?.()?.session ?? null;
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Desktop workspace',
          title: 'Projects',
          body: 'This page module owns the Projects surface inside the desktop shell.',
        })}
        ${renderNotice({
          title: 'Projects page module ready',
          body: session ? 'Session-aware page rendering is routed through feature modules.' : 'Guest-safe shell rendering stays inside the page boundary until sign-in.',
        })}
      `;
    },
  });
}
