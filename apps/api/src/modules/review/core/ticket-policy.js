export const REVIEW_ACTION_EVENTS = Object.freeze({
  created: 'review.ticket.created',
  claimed: 'review.ticket.claimed',
  approved: 'review.ticket.approved',
  rejected: 'review.ticket.rejected',
  returned: 'review.ticket.returned',
  slaWarning: 'review.ticket.sla.warning',
});

/**
 * @typedef {{
 *   id: string;
 *   skillId: string;
 *   status: 'todo' | 'in_progress' | 'approved' | 'rejected' | 'returned';
 *   submittedAt: string;
 *   dueAt: string;
 *   claimedBy?: string | null;
 *   claimExpiresAt?: string | null;
 *   resolution?: { action: string; comment: string; resolvedBy: string; resolvedAt: string } | null;
 * }} ReviewTicket
 */

/**
 * @param {{ ticket: ReviewTicket; reviewerId: string; now: Date; lockMinutes?: number }} input
 */
export function claimReviewTicket(input) {
  const claimExpiresAt = input.ticket.claimExpiresAt ? new Date(input.ticket.claimExpiresAt) : null;
  const lockExpired = claimExpiresAt ? claimExpiresAt.getTime() <= input.now.getTime() : true;
  const claimable = input.ticket.status === 'todo' || (input.ticket.status === 'in_progress' && lockExpired);

  if (!claimable) {
    return Object.freeze({ ok: false, reason: 'ticket_not_claimable' });
  }

  return Object.freeze({
    ok: true,
    event: REVIEW_ACTION_EVENTS.claimed,
    ticket: Object.freeze({
      ...input.ticket,
      status: 'in_progress',
      claimedBy: input.reviewerId,
      claimExpiresAt: new Date(
        input.now.getTime() + (input.lockMinutes ?? 30) * 60 * 1000,
      ).toISOString(),
    }),
  });
}

/**
 * @param {{
 *   ticket: ReviewTicket;
 *   reviewerId: string;
 *   action: 'approve' | 'reject' | 'return';
 *   comment: string;
 *   now: Date;
 * }} input
 */
export function resolveReviewTicket(input) {
  if (input.ticket.status !== 'in_progress' || input.ticket.claimedBy !== input.reviewerId) {
    return Object.freeze({ ok: false, reason: 'reviewer_does_not_hold_ticket' });
  }

  const statusByAction = {
    approve: 'approved',
    reject: 'rejected',
    return: 'returned',
  };
  const eventByAction = {
    approve: REVIEW_ACTION_EVENTS.approved,
    reject: REVIEW_ACTION_EVENTS.rejected,
    return: REVIEW_ACTION_EVENTS.returned,
  };

  const nextStatus = statusByAction[input.action];
  const nextEvent = eventByAction[input.action];

  return Object.freeze({
    ok: true,
    event: nextEvent,
    ticket: Object.freeze({
      ...input.ticket,
      status: nextStatus,
      claimExpiresAt: null,
      resolution: Object.freeze({
        action: input.action,
        comment: input.comment,
        resolvedBy: input.reviewerId,
        resolvedAt: input.now.toISOString(),
      }),
    }),
  });
}

/**
 * @param {{ tickets: ReviewTicket[]; now: Date }} input
 */
export function buildReviewQueueSnapshot(input) {
  const todo = [];
  const inProgress = [];
  const done = [];
  let overdueTickets = 0;

  for (const ticket of input.tickets) {
    const isOverdue = new Date(ticket.dueAt).getTime() < input.now.getTime();
    if (isOverdue) {
      overdueTickets += 1;
    }

    const projected = Object.freeze({
      ...ticket,
      isOverdue,
      needsSlaWarning: isOverdue && (ticket.status === 'todo' || ticket.status === 'in_progress'),
    });

    if (ticket.status === 'todo') {
      todo.push(projected);
    } else if (ticket.status === 'in_progress') {
      inProgress.push(projected);
    } else {
      done.push(projected);
    }
  }

  return Object.freeze({
    todo: Object.freeze(todo),
    inProgress: Object.freeze(inProgress),
    done: Object.freeze(done),
    overdueTickets,
  });
}
