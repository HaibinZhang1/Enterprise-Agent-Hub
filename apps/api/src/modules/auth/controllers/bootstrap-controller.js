/**
 * @param {{ bootstrapService: ReturnType<typeof import('../services/bootstrap-service.js').createBootstrapService> }} input
 */
export function createBootstrapController(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; now?: Date }} issueInput
     */
    issueTicket(issueInput) {
      return input.bootstrapService.issueTicket(issueInput);
    },

    /**
     * @param {{
     *   requestId: string;
     *   bootstrapTicket: string;
     *   userId: string;
     *   username: string;
     *   displayName: string;
     *   departmentId?: string | null;
     *   now?: Date;
     * }} bootstrapInput
     */
    bootstrapAdmin(bootstrapInput) {
      return input.bootstrapService.bootstrapAdmin(bootstrapInput);
    },
  });
}
