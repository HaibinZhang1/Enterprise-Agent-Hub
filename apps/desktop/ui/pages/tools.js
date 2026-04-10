import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatIssues } from '../core/utils.js';

function renderTool(tool) {
  const action = tool.healthState === 'missing'
    ? `<button type="button" data-tools-repair="${escapeHtml(tool.toolId ?? '')}">Repair</button>`
    : '<span class="state-pill">Healthy</span>';

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Local authority</p>
          <h2>${escapeHtml(tool.displayName ?? tool.toolId ?? 'Tool')}</h2>
        </div>
        ${action}
      </div>
      <p class="page-copy">${escapeHtml(formatIssues(tool.issues))}</p>
      <div class="meta-row">
        <span>${escapeHtml(tool.toolId ?? '')}</span>
        <span>${escapeHtml(tool.healthState ?? 'unknown')}</span>
      </div>
    </article>
  `;
}

export function createToolsPage(app) {
  return createPageModule({
    id: 'tools',
    async render({ host }) {
      const state = app.store.getState();
      host.innerHTML = `
        ${renderSectionHeader({ eyebrow: 'Local authority', title: 'Tools', body: '桌面工具扫描、修复预览与本地健康状态在此页面维护。', actions: '<button type="button" data-tools-scan="true">Rescan</button>' })}
        ${state.local.tools.items.length ? state.local.tools.items.map((tool) => renderTool(tool)).join('') : renderNotice({ title: '暂无工具数据', body: state.local.tools.message, tone: 'neutral' })}
      `;
    },
  });
}

