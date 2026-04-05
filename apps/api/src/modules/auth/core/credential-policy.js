export const PASSWORD_POLICY = Object.freeze({
  minLength: 12,
  historyWindowSize: 5,
  temporaryCredentialRequiresPasswordChange: true,
});

export const LOGIN_FAILURE_POLICY = Object.freeze({
  maxFailures: 5,
  lockoutMinutes: 15,
});

/**
 * @param {{
 *   password: string;
 *   recentPasswords?: string[];
 * }} input
 */
export function validatePasswordCandidate(input) {
  const recentPasswords = input.recentPasswords ?? [];
  const normalizedPassword = input.password.trim();
  const errors = [];

  if (normalizedPassword.length < PASSWORD_POLICY.minLength) {
    errors.push('password_too_short');
  }

  if (recentPasswords.slice(0, PASSWORD_POLICY.historyWindowSize).includes(input.password)) {
    errors.push('password_reused');
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors,
  });
}

/**
 * @param {{
 *   failedAttemptCount: number;
 *   now: Date;
 * }} input
 */
export function registerFailedLoginAttempt(input) {
  const nextFailedAttemptCount = input.failedAttemptCount + 1;
  const shouldLock = nextFailedAttemptCount >= LOGIN_FAILURE_POLICY.maxFailures;

  return Object.freeze({
    nextFailedAttemptCount,
    lockedUntil: shouldLock
      ? new Date(input.now.getTime() + LOGIN_FAILURE_POLICY.lockoutMinutes * 60 * 1000)
      : null,
  });
}

/**
 * @param {{
 *   now: Date;
 *   lockedUntil: Date | null;
 * }} input
 */
export function evaluateAccountLockState(input) {
  if (!input.lockedUntil) {
    return Object.freeze({ locked: false, remainingSeconds: 0 });
  }

  const remainingMs = input.lockedUntil.getTime() - input.now.getTime();
  if (remainingMs <= 0) {
    return Object.freeze({ locked: false, remainingSeconds: 0 });
  }

  return Object.freeze({
    locked: true,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  });
}

/**
 * @param {{
 *   username: string;
 *   departmentId: string | null;
 *   roleCode: string;
 *   createdBy: string | null;
 *   temporaryCredentialMode: 'bootstrap-ticket' | 'temporary-password' | 'reset-ticket';
 * }} input
 */
export function createProvisioningState(input) {
  return Object.freeze({
    user: {
      username: input.username,
      departmentId: input.departmentId,
      roleCode: input.roleCode,
      status: 'active',
      createdBy: input.createdBy,
      mustChangePassword: PASSWORD_POLICY.temporaryCredentialRequiresPasswordChange,
    },
    credential: {
      mode: input.temporaryCredentialMode,
      mustChangePassword: PASSWORD_POLICY.temporaryCredentialRequiresPasswordChange,
    },
  });
}
