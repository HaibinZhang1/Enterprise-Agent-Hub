export function createMemoryReviewTicketRepository() {
  /** @type {Map<string, any>} */
  const tickets = new Map();

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
  });
}
