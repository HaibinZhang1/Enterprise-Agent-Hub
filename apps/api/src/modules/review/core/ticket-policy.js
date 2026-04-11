export const REVIEW_EVENTS = Object.freeze({
  created: 'review.ticket.created',
  claimed: 'review.ticket.claimed',
  approved: 'review.ticket.approved',
  rejected: 'review.ticket.rejected',
  returned: 'review.ticket.returned',
});

export const REVIEW_ACTION_EVENTS = REVIEW_EVENTS;

/**
 * @param {{
 *   ticketId: string;
 *   skillId: string;
 *   packageId: string;
 *   requestedBy: string;
 *   reviewerId: string;
 *   createdAt?: Date;
 * }} input
 */
export function createReviewTicket(input) {
  const createdAt = input.createdAt ?? new Date();
  return Object.freeze({
    ticketId: input.ticketId,
    skillId: input.skillId,
    packageId: input.packageId,
    requestedBy: input.requestedBy,
    reviewerId: input.reviewerId,
    status: 'todo',
    createdAt: createdAt.toISOString(),
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
    decision: null,
    resolution: null,
    lastEvent: REVIEW_EVENTS.created,
  });
}

/**
 * @param {{
 *   ticket: {
 *     ticketId?: string;
 *     id?: string;
 *     skillId: string;
 *     packageId?: string;
 *     requestedBy?: string;
 *     reviewerId?: string;
 *     status: string;
 *     createdAt?: string;
 *     submittedAt?: string;
 *     dueAt?: string;
 *     claimedBy: string | null;
 *     claimedAt: string | null;
 *     claimExpiresAt?: string | null;
 *     decision: { outcome: string; comment: string; approvedAt: string; approvedBy: string } | null;
 *     resolution?: { action: string; comment: string; resolvedBy: string; resolvedAt: string } | null;
 *     lastEvent: string;
 *   };
 *   reviewerId: string;
 *   now?: Date;
 *   claimedAt?: Date;
 * }} input
 */
export function claimReviewTicket(input) {
  if (input.ticket.status !== 'todo') {
    throw new Error(`Cannot claim review ticket from status: ${input.ticket.status}`);
  }
  if (input.ticket.reviewerId && input.ticket.reviewerId !== input.reviewerId) {
    throw new Error('Ticket is not assigned to this reviewer.');
  }

  const claimedAt = input.claimedAt ?? input.now ?? new Date();
  const ticket = Object.freeze({
    ...input.ticket,
    status: 'in_progress',
    reviewerId: input.ticket.reviewerId ?? input.reviewerId,
    claimedBy: input.reviewerId,
    claimedAt: claimedAt.toISOString(),
    claimExpiresAt: input.ticket.claimExpiresAt ?? new Date(claimedAt.getTime() + 60 * 60 * 1000).toISOString(),
    lastEvent: REVIEW_EVENTS.claimed,
  });

  if (input.now) {
    return Object.freeze({ ok: true, ticket });
  }

  return ticket;
}

/**
 * @param {{
 *   ticket: {
 *     ticketId: string;
 *     skillId: string;
 *     packageId: string;
 *     requestedBy: string;
 *     reviewerId: string;
 *     status: string;
 *     createdAt: string;
 *     claimedBy: string | null;
 *     claimedAt: string | null;
 *     claimExpiresAt?: string | null;
 *     decision: { outcome: string; comment: string; approvedAt: string; approvedBy: string } | null;
 *     resolution?: { action: string; comment: string; resolvedBy: string; resolvedAt: string } | null;
 *     lastEvent: string;
 *   };
 *   reviewerId: string;
 *   comment: string;
 *   approvedAt?: Date;
 * }} input
 */
export function approveReviewTicket(input) {
  if (input.ticket.status !== 'in_progress' || input.ticket.claimedBy !== input.reviewerId) {
    throw new Error('Only the active reviewer can approve the ticket.');
  }

  const approvedAt = input.approvedAt ?? new Date();
  return Object.freeze({
    ...input.ticket,
    status: 'approved',
    decision: Object.freeze({
      outcome: 'approved',
      comment: input.comment,
      approvedAt: approvedAt.toISOString(),
      approvedBy: input.reviewerId,
    }),
    resolution: Object.freeze({
      action: 'approve',
      comment: input.comment,
      resolvedBy: input.reviewerId,
      resolvedAt: approvedAt.toISOString(),
    }),
    lastEvent: REVIEW_EVENTS.approved,
  });
}

/**
 * @param {{
 *   ticket: {
 *     id?: string;
 *     ticketId?: string;
 *     skillId: string;
 *     status: string;
 *     claimedBy: string | null;
 *     dueAt?: string | null;
 *     resolution: { action: string; comment: string; resolvedBy: string; resolvedAt: string } | null;
 *   };
 *   reviewerId: string;
 *   action: 'approve' | 'reject' | 'return';
 *   comment: string;
 *   now: Date;
 * }} input
 */
export function resolveReviewTicket(input) {
  if (input.ticket.status !== 'in_progress' || input.ticket.claimedBy !== input.reviewerId) {
    return Object.freeze({ ok: false, reason: 'claim_required', ticket: input.ticket });
  }

  const nextStatus = input.action === 'approve' ? 'approved' : input.action === 'return' ? 'returned' : 'rejected';
  const lastEvent = input.action === 'approve'
    ? REVIEW_EVENTS.approved
    : input.action === 'return'
      ? REVIEW_EVENTS.returned
      : REVIEW_EVENTS.rejected;

  const resolvedTicket = Object.freeze({
    ...input.ticket,
    status: nextStatus,
    resolution: Object.freeze({
      action: input.action,
      comment: input.comment,
      resolvedBy: input.reviewerId,
      resolvedAt: input.now.toISOString(),
    }),
    lastEvent,
  });

  return Object.freeze({ ok: true, ticket: resolvedTicket });
}

/**
 * @param {{
 *   tickets: Array<{
 *     id: string;
 *     skillId: string;
 *     status: string;
 *     submittedAt: string;
 *     dueAt: string;
 *     claimedBy: string | null;
 *     claimExpiresAt: string | null;
 *     resolution: { action: string; comment: string; resolvedBy: string; resolvedAt: string } | null;
 *   }>;
 *   now: Date;
 * }} input
 */
export function buildReviewQueueSnapshot(input) {
  const nowMs = input.now.getTime();
  const todo = input.tickets
    .filter((ticket) => ticket.status === 'todo')
    .map((ticket) =>
      Object.freeze({
        ...ticket,
        needsSlaWarning: new Date(ticket.dueAt).getTime() <= nowMs,
      }),
    );
  const inProgress = input.tickets
    .filter((ticket) => ticket.status === 'in_progress')
    .map((ticket) =>
      Object.freeze({
        ...ticket,
        needsSlaWarning: new Date(ticket.dueAt).getTime() <= nowMs,
      }),
    );
  const done = input.tickets.filter((ticket) => !['todo', 'in_progress'].includes(ticket.status));
  const overdueTickets = [...todo, ...inProgress].filter((ticket) => ticket.needsSlaWarning).length;

  return Object.freeze({
    todo: Object.freeze(todo),
    inProgress: Object.freeze(inProgress),
    done: Object.freeze(done),
    overdueTickets,
  });
}
