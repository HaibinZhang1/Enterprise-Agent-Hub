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
  let selectedId = 'live';

  return createPageModule({
    id: 'notifications',
    async render({ host }) {
      const state = app.store.getState();
      const feed = state.eventFeed.slice(0, 6);
      const notifications = state.remote.notifications.items;

      if (!selectedId || (selectedId !== 'live' && !notifications.find(i => (i.notificationId ?? i.id) === selectedId))) {
        selectedId = 'live';
      }

      const listLiveHtml = `
        <div class="split-view__item ${selectedId === 'live' ? 'is-active' : ''}" data-id="live" style="${selectedId === 'live' ? 'background: rgba(0,0,0,0.05); border-bottom: 2px solid var(--border-color, #e0e0e0);' : 'border-bottom: 2px solid var(--border-color, #e0e0e0);'}">
          <h3 style="margin: 0 0 2px; font-size: 14px; color: #0a84ff;">🟢 Live Events</h3>
        </div>
      `;

      const listHtml = notifications.map((item) => {
        const id = escapeHtml(item.notificationId ?? item.id ?? '');
        return `
        <div class="split-view__item ${id === selectedId ? 'is-active' : ''}" data-id="${id}" style="${id === selectedId ? 'background: rgba(0,0,0,0.05);' : ''}">
          <h3 style="margin: 0 0 4px; font-size: 14px; ${!item.readAt ? 'font-weight: 700;' : 'font-weight: normal;'}">${escapeHtml(item.title ?? item.category ?? '通知')}</h3>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.body ?? item.message ?? '')}</p>
        </div>
        `;
      }).join('');

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0;">Inbox</h2>
                <button type="button" class="state-pill compact" data-read-all-notifications="true" style="cursor: pointer; border: none;">Read all</button>
              </div>
            </div>
            ${listLiveHtml}
            ${listHtml}
          </div>
          <div class="split-view__detail" id="notifications-detail-container">
            <!-- JS inserted -->
          </div>
        </div>
      `;

      const detailContainer = host.querySelector('#notifications-detail-container');
      const itemsElements = host.querySelectorAll('.split-view__item');

      const renderLiveEvents = () => `
        <div style="max-width: 600px;">
          <h2 style="margin: 0 0 8px; font-size: 20px;">Live Events</h2>
          <span class="state-pill" style="margin-bottom: 16px; display: inline-block;">${escapeHtml(state.realtime.status)}</span>
          <p class="page-copy" style="margin-bottom: 16px;">${escapeHtml(state.realtime.message)}</p>
          ${feed.length ? `<div class="bullet-list">${feed.map((event) => `<article class="bullet-list__item" style="padding: 12px; border-bottom: 1px solid var(--border-color, #e0e0e0);"><strong>${escapeHtml(event.type)}</strong><span style="display:block; font-size:12px; color:var(--text-secondary);">${escapeHtml(formatTimestamp(event.at))}</span></article>`).join('')}</div>` : '<p class="page-copy">实时事件会在登录后显示。</p>'}
        </div>
      `;

      const updateDetail = () => {
        if (selectedId === 'live') {
          detailContainer.innerHTML = renderLiveEvents();
        } else {
          const item = notifications.find(i => (i.notificationId ?? i.id) === selectedId);
          if (!item) return;
          detailContainer.innerHTML = renderNotification(item);
        }
      };

      itemsElements.forEach(el => {
        el.addEventListener('click', () => {
           itemsElements.forEach(i => { i.classList.remove('is-active'); i.style.background = ''; i.style.borderBottom = i.dataset.id === 'live' ? '2px solid var(--border-color, #e0e0e0)' : '1px solid var(--border-color, #e0e0e0)'; });
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

