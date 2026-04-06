/**
 * @param {{ authAdminService: ReturnType<typeof import('../services/auth-admin-service.js').createAuthAdminService> }} input
 */
export function createAuthAdminController(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; username: string; departmentId: string | null; roleCode: string; temporaryCredentialMode: 'temporary-password' | 'reset-ticket'; now?: Date }} provisionInput
     */
    provisionUser(provisionInput) {
      return input.authAdminService.provisionUser(provisionInput);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; reason: string; now?: Date }} freezeInput
     */
    freezeUser(freezeInput) {
      return input.authAdminService.freezeUser(freezeInput);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; now?: Date }} unfreezeInput
     */
    unfreezeUser(unfreezeInput) {
      return input.authAdminService.unfreezeUser(unfreezeInput);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; temporaryCredentialMode: 'temporary-password' | 'reset-ticket'; now?: Date }} resetInput
     */
    resetPassword(resetInput) {
      return input.authAdminService.resetPassword(resetInput);
    },
  });
}
