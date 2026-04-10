import { createPageModule } from '../core/page-lifecycle.js';
import { renderNotice, renderSectionHeader } from '../components/states.js';

export function createHomePage(app) {
  return createPageModule({
    id: 'home',
    async render({ host }) {
      const session = app?.store?.getState?.()?.session ?? null;
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Desktop workspace',
          title: 'Home',
          body: 'This page module owns the Home surface inside the desktop shell.',
        })}
        ${renderNotice({
          title: 'Home page module ready',
          body: session ? 'Session-aware page rendering is routed through feature modules.' : 'Guest-safe shell rendering stays inside the page boundary until sign-in.',
        })}
      `;
    },
  });
}
