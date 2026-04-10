import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

function renderQueueColumn(title, items, actionLabel, actionName) {
  return `
    <section class="content-panel glass-panel page-section">
      <h2>${escapeHtml(title)}</h2>
      ${
        items.length
          ? `<div class="bullet-list">${items
              .map(
                (ticket) => `<article class="bullet-list__item"><strong>${escapeHtml(ticket.ticketId ?? 'ticket')}</strong><span>${escapeHtml(ticket.title ?? ticket.skillId ?? '待处理审核')}</span><button type="button" data-review-action="${escapeHtml(actionName)}" data-ticket-id="${escapeHtml(ticket.ticketId ?? '')}">${escapeHtml(actionLabel)}</button></article>`,
              )
              .join('')}</div>`
          : '<p class="page-copy">当前列为空。</p>'
      }
    </section>
  `;
}

export function createReviewPage(app) {
  return createPageModule({
    id: 'review',
    async render({ host }) {
      const queue = app.store.getState().remote.review.queue ?? { todo: [], inProgress: [], done: [] };
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Reviewer queue',
          title: 'Review',
          body: '审核页保留 claim / approve 两类当前必须能力。',
        })}
        ${renderQueueColumn('待领取', queue.todo ?? [], 'Claim', 'claim')}
        ${renderQueueColumn('处理中', queue.inProgress ?? [], 'Approve', 'approve')}
        ${(queue.done ?? []).length ? renderQueueColumn('已完成', queue.done ?? [], 'Approved', 'noop') : renderNotice({ title: '已完成', body: '暂无已完成 ticket。', tone: 'neutral' })}
      `;
    },
  });
}

