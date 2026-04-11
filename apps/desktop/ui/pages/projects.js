import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatIssues } from '../core/utils.js';

function summarizeBinding(binding) {
  const materialization = binding.materializationStatus;
  if (!binding.enabled) {
    return 'Disabled until you re-enable this skill for the project.';
  }
  if (!materialization) {
    return 'Enabled locally and ready for preview-confirm materialization checks.';
  }
  const status = materialization.status ?? 'unknown';
  const mode = materialization.mode ?? 'none';
  return `Materialization ${status} · mode ${mode}`;
}

function renderBinding(binding, project) {
  const toggleEnabled = binding.enabled ? 'false' : 'true';
  const toggleLabel = binding.enabled ? 'Disable' : 'Enable';
  const materialization = binding.materializationStatus;
  const materializationLabel = materialization ? `${materialization.status ?? 'unknown'} · ${materialization.mode ?? 'none'}` : 'Not materialized yet';

  return `
    <article class="content-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Bound Skill</p>
          <h3>${escapeHtml(binding.skillId ?? 'Skill')}</h3>
        </div>
        <span class="state-pill">${binding.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(binding.packageId ?? 'No package')}</span>
        <span>${escapeHtml(binding.version ?? 'No version')}</span>
        <span>${escapeHtml(materializationLabel)}</span>
      </div>
      <p class="page-copy">${escapeHtml(summarizeBinding(binding))}</p>
      <form class="stack-form" data-project-skill-form="toggle" data-project-skill-toggle="true">
        <input type="hidden" name="projectId" value="${escapeHtml(project.projectId ?? '')}" />
        <input type="hidden" name="skillId" value="${escapeHtml(binding.skillId ?? '')}" />
        <input type="hidden" name="packageId" value="${escapeHtml(binding.packageId ?? '')}" />
        <input type="hidden" name="version" value="${escapeHtml(binding.version ?? '')}" />
        <input type="hidden" name="skillsDirectory" value="${escapeHtml(project.skillsDirectory ?? '')}" />
        <input type="hidden" name="enabled" value="${escapeHtml(toggleEnabled)}" />
        <div class="form-actions full-span">
          <button type="submit">${toggleLabel}</button>
        </div>
      </form>
    </article>
  `;
}

