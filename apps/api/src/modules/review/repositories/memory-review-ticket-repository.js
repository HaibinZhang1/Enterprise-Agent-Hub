export function createMemoryReviewTicketRepository() {
  /** @type {Map<string, any>} */
  const tickets = new Map();
  /** @type {Map<string, any[]>} */
  const historyByTicketId = new Map();

  /**
   * @param {any[]} entries
   */
  function sortHistory(entries) {
    return [...entries].sort((left, right) => {
      const timeDelta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return (left.sequence ?? 0) - (right.sequence ?? 0);
    });
  }

  return Object.freeze({
    /**
     * @param {any} ticket
     */
    save(ticket) {
      tickets.set(ticket.ticketId, ticket);
      return ticket;
    },

    /**
     * @param {string} ticketId
     */
    get(ticketId) {
      return tickets.get(ticketId) ?? null;
    },

    /**
     * @param {{ reviewerId?: string; status?: string }} [input]
     */
    list(input = {}) {
      return Object.freeze(
        [...tickets.values()].filter((ticket) => {
          if (input.reviewerId && ticket.reviewerId !== input.reviewerId) {
            return false;
          }
          if (input.status && ticket.status !== input.status) {
            return false;
          }
          return true;
        }),
      );
    },

    /**
     * @param {{ ticketId: string; action: string; fromStatus: string | null; toStatus: string; actorId: string; comment: string; createdAt: string; metadata?: Record<string, unknown> }} entry
     */
    appendHistory(entry) {
      const existing = historyByTicketId.get(entry.ticketId) ?? [];
      const stored = Object.freeze({
        ...entry,
        sequence: existing.length + 1,
        metadata: Object.freeze({ ...(entry.metadata ?? {}) }),
      });
      historyByTicketId.set(entry.ticketId, [...existing, stored]);
      return stored;
    },

    /**
     * @param {string} ticketId
     */
    listHistory(ticketId) {
      return Object.freeze(sortHistory(historyByTicketId.get(ticketId) ?? []));
    },
  });
}
