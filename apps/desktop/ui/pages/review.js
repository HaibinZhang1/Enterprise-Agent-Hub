import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

function renderTicketDetail(ticket, reviewState, session) {
  if (!ticket) {
    return renderNotice({ title: '未选择审核单', body: reviewState.message ?? '请在左侧队列中选择一个审核单。', tone: 'neutral' });
  }

  const history = reviewState.history ?? [];
  const skill = ticket.skill ?? ticket.skillSummary ?? null;
  const canResolve = ticket.status === 'in_progress' && ticket.claimedBy && ticket.claimedBy === session?.user?.userId;
  const actionButtons =
    canResolve
      ? `
          <div class="button-row">
            <button type="button" data-review-action="approve" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">批准</button>
            <button type="button" data-review-action="reject" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">拒绝</button>
            <button type="button" data-review-action="return" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">退回</button>
          </div>
        `
      : ticket.status === 'todo'
        ? `<div class="button-row"><button type="button" data-review-action="claim" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">领取</button></div>`
        : '';

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">审核详情</p>
          <h2>${escapeHtml(ticket.ticketId ?? 'ticket')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(ticket.status ?? '未知')}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(ticket.skillId ?? '')}</span>
        <span>${escapeHtml(ticket.packageId ?? '')}</span>
        <span>${escapeHtml(formatTimestamp(ticket.createdAt))}</span>
      </div>
      <p class="page-copy">${escapeHtml(skill?.summary ?? '审核详情绑定到 API 返回的 ticket 和 skill 状态。')}</p>
      ${actionButtons}
      <section class="page-section">
        <h3>时间线</h3>
        ${history.length
          ? `<div class="bullet-list">${history
              .map(
                (entry) => `
                  <article class="bullet-list__item">
                    <strong>${escapeHtml(entry.action ?? '事件')}</strong>
                    <span>${escapeHtml(`${entry.fromStatus ?? '无'} → ${entry.toStatus ?? '未知'}`)}</span>
                    <span>${escapeHtml(formatTimestamp(entry.createdAt))}</span>
                  </article>
                `,
              )
              .join('')}</div>`
          : '<p class="page-copy">暂无审核历史。</p>'}
      </section>
    </article>
  `;
}

function buildQueueList(queue) {
  const items = [];

  const todoTickets = queue?.todo ?? [];
  const inProgressTickets = queue?.inProgress ?? [];
  const doneTickets = queue?.done ?? [];

  if (todoTickets.length) {
    items.push({ id: '__section_todo', label: '待领取', isSection: true });
    todoTickets.forEach(t => items.push({ id: t.ticketId, ticket: t, status: 'todo' }));
  }
  if (inProgressTickets.length) {
    items.push({ id: '__section_progress', label: '处理中', isSection: true });
    inProgressTickets.forEach(t => items.push({ id: t.ticketId, ticket: t, status: 'in_progress' }));
  }
  if (doneTickets.length) {
    items.push({ id: '__section_done', label: '已完成', isSection: true });
    doneTickets.forEach(t => items.push({ id: t.ticketId, ticket: t, status: 'done' }));
  }

  return items;
}

export function createReviewPage(app) {
  let selectedId = null;

  return createPageModule({
    id: 'review',
    async render({ host }) {
      const state = app.store.getState();
      const session = state.session;
      const reviewState = state.remote.review ?? { queue: { todo: [], inProgress: [], done: [] }, history: [] };
      const queue = reviewState.queue ?? { todo: [], inProgress: [], done: [] };
      const queueItems = buildQueueList(queue);
      const allTickets = [...(queue.todo ?? []), ...(queue.inProgress ?? []), ...(queue.done ?? [])];

      if (!selectedId && allTickets.length) {
        selectedId = allTickets[0].ticketId;
      }

      const listHtml = queueItems.map(item => {
        if (item.isSection) {
          return `<div class="split-view__item split-view__action-item" style="pointer-events:none;"><h3 class="split-view__item-title">${escapeHtml(item.label)}</h3></div>`;
        }
        const ticket = item.ticket;
        return `
          <div class="split-view__item${item.id === selectedId ? ' is-active' : ''}" data-id="${escapeHtml(item.id)}">
            <h3 class="split-view__item-title">${escapeHtml(ticket.ticketId ?? '审核单')}</h3>
            <p class="split-view__item-subtitle">${escapeHtml(ticket.skillId ?? '未知 Skill')} · ${escapeHtml(item.status)}</p>
          </div>
        `;
      }).join('');

      host.innerHTML = `
        <div class="page-header">
          <div>
            <p class="page-eyebrow">审核队列</p>
            <h1 class="page-header__title">审核中心</h1>
          </div>
          <span class="state-pill">${escapeHtml(String(allTickets.length))} 条</span>
        </div>
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <h2>审核队列</h2>
            </div>
            ${listHtml || '<div class="split-view__item"><p class="split-view__item-subtitle">当前队列为空</p></div>'}
          </div>
          <div class="split-view__detail" id="review-detail-container"></div>
        </div>
      `;

      if (allTickets.length) {
        bindSplitView(host, {
          selectedId,
          detailSelector: '#review-detail-container',
          onSelect: (id) => { selectedId = id; },
          renderDetail: (id) => {
            const ticket = allTickets.find(t => t.ticketId === id);
            return renderTicketDetail(ticket, reviewState, session);
          },
        });
      } else {
        const detailContainer = host.querySelector('#review-detail-container');
        if (detailContainer) {
          detailContainer.innerHTML = renderNotice({
            title: '暂无审核任务',
            body: reviewState.message ?? '审核操作需要 review_admin 或 system_admin 角色。',
            tone: 'neutral',
          });
        }
      }
    },
  });
}
