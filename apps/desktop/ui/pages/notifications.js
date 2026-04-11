import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

function renderNotification(item) {
  const action = item.readAt
    ? '<span class="state-pill">已读</span>'
    : `<button type="button" data-mark-notification-read="${escapeHtml(item.notificationId ?? item.id ?? '')}">标记已读</button>`;

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">通知详情</p>
          <h2>${escapeHtml(item.title ?? item.category ?? '通知')}</h2>
        </div>
        ${action}
      </div>
      <p class="page-copy">${escapeHtml(item.body ?? item.message ?? '暂无正文')}</p>
      <div class="meta-row">
        <span>${escapeHtml(item.category ?? 'general')}</span>
        <span>${escapeHtml(formatTimestamp(item.createdAt))}</span>
      </div>
    </article>
  `;
}

function renderLiveEvents(state) {
  const feed = state.eventFeed.slice(0, 6);
  return `
    <div class="detail-section">
      <h2 class="detail-header">实时事件</h2>
      <span class="state-pill">${escapeHtml(state.realtime.status)}</span>
      <p class="page-copy">${escapeHtml(state.realtime.message)}</p>
      ${feed.length
        ? `<div class="bullet-list">${feed.map((event) => `<article class="bullet-list__item"><strong>${escapeHtml(event.type)}</strong><span>${escapeHtml(formatTimestamp(event.at))}</span></article>`).join('')}</div>`
        : '<p class="page-copy">实时事件会在登录后显示。</p>'}
    </div>
  `;
}

export function createNotificationsPage(app) {
  let selectedId = 'live';

  return createPageModule({
    id: 'notifications',
    async render({ host }) {
      const state = app.store.getState();
      const notifications = state.remote.notifications.items;

      if (!selectedId || (selectedId !== 'live' && !notifications.find(i => (i.notificationId ?? i.id) === selectedId))) {
        selectedId = 'live';
      }

      const listLiveHtml = `
        <div class="split-view__item split-view__action-item${selectedId === 'live' ? ' is-active' : ''}" data-id="live">
          <h3 class="split-view__item-title">🟢 实时事件</h3>
        </div>
      `;

      const listHtml = notifications.map((item) => {
        const id = escapeHtml(item.notificationId ?? item.id ?? '');
        return `
        <div class="split-view__item${id === selectedId ? ' is-active' : ''}${!item.readAt ? ' split-view__item--unread' : ''}" data-id="${id}">
          <h3 class="split-view__item-title">${escapeHtml(item.title ?? item.category ?? '通知')}</h3>
          <p class="split-view__item-subtitle">${escapeHtml(item.body ?? item.message ?? '')}</p>
        </div>
        `;
      }).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <div class="split-view__list-toolbar">
                <h2>收件箱</h2>
                <button type="button" class="state-pill compact" data-read-all-notifications="true">全部已读</button>
              </div>
            </div>
            ${listLiveHtml}
            ${listHtml}
          </div>
          <div class="split-view__detail" id="notifications-detail-container"></div>
        </div>
      `;

      bindSplitView(host, {
        selectedId,
        detailSelector: '#notifications-detail-container',
        onSelect: (id) => { selectedId = id; },
        renderDetail: (id) => {
          if (id === 'live') {
            return renderLiveEvents(state);
          }
          const item = notifications.find(i => (i.notificationId ?? i.id) === id);
          return item ? renderNotification(item) : '';
        },
      });
    },
  });
}
