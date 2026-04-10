import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

function renderNotification(item) {
  const action = item.readAt
    ? '<span class="state-pill">已读</span>'
    : `<button type="button" data-mark-notification-read="${escapeHtml(item.notificationId ?? item.id ?? '')}">标记已读</button>`;

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Notification</p>
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

export function createNotificationsPage(app) {
  return createPageModule({
    id: 'notifications',
    async render({ host }) {
      const state = app.store.getState();
      const feed = state.eventFeed.slice(0, 6);
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Realtime status',
          title: 'Notifications',
          body: '通知页聚合消息、已读动作与实时事件回放。',
          actions: '<button type="button" data-read-all-notifications="true">全部已读</button>',
        })}
        ${state.remote.notifications.items.length ? state.remote.notifications.items.map((item) => renderNotification(item)).join('') : renderNotice({ title: '暂无通知', body: state.remote.notifications.message, tone: 'neutral' })}
        <section class="content-panel glass-panel page-section">
          <div class="content-header">
            <div>
              <p class="page-eyebrow">SSE connection</p>
              <h2>Live Events</h2>
            </div>
            <span class="state-pill">${escapeHtml(state.realtime.status)}</span>
          </div>
          <p class="page-copy">${escapeHtml(state.realtime.message)}</p>
          ${feed.length ? `<div class="bullet-list">${feed.map((event) => `<article class="bullet-list__item"><strong>${escapeHtml(event.type)}</strong><span>${escapeHtml(formatTimestamp(event.at))}</span></article>`).join('')}</div>` : '<p class="page-copy">实时事件会在登录后显示。</p>'}
        </section>
      `;
    },
  });
}

