import { createLiveAuthGovernanceSlice } from '../modules/auth/live-governance-slice.js';

export function createAdminGovernanceRuntime() {
  const slice = createLiveAuthGovernanceSlice();

  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   username: string;
     *   departmentId: string | null;
     *   roleCode: string;
     *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
     *   now?: Date;
     * }} input
     */
    provisionUser(input) {
      return slice.authAdminController.provisionUser(input).user;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   departmentId: string | null;
     *   roleCode: string;
     *   now?: Date;
     * }} input
     */
    reassignUser(input) {
      return slice.orgAdminController.reassignUser(input);
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   now?: Date;
     * }} input
     */
    completeScopeConvergence(input) {
      return slice.orgAdminController.completeScopeConvergence(input);
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   reason: string;
     *   now?: Date;
     * }} input
     */
    freezeUser(input) {
      return slice.authAdminController.freezeUser(input);
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   now?: Date;
     * }} input
     */
    unfreezeUser(input) {
      return slice.authAdminController.unfreezeUser(input);
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
     *   now?: Date;
     * }} input
     */
    resetPassword(input) {
      return slice.authAdminController.resetPassword(input).user;
    },

    /**
     * @param {{ userId: string; tokenAuthzVersion: number }} input
     */
    evaluateAccess(input) {
      const decision = slice.authController.authorize({
        requestId: `runtime-access-${input.userId}`,
        userId: input.userId,
        tokenAuthzVersion: input.tokenAuthzVersion,
      });
      return decision.ok ? Object.freeze({ allowed: true }) : Object.freeze({ allowed: false, code: decision.code, reason: decision.reason });
    },

    /**
     * @param {string} userId
     */
    getUser(userId) {
      return slice.getUser(userId);
    },

    getAuditTrail() {
      return slice.getAuditTrail();
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return slice.getBadges(userId);
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return slice.listNotifications(userId);
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return slice.drainEvents(userId);
    },
  });
}
