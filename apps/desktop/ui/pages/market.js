import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

function renderMarketCard(item, authenticated) {
  const action = item.canInstall
    ? authenticated
      ? `<button type="button" data-market-install="${escapeHtml(item.skillId ?? '')}">安装 / 启用</button>`
      : `<button type="button" data-protected-action="market-install" data-route-after-login="market" data-action-label="安装 / 启用 Skill">安装 / 启用</button>`
    : '<span class="state-pill">仅摘要</span>';

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Market</p>
          <h2>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h2>
        </div>
        ${action}
      </div>
      <p class="page-copy">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
      <div class="meta-row">
        <span>${escapeHtml(item.skillId ?? '')}</span>
        <span>${escapeHtml(item.version ?? item.updatedAt ?? 'latest')}</span>
      </div>
    </article>
  `;
}

export function createMarketPage(app) {
  return createPageModule({
    id: 'market',
    async render({ host }) {
      const state = app.store.getState();
      const results = state.remote.market.results;
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Browse and use',
          title: 'Market',
          body: state.searchQuery ? `当前搜索：${state.searchQuery}` : '浏览市场、推荐和最近更新的 Skill。',
        })}
        ${state.remote.market.status === 'error' ? renderNotice({ title: '市场加载失败', body: state.remote.market.message, tone: 'danger' }) : ''}
        ${results.length ? results.map((item) => renderMarketCard(item, Boolean(state.session?.user))).join('') : renderNotice({ title: '暂无市场结果', body: state.remote.market.message, tone: 'neutral' })}
      `;
    },
  });
}

