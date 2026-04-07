import { approveReviewTicket, claimReviewTicket, createReviewTicket } from '../core/ticket-policy.js';

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
     * @param {string} ticketId
     */
    getTicket(ticketId) {
      return requireTicket(ticketId);
    },

    /**
     * @param {{ reviewerId?: string; status?: string }} [listInput]
     */
    listTickets(listInput = {}) {
      return input.reviewTicketRepository.list(listInput);
    },
  });
}
