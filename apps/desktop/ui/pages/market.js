import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml } from '../core/utils.js';

function renderTargetForm({ skillId, targetType, label, targets, buttonLabel }) {
  if (!targets.length) {
    return `
      <div class="state-card state-card--neutral">
        <h3>${escapeHtml(label)}</h3>
        <p>请先在本地注册一个${escapeHtml(targetType === 'project' ? '项目' : '工具')}目标。</p>
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
        label: '安装到项目',
        targets: projectTargets,
        buttonLabel: '预览安装到项目',
      })}
      ${renderTargetForm({
        skillId: item.skillId,
        targetType: 'tool',
        label: '安装到工具',
        targets: toolTargets,
        buttonLabel: '预览安装到工具',
      })}
    </div>
  `;
}

function renderMarketCard(item, state) {
  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">市场</p>
          <h2>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h2>
        </div>
        <span class="state-pill">${item.canInstall ? '可安装' : '仅摘要'}</span>
      </div>
      <p class="page-copy">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
      <div class="meta-row">
        <span>${escapeHtml(item.skillId ?? '')}</span>
        <span>${escapeHtml(item.publishedVersion ?? item.version ?? item.updatedAt ?? 'latest')}</span>
      </div>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">安装 / 启用</p>
            <h3>选择安装目标</h3>
          </div>
          <span class="state-pill">单目标选择</span>
        </div>
        <p class="page-copy">选择安装目标类型，然后通过本地预览-确认流程完成安装。</p>
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
        host.innerHTML = `<div class="page-padded">${renderNotice({ title: '暂无市场结果', body: state.remote.market.message || '未找到市场数据。', tone: 'neutral' })}` +
                         (state.remote.market.status === 'error' ? renderNotice({ title: '市场加载失败', body: state.remote.market.message, tone: 'danger' }) : '') + `</div>`;
        return;
      }

      if (!selectedId || !results.find(i => i.skillId === selectedId)) {
        selectedId = results[0].skillId;
      }

      const listHtml = results.map(item => `
        <div class="split-view__item${item.skillId === selectedId ? ' is-active' : ''}" data-id="${escapeHtml(item.skillId)}">
          <h3 class="split-view__item-title">${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h3>
          <p class="split-view__item-subtitle">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
        </div>
      `).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <div class="split-view__list-toolbar">
                <h2>市场</h2>
                ${state.searchQuery ? `<span class="state-pill compact">${escapeHtml(state.searchQuery)}</span>` : ''}
              </div>
            </div>
            ${listHtml}
          </div>
          <div class="split-view__detail" id="market-detail-container"></div>
        </div>
      `;

      bindSplitView(host, {
        selectedId,
        detailSelector: '#market-detail-container',
        onSelect: (id) => { selectedId = id; },
        renderDetail: (id) => {
          const item = results.find(i => i.skillId === id);
          return item ? renderMarketCard(item, state) : '';
        },
      });
    },
  });
}
