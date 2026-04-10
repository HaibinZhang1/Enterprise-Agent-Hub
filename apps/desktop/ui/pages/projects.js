import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

function renderProject(project, currentProjectId) {
  const isCurrent = project.projectId === currentProjectId || project.isCurrent;
  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Multi-project control</p>
          <h2>${escapeHtml(project.displayName ?? project.projectId ?? 'Project')}</h2>
        </div>
        <span class="state-pill">${isCurrent ? 'Current' : 'Idle'}</span>
      </div>
      <p class="page-copy">${escapeHtml(project.projectPath ?? '')}</p>
      <div class="button-row">
        <button type="button" data-project-action="validate" data-project-id="${escapeHtml(project.projectId ?? '')}">Validate</button>
        <button type="button" data-project-action="rescan" data-project-id="${escapeHtml(project.projectId ?? '')}">Rescan</button>
        <button type="button" data-project-action="switch" data-project-id="${escapeHtml(project.projectId ?? '')}">Switch</button>
        <button type="button" data-project-action="repair" data-project-id="${escapeHtml(project.projectId ?? '')}">Repair</button>
        <button type="button" class="ghost-button" data-project-action="remove" data-project-id="${escapeHtml(project.projectId ?? '')}">Remove</button>
      </div>
    </article>
  `;
}

export function createProjectsPage(app) {
  return createPageModule({
    id: 'projects',
    async render({ host }) {
      const state = app.store.getState();
      host.innerHTML = `
        ${renderSectionHeader({ eyebrow: 'Multi-project control', title: 'Projects', body: '项目页保留注册、切换、验证、修复与删除能力。' })}
        <section class="content-panel glass-panel page-section">
          <form class="stack-form" data-project-form="true">
            <label>Display name<input name="displayName" type="text" placeholder="Desktop Workspace" required /></label>
            <label>Project path<input name="projectPath" type="text" placeholder="/Users/you/workspace/project" required /></label>
            <div class="form-actions full-span"><button type="submit">Register project</button></div>
          </form>
        </section>
        ${state.local.projects.items.length ? state.local.projects.items.map((project) => renderProject(project, state.local.projects.currentProjectId)).join('') : renderNotice({ title: '暂无项目', body: state.local.projects.message, tone: 'neutral' })}
      `;
    },
  });
}

