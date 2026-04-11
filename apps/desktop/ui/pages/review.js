import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

function renderQueueColumn(title, items, primaryAction, primaryLabel) {
  return `
    <section class="content-panel glass-panel page-section">
      <h2>${escapeHtml(title)}</h2>
      ${
        items.length
          ? `<div class="bullet-list">${items
              .map(
                (ticket) => `
                  <article class="bullet-list__item">
                    <strong>${escapeHtml(ticket.ticketId ?? 'ticket')}</strong>
                    <span>${escapeHtml(ticket.skillId ?? '待处理审核')}</span>
                    <button type="button" data-review-select="${escapeHtml(ticket.ticketId ?? '')}">View</button>
                    ${primaryAction ? `<button type="button" data-review-action="${escapeHtml(primaryAction)}" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">${escapeHtml(primaryLabel)}</button>` : ''}
                  </article>
                `,
              )
              .join('')}</div>`
          : '<p class="page-copy">当前列为空。</p>'
      }
    </section>
  `;
}

function renderTicketDetail(reviewState, session) {
  const ticket = reviewState.ticket;
  if (!ticket) {
    return renderNotice({ title: '未选择审核单', body: reviewState.message ?? '请选择一个审核单查看详情。', tone: 'neutral' });
  }

  const history = reviewState.history ?? [];
  const skill = ticket.skill ?? ticket.skillSummary ?? null;
  const canResolve = ticket.status === 'in_progress' && ticket.claimedBy && ticket.claimedBy === session?.user?.userId;
  const actionButtons =
    canResolve
      ? `
          <div class="button-row">
            <button type="button" data-review-action="approve" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">Approve</button>
            <button type="button" data-review-action="reject" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">Reject</button>
            <button type="button" data-review-action="return" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">Return</button>
          </div>
        `
      : ticket.status === 'todo'
        ? `<div class="button-row"><button type="button" data-review-action="claim" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">Claim</button></div>`
        : '';

  return `
    <section class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Review detail</p>
          <h2>${escapeHtml(ticket.ticketId ?? 'ticket')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(ticket.status ?? 'unknown')}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(ticket.skillId ?? '')}</span>
        <span>${escapeHtml(ticket.packageId ?? '')}</span>
        <span>${escapeHtml(formatTimestamp(ticket.createdAt))}</span>
      </div>
      <p class="page-copy">${escapeHtml(skill?.summary ?? 'Review detail stays bound to API-owned ticket and skill state.')}</p>
      ${actionButtons}
      <div class="page-section">
        <h3>Timeline</h3>
        ${history.length
          ? `<div class="bullet-list">${history
              .map(
                (entry) => `
                  <article class="bullet-list__item">
                    <strong>${escapeHtml(entry.action ?? 'event')}</strong>
                    <span>${escapeHtml(`${entry.fromStatus ?? 'none'} -> ${entry.toStatus ?? 'unknown'}`)}</span>
                    <span>${escapeHtml(formatTimestamp(entry.createdAt))}</span>
                  </article>
                `,
              )
              .join('')}</div>`
          : '<p class="page-copy">暂无审核历史。</p>'}
      </div>
    </section>
  `;
}

export function createReviewPage(app) {
  return createPageModule({
    id: 'review',
    async render({ host }) {
      const state = app.store.getState();
      const session = state.session;
      const reviewState = state.remote.review ?? { queue: { todo: [], inProgress: [], done: [] }, history: [] };
      const queue = reviewState.queue ?? { todo: [], inProgress: [], done: [] };
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Reviewer queue',
          title: 'Review',
          body: '审核页现在包含待处理队列、详情与时间线，并支持 claim / approve / reject / return。',
        })}
        ${renderQueueColumn('待领取', queue.todo ?? [], 'claim', 'Claim')}
        ${renderQueueColumn('处理中', queue.inProgress ?? [], null, '')}
        ${renderQueueColumn('已完成', queue.done ?? [], null, '')}
        ${renderTicketDetail(reviewState, session)}
      `;
    },
  });
}
