import { renderMetric, renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { canManage, canReview, escapeHtml } from '../core/utils.js';

function renderList(title, items, emptyText) {
  return `
    <section class="content-panel glass-panel page-section">
      <h2>${escapeHtml(title)}</h2>
      ${
        items.length
          ? `<div class="bullet-list">${items.map((item) => `<article class="bullet-list__item">${item}</article>`).join('')}</div>`
          : `<p class="page-copy">${escapeHtml(emptyText)}</p>`
      }
    </section>
  `;
}

export function createHomePage(app) {
  return createPageModule({
    id: 'home',
    async render({ host }) {
      const state = app.store.getState();
      const market = state.remote.market.results.slice(0, 3);
      const notifications = state.remote.notifications.items.slice(0, 3);
      const mySkills = state.remote.mySkills.items.slice(0, 3);
      const tools = state.local.tools.items.slice(0, 3);
      const projects = state.local.projects.items.slice(0, 3);
      const session = state.session;

      host.innerHTML = `
        <div class="dashboard-container">
          <header style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color, #e0e0e0); padding-bottom: 12px;">
            <h1 style="margin: 0; font-size: 20px;">Workspace Overview</h1>
            <span class="state-pill" style="font-weight: normal;">${state.health.label}</span>
          </header>
          
          ${state.flash ? renderNotice({ title: 'System Notice', body: state.flash.message, tone: state.flash.tone ?? 'neutral' }) : ''}
          
          <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            ${renderMetric({ label: 'Current Account', value: session?.user?.username ?? 'Anonymous', meta: session?.user?.roleCode ?? 'Guest' })}
            ${renderMetric({ label: 'Unread Notifications', value: String(state.notificationBadge), meta: state.realtime.message })}
            ${renderMetric({ label: 'Local Projects', value: String(state.local.projects.items.length), meta: 'Managed locally' })}
            ${renderMetric({ label: 'System Health', value: state.health.label, meta: state.health.apiBaseUrl })}
          </section>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            ${renderList(
              'Recent Notifications',
              notifications.map(
                (item) => `<strong>${escapeHtml(item.title ?? item.category ?? 'Notice')}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(item.body ?? item.message ?? '')}</span>`,
              ),
              'Log in to view your notification stream.',
            )}
            
            ${renderList(
              'Recommended Skills',
              market.map(
                (item) => `<strong>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(item.summary ?? item.description ?? 'No summary')}</span>`,
              ),
              'Marketplace recommendations will appear here.',
            )}
            
            ${renderList(
              'Local Environment',
              [
                ...tools.map((tool) => `<strong>${escapeHtml(tool.displayName ?? tool.toolId ?? 'Tool')}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(tool.healthState ?? 'Registered')}</span>`),
                ...projects.map((project) => `<strong>${escapeHtml(project.displayName ?? project.projectId ?? 'Project')}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(project.projectPath ?? '')}</span>`),
              ],
              'No local tools or projects registered.',
            )}
            
            ${session?.user ? renderList(
              'My Skills',
              mySkills.map(
                (skill) => `<strong>${escapeHtml(skill.title ?? skill.skillId ?? 'My Skill')}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(skill.summary ?? skill.description ?? 'No summary')}</span>`,
              ),
              'Author your own skills here.',
            ) : ''}
            
            ${canReview(session) || canManage(session) ? renderList(
              'Management Queue',
              [
                `<strong>Pending Reviews</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(String(state.reviewBadge))} tickets need attention</span>`
              ],
              'No items in queue.',
            ) : ''}
          </div>
        </div>
      `;
    },
  });
}


