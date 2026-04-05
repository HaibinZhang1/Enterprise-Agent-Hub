import { AUTH_PENDING_CODE } from '@enterprise-agent-hub/contracts';

export const AUTH_ACCOUNT_FROZEN = 'AUTH_ACCOUNT_FROZEN';
export const AUTHZ_VERSION_MISMATCH = 'AUTHZ_VERSION_MISMATCH';

/**
 * @param {{
 *   userStatus: 'active' | 'frozen';
 *   tokenAuthzVersion: number;
 *   currentAuthzVersion: number;
 *   authzRecalcPending: boolean;
 * }} input
 */
export function evaluateProtectedRequest(input) {
  if (input.userStatus === 'frozen') {
    return Object.freeze({ allowed: false, code: AUTH_ACCOUNT_FROZEN, reason: 'user_frozen' });
  }

  if (input.authzRecalcPending) {
    return Object.freeze({ allowed: false, code: AUTH_PENDING_CODE, reason: 'authz_recalc_pending' });
  }

  if (input.tokenAuthzVersion !== input.currentAuthzVersion) {
    return Object.freeze({
      allowed: false,
      code: AUTHZ_VERSION_MISMATCH,
      reason: 'token_authz_version_stale',
    });
  }

  return Object.freeze({ allowed: true });
}
