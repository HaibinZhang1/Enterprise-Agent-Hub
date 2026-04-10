import { createPageModule } from '../core/page-lifecycle.js';
import { renderNotice, renderSectionHeader } from '../components/states.js';

export function createMySkillPage(app) {
  return createPageModule({
    id: 'my-skill',
    async render({ host }) {
      const session = app?.store?.getState?.()?.session ?? null;
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Desktop workspace',
          title: 'My Skill',
          body: 'This page module owns the My Skill surface inside the desktop shell.',
        })}
        ${renderNotice({
          title: 'My Skill page module ready',
          body: session ? 'Session-aware page rendering is routed through feature modules.' : 'Guest-safe shell rendering stays inside the page boundary until sign-in.',
        })}
      `;
    },
  });
}
