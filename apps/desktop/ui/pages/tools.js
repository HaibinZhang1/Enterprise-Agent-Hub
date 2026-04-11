import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml, formatIssues } from '../core/utils.js';

function summarizeBinding(binding) {
  const materialization = binding.materializationStatus;
  if (!binding.enabled) {
    return '已禁用，需要重新启用此工具的 Skill 绑定。';
  }
  if (!materialization) {
    return '已启用，等待下次物化对账。';
  }
  return `物化 ${materialization.status ?? '未知'} · 模式 ${materialization.mode ?? '无'}`;
}

function renderBinding(binding, tool) {
  const toggleEnabled = binding.enabled ? 'false' : 'true';
  const toggleLabel = binding.enabled ? '禁用' : '启用';
  const materialization = binding.materializationStatus;
  const materializationLabel = materialization ? `${materialization.status ?? '未知'} · ${materialization.mode ?? '无'}` : '尚未物化';

  return `
    <article class="content-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">绑定的 Skill</p>
          <h3>${escapeHtml(binding.skillId ?? 'Skill')}</h3>
        </div>
        <span class="state-pill">${binding.enabled ? '已启用' : '已禁用'}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(binding.packageId ?? '无包')}</span>
        <span>${escapeHtml(binding.version ?? '无版本')}</span>
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
  const stateLabel = tool.healthLabel ?? tool.healthState ?? '未知';
  const headerActions = `
    <div class="button-row">
      <span class="state-pill">${escapeHtml(stateLabel)}</span>
      ${canRepair ? `<button type="button" data-tools-repair="${escapeHtml(tool.toolId ?? '')}">修复</button>` : ''}
    </div>
  `;
  const bindingsMarkup = tool.skillBindings?.length
    ? tool.skillBindings.map((binding) => renderBinding(binding, tool)).join('')
    : renderNotice({
        title: '暂无绑定 Skill',
        body: '逐个启用 Skill，工具变更仍需预览确认。',
        tone: 'neutral',
      });

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">工具管理</p>
          <h2>${escapeHtml(tool.displayName ?? tool.toolId ?? '工具')}</h2>
        </div>
        ${headerActions}
      </div>
      <div class="meta-row">
        <span>${escapeHtml(tool.toolId ?? '')}</span>
        <span>${escapeHtml(tool.healthLabel ?? tool.healthState ?? '未知')}</span>
        <span>${escapeHtml(tool.skillsDirectorySummary ?? tool.skillsDirectory ?? '无 Skills 目录')}</span>
      </div>
      <p class="page-copy">${escapeHtml(tool.skillsDirectorySummary ?? 'Skills 目录摘要待配置。')}</p>
      <p class="page-copy">${escapeHtml(formatIssues(tool.issues))}</p>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">Skill 管理</p>
            <h3>工具详情 / 已启用 Skill</h3>
          </div>
          <span class="state-pill">单工具 · 单 Skill</span>
        </div>
        <p class="page-copy">Skills 目录、健康/问题、启用状态、版本和物化摘要。</p>
        ${bindingsMarkup}
        <form class="stack-form" data-tool-skill-form="bind" data-tool-skill-bind-form="true">
          <input type="hidden" name="toolId" value="${escapeHtml(tool.toolId ?? '')}" />
          <label>Skill ID<input name="skillId" type="text" placeholder="skill-market-1" required /></label>
          <label>包 ID<input name="packageId" type="text" placeholder="pkg-market-1" required /></label>
          <label>版本<input name="version" type="text" placeholder="1.0.0" required /></label>
          <label>Skills 目录<input name="skillsDirectory" type="text" value="${escapeHtml(tool.skillsDirectory ?? '')}" /></label>
          <label>
            启用状态
            <select name="enabled">
              <option value="true">启用</option>
              <option value="false">禁用</option>
            </select>
          </label>
          <div class="form-actions full-span"><button type="submit">预览绑定 / 更新</button></div>
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
        host.innerHTML = `<div class="page-padded">${renderNotice({ title: '暂无工具数据', body: state.local.tools.message, tone: 'neutral' })}</div>`;
        return;
      }

      if (!selectedId || !tools.find(i => i.toolId === selectedId)) {
        selectedId = tools[0].toolId;
      }

      const listHtml = tools.map((tool) => `
        <div class="split-view__item${tool.toolId === selectedId ? ' is-active' : ''}" data-id="${escapeHtml(tool.toolId)}">
          <h3 class="split-view__item-title">${escapeHtml(tool.displayName ?? tool.toolId ?? '工具')}</h3>
          <p class="split-view__item-subtitle">${escapeHtml(tool.healthLabel ?? tool.healthState ?? '未知')}</p>
        </div>
      `).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <div class="split-view__list-toolbar">
                <h2>本地工具</h2>
                <button type="button" class="state-pill compact" data-tools-scan="true">重新扫描</button>
              </div>
            </div>
            ${listHtml}
          </div>
          <div class="split-view__detail" id="tools-detail-container"></div>
        </div>
      `;

      bindSplitView(host, {
        selectedId,
        detailSelector: '#tools-detail-container',
        onSelect: (id) => { selectedId = id; },
        renderDetail: (id) => {
          const item = tools.find(i => i.toolId === id);
          return item ? renderTool(item) : '';
        },
      });
    },
  });
}
