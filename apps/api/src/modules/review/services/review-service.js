import { approveReviewTicket, claimReviewTicket, createReviewTicket, resolveReviewTicket } from '../core/ticket-policy.js';

/**
 * @param {{
 *   reviewTicketRepository: ReturnType<typeof import('../repositories/memory-review-ticket-repository.js').createMemoryReviewTicketRepository>;
 *   notifyService: ReturnType<typeof import('../../notify/services/notify-service.js').createNotifyService>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 * }} input
 */
export function createReviewService(input) {
  /**
   * @param {string} reviewerId
   * @param {Date | undefined} now
   */
  function syncReviewerQueue(reviewerId, now) {
    const todoCount = input.reviewTicketRepository.list({ reviewerId, status: 'todo' }).length;
    return input.notifyService.setReviewTodoCount({
      userId: reviewerId,
      reviewTodoCount: todoCount,
      now,
    });
  }

  /**
   * @param {string} ticketId
   */
  function requireTicket(ticketId) {
    const ticket = input.reviewTicketRepository.get(ticketId);
    if (!ticket) {
      throw new Error(`Unknown review ticket: ${ticketId}`);
    }
    return ticket;
  }

  /**
   * @param {{ ticketId: string; action: string; fromStatus: string | null; toStatus: string; actorId: string; comment: string; now?: Date; metadata?: Record<string, unknown> }} entry
   */
  function appendHistory(entry) {
    return input.reviewTicketRepository.appendHistory({
      ticketId: entry.ticketId,
      action: entry.action,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      actorId: entry.actorId,
      comment: entry.comment,
      createdAt: (entry.now ?? new Date()).toISOString(),
      metadata: entry.metadata,
    });
  }

  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   skillId: string;
     *   skillTitle: string;
     *   packageId: string;
     *   reviewerId: string;
     *   now?: Date;
     * }} createInput
     */
    createTicket(createInput) {
      const ticket = input.reviewTicketRepository.save(
        createReviewTicket({
          ticketId: createInput.ticketId,
          skillId: createInput.skillId,
          packageId: createInput.packageId,
          requestedBy: createInput.actor.userId,
          reviewerId: createInput.reviewerId,
          createdAt: createInput.now,
        }),
      );
      appendHistory({
        ticketId: ticket.ticketId,
        action: 'created',
        fromStatus: null,
        toStatus: ticket.status,
        actorId: createInput.actor.userId,
        comment: '',
        now: createInput.now,
        metadata: { skillId: ticket.skillId, packageId: ticket.packageId },
      });
      syncReviewerQueue(createInput.reviewerId, createInput.now);
      input.notifyService.notify({
        userId: createInput.reviewerId,
        category: 'review',
        title: 'New review ticket assigned',
        body: `${createInput.skillTitle} is ready for review.`,
        now: createInput.now,
        metadata: { ticketId: ticket.ticketId, skillId: createInput.skillId },
      });
      return ticket;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   now?: Date;
     * }} claimInput
     */
    claimTicket(claimInput) {
      const ticket = requireTicket(claimInput.ticketId);
      const claimedTicket = input.reviewTicketRepository.save(
        claimReviewTicket({
          ticket,
          reviewerId: claimInput.actor.userId,
          claimedAt: claimInput.now,
        }),
      );
      appendHistory({
        ticketId: claimedTicket.ticketId,
        action: 'claim',
        fromStatus: ticket.status,
        toStatus: claimedTicket.status,
        actorId: claimInput.actor.userId,
        comment: '',
        now: claimInput.now,
      });
      syncReviewerQueue(claimInput.actor.userId, claimInput.now);
      input.auditService.record({
        requestId: claimInput.requestId,
        actor: claimInput.actor,
        targetType: 'review_ticket',
        targetId: claimInput.ticketId,
        action: 'review.ticket.claimed',
        details: { skillId: claimedTicket.skillId },
        occurredAt: claimInput.now,
      });
      return claimedTicket;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   comment: string;
     *   now?: Date;
     * }} approveInput
     */
    approveTicket(approveInput) {
      const ticket = requireTicket(approveInput.ticketId);
      const approvedTicket = input.reviewTicketRepository.save(
        approveReviewTicket({
          ticket,
          reviewerId: approveInput.actor.userId,
          comment: approveInput.comment,
          approvedAt: approveInput.now,
        }),
      );
      appendHistory({
        ticketId: approvedTicket.ticketId,
        action: 'approve',
        fromStatus: ticket.status,
        toStatus: approvedTicket.status,
        actorId: approveInput.actor.userId,
        comment: approveInput.comment,
        now: approveInput.now,
      });
      syncReviewerQueue(approveInput.actor.userId, approveInput.now);
      input.auditService.record({
        requestId: approveInput.requestId,
        actor: approveInput.actor,
        targetType: 'review_ticket',
        targetId: approveInput.ticketId,
        action: 'review.ticket.approved',
        details: { skillId: approvedTicket.skillId },
        occurredAt: approveInput.now,
      });
      return approvedTicket;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   ticketId: string;
     *   action: 'reject' | 'return';
     *   comment: string;
     *   now?: Date;
     * }} resolveInput
     */
    resolveTicket(resolveInput) {
      const ticket = requireTicket(resolveInput.ticketId);
      const resolution = resolveReviewTicket({
        ticket,
        reviewerId: resolveInput.actor.userId,
        action: resolveInput.action,
        comment: resolveInput.comment,
        now: resolveInput.now ?? new Date(),
      });
      if (!resolution.ok) {
        throw new Error(`Cannot ${resolveInput.action} review ticket without an active claim.`);
      }
      const resolvedTicket = input.reviewTicketRepository.save(resolution.ticket);
      appendHistory({
        ticketId: resolvedTicket.ticketId,
        action: resolveInput.action,
        fromStatus: ticket.status,
        toStatus: resolvedTicket.status,
        actorId: resolveInput.actor.userId,
        comment: resolveInput.comment,
        now: resolveInput.now,
      });
      syncReviewerQueue(resolveInput.actor.userId, resolveInput.now);
      input.auditService.record({
        requestId: resolveInput.requestId,
        actor: resolveInput.actor,
        targetType: 'review_ticket',
        targetId: resolveInput.ticketId,
        action: `review.ticket.${resolveInput.action}ed`,
        details: { skillId: resolvedTicket.skillId },
        occurredAt: resolveInput.now,
      });
      return resolvedTicket;
    },

    /**
     * @param {string} ticketId
     */
    getTicket(ticketId) {
      return requireTicket(ticketId);
    },

    /**
     * @param {string} ticketId
     */
    listHistory(ticketId) {
      requireTicket(ticketId);
      return input.reviewTicketRepository.listHistory(ticketId);
    },

    /**
     * @param {{ reviewerId?: string; status?: string }} [listInput]
     */
    listTickets(listInput = {}) {
      return input.reviewTicketRepository.list(listInput);
    },
  });
}