function renderProject(project, currentProjectId) {
  const isCurrent = project.projectId === currentProjectId || project.isCurrent;
  const bindingsMarkup = project.skillBindings?.length
    ? project.skillBindings.map((binding) => renderBinding(binding, project)).join('')
    : renderNotice({
        title: 'No bound skills yet',
        body: 'Bind one Skill at a time. Every project-skill mutation stays preview-confirm gated.',
        tone: 'neutral',
      });

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
      <div class="meta-row">
        <span>${escapeHtml(project.healthLabel ?? project.healthState ?? 'unknown')}</span>
        <span>${escapeHtml(project.skillsDirectory ?? 'No skills directory')}</span>
      </div>
      <p class="page-copy">${escapeHtml(formatIssues(project.issues))}</p>
      <p class="page-copy">${escapeHtml(project.effectiveSummary ?? 'No effective project summary yet.')}</p>
      <div class="button-row">
        <button type="button" data-project-action="validate" data-project-id="${escapeHtml(project.projectId ?? '')}">Validate</button>
        <button type="button" data-project-action="rescan" data-project-id="${escapeHtml(project.projectId ?? '')}">Rescan</button>
        <button type="button" data-project-action="switch" data-project-id="${escapeHtml(project.projectId ?? '')}">Switch</button>
        <button type="button" data-project-action="repair" data-project-id="${escapeHtml(project.projectId ?? '')}">Repair</button>
        <button type="button" class="ghost-button" data-project-action="remove" data-project-id="${escapeHtml(project.projectId ?? '')}">Remove</button>
      </div>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">Skill management</p>
            <h3>Project detail / skill panel</h3>
          </div>
          <span class="state-pill">Single project · single Skill</span>
        </div>
        <p class="page-copy">Bound skills, version, enabled state, materialization status, and the effective local summary stay visible here.</p>
        ${bindingsMarkup}
        <form class="stack-form" data-project-skill-form="bind" data-project-skill-bind-form="true">
          <input type="hidden" name="projectId" value="${escapeHtml(project.projectId ?? '')}" />
          <label>Skill ID<input name="skillId" type="text" placeholder="skill-market-1" required /></label>
          <label>Package ID<input name="packageId" type="text" placeholder="pkg-market-1" required /></label>
          <label>Version<input name="version" type="text" placeholder="1.0.0" required /></label>
          <label>Skills directory<input name="skillsDirectory" type="text" value="${escapeHtml(project.skillsDirectory ?? '')}" /></label>
          <label>
            Enabled state
            <select name="enabled">
              <option value="true">Enable</option>
              <option value="false">Disable</option>
            </select>
          </label>
          <div class="form-actions full-span"><button type="submit">Preview bind / update</button></div>
        </form>
      </section>
    </article>
  `;
}

export function createProjectsPage(app) {
  let selectedId = 'new';

  return createPageModule({
    id: 'projects',
    async render({ host }) {
      const state = app.store.getState();
      const projects = state.local.projects.items;

      // Default selection to first project or 'new' if empty
      if (!selectedId || (selectedId !== 'new' && !projects.find(i => i.projectId === selectedId))) {
        selectedId = projects.length ? projects[0].projectId : 'new';
      }

      const listHtml = projects.map((project) => `
        <div class="split-view__item ${project.projectId === selectedId ? 'is-active' : ''}" data-id="${escapeHtml(project.projectId)}" style="${project.projectId === selectedId ? 'background: rgba(0,0,0,0.05);' : ''}">
          <h3 style="margin: 0 0 4px; font-size: 14px;">${escapeHtml(project.displayName ?? project.projectId ?? 'Project')}</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(project.projectPath ?? 'No path')}</p>
        </div>
      `).join('');

      const listNewHtml = `
        <div class="split-view__item ${selectedId === 'new' ? 'is-active' : ''}" data-id="new" style="${selectedId === 'new' ? 'background: rgba(0,0,0,0.05); border-bottom: 2px solid var(--border-color, #e0e0e0);' : 'border-bottom: 2px solid var(--border-color, #e0e0e0);'}">
          <h3 style="margin: 0 0 2px; font-size: 14px; color: #0a84ff;">+ Register Project</h3>
        </div>
      `;

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <h2>Local Projects</h2>
            </div>
            ${listNewHtml}
            ${listHtml}
          </div>
          <div class="split-view__detail" id="projects-detail-container">
            <!-- JS inserted -->
          </div>
        </div>
      `;

      const detailContainer = host.querySelector('#projects-detail-container');
      const itemsElements = host.querySelectorAll('.split-view__item');

      const renderRegisterForm = () => `
        <div style="max-width: 600px;">
          <h2 style="margin: 0 0 16px; font-size: 20px;">Register new project</h2>
          <form class="stack-form" data-project-form="true">
            <label>Display name<input name="displayName" type="text" placeholder="Desktop Workspace" required /></label>
            <label>Project path<input name="projectPath" type="text" placeholder="/Users/you/workspace/project" required /></label>
            <div class="form-actions full-span"><button type="submit">Register project</button></div>
          </form>
        </div>
      `;

      const updateDetail = () => {
        if (selectedId === 'new') {
          detailContainer.innerHTML = renderRegisterForm();
        } else {
          const item = projects.find(i => i.projectId === selectedId);
          if (!item) return;
          detailContainer.innerHTML = renderProject(item, state.local.projects.currentProjectId);
        }
      };

      itemsElements.forEach(el => {
        el.addEventListener('click', () => {
           itemsElements.forEach(i => { i.classList.remove('is-active'); i.style.background = ''; i.style.borderBottom = i.dataset.id === 'new' ? '2px solid var(--border-color, #e0e0e0)' : '1px solid var(--border-color, #e0e0e0)'; });
           el.classList.add('is-active');
           el.style.background = 'rgba(0,0,0,0.05)';
           selectedId = el.dataset.id;
           updateDetail();
        });
      });

      updateDetail();
    },
  });
}
