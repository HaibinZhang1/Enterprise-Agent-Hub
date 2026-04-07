/**
 * @typedef {{
 *   ticketId: string;
 *   secret: string;
 *   issuedAt: string;
 *   expiresAt: string | null;
 *   consumedAt: string | null;
 * }} BootstrapTicketRecord
 */

/**
 * @param {BootstrapTicketRecord} ticket
 */
function freezeTicket(ticket) {
  return Object.freeze({ ...ticket });
}

export function createMemoryBootstrapTicketRepository() {
  /** @type {BootstrapTicketRecord | null} */
  let currentTicket = null;
  let systemInitialized = false;
  let nextTicketSequence = 1;

  return Object.freeze({
    isSystemInitialized() {
      return systemInitialized;
    },

    /**
     * @param {{ issuedAt: string; expiresAt: string | null }} input
     */
    issueTicket(input) {
      const sequence = nextTicketSequence;
      nextTicketSequence += 1;

      currentTicket = freezeTicket({
        ticketId: `bootstrap-ticket-${sequence}`,
        secret: `bootstrap-secret-${sequence}`,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        consumedAt: null,
      });
      return currentTicket;
    },

    getCurrentTicket() {
      return currentTicket;
    },

    /**
     * @param {{ consumedAt: string }} input
     */
    consumeCurrentTicket(input) {
      if (!currentTicket) {
        throw new Error('Bootstrap ticket does not exist.');
      }

      currentTicket = freezeTicket({
        ...currentTicket,
        consumedAt: input.consumedAt,
      });
      return currentTicket;
    },

    markInitialized() {
      systemInitialized = true;
      return systemInitialized;
    },
  });
}
