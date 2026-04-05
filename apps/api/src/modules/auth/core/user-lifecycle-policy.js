import { createProvisioningState } from './credential-policy.js';

export const AUTH_AUDIT_EVENTS = Object.freeze({
  userCreated: 'AUTH_USER_CREATED',
  userFrozen: 'AUTH_USER_FROZEN',
  userUnfrozen: 'AUTH_USER_UNFROZEN',
  passwordReset: 'AUTH_PASSWORD_RESET',
});

/**
 * @param {{
 *   username: string;
 *   departmentId: string | null;
 *   roleCode: string;
 *   createdBy: string;
 *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
 * }} input
 */
export function planManagedUserCreation(input) {
  const provisioning = createProvisioningState({
    username: input.username,
    departmentId: input.departmentId,
    roleCode: input.roleCode,
    createdBy: input.createdBy,
    temporaryCredentialMode: input.temporaryCredentialMode,
  });

  return Object.freeze({
    ...provisioning,
    authzVersionIncrement: 0,
    revokeExistingSessions: false,
    auditEvent: AUTH_AUDIT_EVENTS.userCreated,
  });
}

/**
 * @param {{
 *   currentAuthzVersion: number;
 *   reason: string;
 * }} input
 */
export function planFreezeUser(input) {
  return Object.freeze({
    nextStatus: 'frozen',
    nextAuthzVersion: input.currentAuthzVersion + 1,
    revokeExistingSessions: true,
    revokeScope: 'all_sessions',
    auditEvent: AUTH_AUDIT_EVENTS.userFrozen,
    auditMetadata: { reason: input.reason },
  });
}

/**
 * @param {{
 *   currentAuthzVersion: number;
 * }} input
 */
export function planUnfreezeUser(input) {
  return Object.freeze({
    nextStatus: 'active',
    nextAuthzVersion: input.currentAuthzVersion + 1,
    revokeExistingSessions: false,
    requireFreshLogin: true,
    auditEvent: AUTH_AUDIT_EVENTS.userUnfrozen,
  });
}

/**
 * @param {{
 *   currentAuthzVersion: number;
 *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
 * }} input
 */
export function planPasswordReset(input) {
  return Object.freeze({
    nextAuthzVersion: input.currentAuthzVersion + 1,
    revokeExistingSessions: true,
    revokeScope: 'session_family',
    mustChangePassword: true,
    temporaryCredentialMode: input.temporaryCredentialMode,
    auditEvent: AUTH_AUDIT_EVENTS.passwordReset,
  });
}
