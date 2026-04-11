import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

function renderTargetForm({ skillId, targetType, label, targets, buttonLabel }) {
  if (!targets.length) {
    return `
      <div class="state-card state-card--neutral">
        <h3>${escapeHtml(label)}</h3>
        <p>${escapeHtml(`Register one ${targetType} target locally before previewing this install.`)}</p>
      </div>
    `;
  }

  return `
    <form class="stack-form" data-market-install-form="${escapeHtml(targetType)}">
      <input type="hidden" name="skillId" value="${escapeHtml(skillId ?? '')}" />
      <input type="hidden" name="targetType" value="${escapeHtml(targetType)}" data-market-target-type="${escapeHtml(targetType)}" />
      <label>
        ${escapeHtml(label)}
        <select name="targetId" data-market-target-id="${escapeHtml(targetType)}">
          ${targets.map((target) => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.label)}</option>`).join('')}
        </select>
      </label>
      <div class="form-actions full-span"><button type="submit">${escapeHtml(buttonLabel)}</button></div>
    </form>
  `;
}

function renderInstallControls(item, state) {
  if (!item.canInstall) {
    return '<span class="state-pill">仅摘要</span>';
  }

  if (!state.session?.user) {
    return '<button type="button" data-protected-action="market-install" data-route-after-login="market" data-action-label="安装 / 启用 Skill">安装 / 启用</button>';
  }

  const projectTargets = state.local.projects.items.map((project) => ({
    id: project.projectId,
    label: `${project.displayName ?? project.projectId} · ${project.skillsDirectory ?? project.projectPath ?? ''}`,
  }));
  const toolTargets = state.local.tools.items.map((tool) => ({
    id: tool.toolId,
    label: `${tool.displayName ?? tool.toolId} · ${tool.skillsDirectory ?? tool.installPath ?? ''}`,
  }));

  return `
    <div class="stack-form">
      ${renderTargetForm({
        skillId: item.skillId,
        targetType: 'project',
        label: 'Install to project target',
        targets: projectTargets,
        buttonLabel: 'Preview install to project',
      })}
      ${renderTargetForm({
        skillId: item.skillId,
        targetType: 'tool',
        label: 'Install to tool target',
        targets: toolTargets,
        buttonLabel: 'Preview install to tool',
      })}
    </div>
  `;
}

function renderMarketCard(item, state) {
  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Market</p>
          <h2>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h2>
        </div>
        <span class="state-pill">${item.canInstall ? 'Installable' : 'Summary only'}</span>
      </div>
      <p class="page-copy">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
      <div class="meta-row">
        <span>${escapeHtml(item.skillId ?? '')}</span>
        <span>${escapeHtml(item.publishedVersion ?? item.version ?? item.updatedAt ?? 'latest')}</span>
      </div>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">Install / enable</p>
            <h3>Single target selection</h3>
          </div>
          <span class="state-pill">One target type · one target</span>
        </div>
        <p class="page-copy">Target type stays explicit: resolve an API install candidate first, then route one project or one tool target into the local preview-confirm flow.</p>
        ${renderInstallControls(item, state)}
      </section>
    </article>
  `;
}

export function createMarketPage(app) {
  let selectedId = null;

  return createPageModule({
    id: 'market',
    async render({ host }) {
      const state = app.store.getState();
      const results = state.remote.market.results;

      if (!results.length) {
        host.innerHTML = `<div class="page-screen" style="padding: 24px;">${renderNotice({ title: '暂无市场结果', body: state.remote.market.message || 'No market items found.', tone: 'neutral' })}` + 
                         (state.remote.market.status === 'error' ? renderNotice({ title: '市场加载失败', body: state.remote.market.message, tone: 'danger' }) : '') + `</div>`;
        return;
      }

      if (!selectedId || !results.find(i => i.skillId === selectedId)) {
        selectedId = results[0].skillId;
      }

      const listHtml = results.map(item => `
        <div class="split-view__item ${item.skillId === selectedId ? 'is-active' : ''}" data-id="${escapeHtml(item.skillId)}" style="${item.skillId === selectedId ? 'background: rgba(0,0,0,0.05);' : ''}">
          <h3 style="margin: 0 0 4px; font-size: 14px;">${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
        </div>
      `).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <h2>Market</h2>
              ${state.searchQuery ? `<p style="margin:0;font-size:12px;">Search: ${escapeHtml(state.searchQuery)}</p>` : ''}
            </div>
            ${listHtml}
          </div>
          <div class="split-view__detail" id="market-detail-container">
            <!-- Rendered via JS -->
          </div>
        </div>
      `;

      const detailContainer = host.querySelector('#market-detail-container');
      const itemsElements = host.querySelectorAll('.split-view__item');

      const updateDetail = () => {
        const item = results.find(i => i.skillId === selectedId);
        if (!item) return;

        detailContainer.innerHTML = renderMarketCard(item, state);
      };

      itemsElements.forEach(el => {
        el.addEventListener('click', () => {
          itemsElements.forEach(i => {
            i.classList.remove('is-active');
            i.style.background = '';
          });
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
