import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatIssues } from '../core/utils.js';

function summarizeBinding(binding) {
  const materialization = binding.materializationStatus;
  if (!binding.enabled) {
    return 'Disabled until you re-enable this skill for this tool.';
  }
  if (!materialization) {
    return 'Enabled locally and waiting for the next materialization reconciliation.';
  }
  return `Materialization ${materialization.status ?? 'unknown'} · mode ${materialization.mode ?? 'none'}`;
}

function renderBinding(binding, tool) {
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
      <form class="stack-form" data-tool-skill-form="toggle" data-tool-skill-toggle="true">
        <input type="hidden" name="toolId" value="${escapeHtml(tool.toolId ?? '')}" />
        <input type="hidden" name="skillId" value="${escapeHtml(binding.skillId ?? '')}" />
        <input type="hidden" name="packageId" value="${escapeHtml(binding.packageId ?? '')}" />
        <input type="hidden" name="version" value="${escapeHtml(binding.version ?? '')}" />
        <input type="hidden" name="skillsDirectory" value="${escapeHtml(tool.skillsDirectory ?? '')}" />
        <input type="hidden" name="enabled" value="${escapeHtml(toggleEnabled)}" />
        <div class="form-actions full-span">
          <button type="submit">${toggleLabel}</button>
        </div>
      </form>
    </article>
  `;
}

function renderTool(tool) {
  const canRepair = Boolean(tool.actions?.canRepair ?? tool.healthState !== 'ready');
  const stateLabel = tool.healthLabel ?? tool.healthState ?? 'unknown';
  const headerActions = `
    <div class="button-row">
      <span class="state-pill">${escapeHtml(stateLabel)}</span>
      ${canRepair ? `<button type="button" data-tools-repair="${escapeHtml(tool.toolId ?? '')}">Repair</button>` : ''}
    </div>
  `;
  const bindingsMarkup = tool.skillBindings?.length
    ? tool.skillBindings.map((binding) => renderBinding(binding, tool)).join('')
    : renderNotice({
        title: 'No bound skills yet',
        body: 'Enable one Skill at a time. Tool mutations remain preview-confirm gated.',
        tone: 'neutral',
      });

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Local authority</p>
          <h2>${escapeHtml(tool.displayName ?? tool.toolId ?? 'Tool')}</h2>
        </div>
        ${headerActions}
      </div>
      <div class="meta-row">
        <span>${escapeHtml(tool.toolId ?? '')}</span>
        <span>${escapeHtml(tool.healthLabel ?? tool.healthState ?? 'unknown')}</span>
        <span>${escapeHtml(tool.skillsDirectorySummary ?? tool.skillsDirectory ?? 'No skills directory')}</span>
      </div>
      <p class="page-copy">${escapeHtml(tool.skillsDirectorySummary ?? 'Skills directory summary pending configuration.')}</p>
      <p class="page-copy">${escapeHtml(formatIssues(tool.issues))}</p>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">Skill management</p>
            <h3>Tool detail / Enabled Skills panel</h3>
          </div>
          <span class="state-pill">Single tool · single Skill</span>
        </div>
        <p class="page-copy">Skills directory, health/issues, enabled state, version, and materialization summary stay visible for each tool.</p>
        ${bindingsMarkup}
        <form class="stack-form" data-tool-skill-form="bind" data-tool-skill-bind-form="true">
          <input type="hidden" name="toolId" value="${escapeHtml(tool.toolId ?? '')}" />
          <label>Skill ID<input name="skillId" type="text" placeholder="skill-market-1" required /></label>
          <label>Package ID<input name="packageId" type="text" placeholder="pkg-market-1" required /></label>
          <label>Version<input name="version" type="text" placeholder="1.0.0" required /></label>
          <label>Skills directory<input name="skillsDirectory" type="text" value="${escapeHtml(tool.skillsDirectory ?? '')}" /></label>
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

export function createToolsPage(app) {
  let selectedId = null;

  return createPageModule({
    id: 'tools',
    async render({ host }) {
      const state = app.store.getState();
      const tools = state.local.tools.items;

      if (!tools.length) {
        host.innerHTML = `<div class="page-screen" style="padding: 24px;">${renderNotice({ title: '暂无工具数据', body: state.local.tools.message, tone: 'neutral' })}</div>`;
        return;
      }

      if (!selectedId || !tools.find(i => i.toolId === selectedId)) {
        selectedId = tools[0].toolId;
      }

      const listHtml = tools.map((tool) => `
        <div class="split-view__item ${tool.toolId === selectedId ? 'is-active' : ''}" data-id="${escapeHtml(tool.toolId)}" style="${tool.toolId === selectedId ? 'background: rgba(0,0,0,0.05);' : ''}">
          <h3 style="margin: 0 0 4px; font-size: 14px;">${escapeHtml(tool.displayName ?? tool.toolId ?? 'Tool')}</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">${escapeHtml(tool.healthLabel ?? tool.healthState ?? 'unknown')}</p>
        </div>
      `).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0;">Local Tools</h2>
                <button type="button" class="state-pill compact" data-tools-scan="true" style="cursor: pointer; border: none;">Rescan</button>
              </div>
            </div>
            ${listHtml}
          </div>
          <div class="split-view__detail" id="tools-detail-container">
            <!-- JS inserted -->
          </div>
        </div>
      `;

      const detailContainer = host.querySelector('#tools-detail-container');
      const itemsElements = host.querySelectorAll('.split-view__item');

      const updateDetail = () => {
        const item = tools.find(i => i.toolId === selectedId);
        if (!item) return;
        detailContainer.innerHTML = renderTool(item);
      };

      itemsElements.forEach(el => {
        el.addEventListener('click', () => {
           itemsElements.forEach(i => { i.classList.remove('is-active'); i.style.background = ''; });
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
