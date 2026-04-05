export const AUTH_PENDING_CODE = 'AUTHZ_RECALC_PENDING';

export const AUTH_ERROR_CODES = Object.freeze([
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_ACCOUNT_FROZEN',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_PASSWORD_CHANGE_REQUIRED',
  'AUTH_FORBIDDEN_SCOPE',
  'AUTH_BOOTSTRAP_DISABLED',
  'AUTH_BOOTSTRAP_TICKET_INVALID',
  'AUTHZ_VERSION_MISMATCH',
  AUTH_PENDING_CODE,
  'AUTH_REFRESH_REUSE_DETECTED',
]);

export const AUTH_ERROR_FIXTURE = Object.freeze({
  version: 1,
  error: {
    domain: 'auth',
    code: AUTH_PENDING_CODE,
    httpStatus: 409,
    retryable: false,
    userMessage: 'Permissions are being recalculated. Please sign in again after convergence finishes.',
    action: 'prompt_relogin_after_convergence',
  },
  metadata: {
    requiresFreshLogin: true,
    clearSession: true,
    authority: 'server',
    allowedClientFallbacks: ['show-blocking-banner', 'redirect-to-login'],
  },
});
