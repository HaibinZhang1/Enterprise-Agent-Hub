import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_ACCOUNT_FROZEN,
  AUTHZ_VERSION_MISMATCH,
  evaluateProtectedRequest,
} from '../apps/api/src/modules/auth/core/access-policy.js';
import {
  AUTH_BOOTSTRAP_DISABLED,
  AUTH_BOOTSTRAP_TICKET_INVALID,
  BOOTSTRAP_TICKET_TTL_MINUTES,
  createBootstrapAdminPlan,
  validateBootstrapTicket,
} from '../apps/api/src/modules/auth/core/bootstrap-policy.js';
import {
  createProvisioningState,
  evaluateAccountLockState,
  LOGIN_FAILURE_POLICY,
  PASSWORD_POLICY,
  registerFailedLoginAttempt,
  validatePasswordCandidate,
} from '../apps/api/src/modules/auth/core/credential-policy.js';
import { buildSessionSchedule, SESSION_POLICY } from '../apps/api/src/modules/auth/core/session-policy.js';
import {
  AUTH_AUDIT_EVENTS,
  planFreezeUser,
  planManagedUserCreation,
  planPasswordReset,
  planUnfreezeUser,
} from '../apps/api/src/modules/auth/core/user-lifecycle-policy.js';
import { AUTH_PENDING_CODE } from '../packages/contracts/src/index.js';

test('access policy fails closed for frozen users, pending convergence, and stale authz version', () => {
  assert.deepEqual(
    evaluateProtectedRequest({
      userStatus: 'frozen',
      tokenAuthzVersion: 5,
      currentAuthzVersion: 5,
      authzRecalcPending: false,
    }),
    { allowed: false, code: AUTH_ACCOUNT_FROZEN, reason: 'user_frozen' },
  );

  assert.deepEqual(
    evaluateProtectedRequest({
      userStatus: 'active',
      tokenAuthzVersion: 5,
      currentAuthzVersion: 5,
      authzRecalcPending: true,
    }),
    { allowed: false, code: AUTH_PENDING_CODE, reason: 'authz_recalc_pending' },
  );

  assert.deepEqual(
    evaluateProtectedRequest({
      userStatus: 'active',
      tokenAuthzVersion: 4,
      currentAuthzVersion: 5,
      authzRecalcPending: false,
    }),
    { allowed: false, code: AUTHZ_VERSION_MISMATCH, reason: 'token_authz_version_stale' },
  );

  assert.deepEqual(
    evaluateProtectedRequest({
      userStatus: 'active',
      tokenAuthzVersion: 5,
      currentAuthzVersion: 5,
      authzRecalcPending: false,
    }),
    { allowed: true },
  );
});

test('session policy emits access, absolute, and idle deadlines from the approved baseline', () => {
  const issuedAt = new Date('2026-04-05T00:00:00.000Z');
  const schedule = buildSessionSchedule(issuedAt);

  assert.equal(schedule.issuedAt.toISOString(), '2026-04-05T00:00:00.000Z');
  assert.equal(schedule.accessExpiresAt.toISOString(), '2026-04-05T00:15:00.000Z');
  assert.equal(schedule.idleExpiresAt.toISOString(), '2026-04-12T00:00:00.000Z');
  assert.equal(schedule.refreshExpiresAt.toISOString(), '2026-05-05T00:00:00.000Z');
  assert.deepEqual(SESSION_POLICY, {
    accessTtlMinutes: 15,
    refreshAbsoluteTtlDays: 30,
    refreshIdleTtlDays: 7,
  });
});

test('credential policy enforces minimum length, password history, and must-change provisioning', () => {
  assert.deepEqual(
    validatePasswordCandidate({
      password: 'short',
      recentPasswords: ['another-password'],
    }),
    { valid: false, errors: ['password_too_short'] },
  );

  assert.deepEqual(
    validatePasswordCandidate({
      password: 'reused-password-1',
      recentPasswords: [
        'reused-password-1',
        'reused-password-2',
        'reused-password-3',
        'reused-password-4',
        'reused-password-5',
      ],
    }),
    { valid: false, errors: ['password_reused'] },
  );

  assert.deepEqual(
    validatePasswordCandidate({
      password: 'brand-new-passphrase',
      recentPasswords: ['reused-password-1'],
    }),
    { valid: true, errors: [] },
  );

  assert.deepEqual(PASSWORD_POLICY, {
    minLength: 12,
    historyWindowSize: 5,
    temporaryCredentialRequiresPasswordChange: true,
  });

  assert.deepEqual(
    createProvisioningState({
      username: 'zhangsan',
      departmentId: 'dept-1',
      roleCode: 'dept_admin_lv4',
      createdBy: 'admin-1',
      temporaryCredentialMode: 'temporary-password',
    }),
    {
      user: {
        username: 'zhangsan',
        departmentId: 'dept-1',
        roleCode: 'dept_admin_lv4',
        status: 'active',
        createdBy: 'admin-1',
        mustChangePassword: true,
      },
      credential: {
        mode: 'temporary-password',
        mustChangePassword: true,
      },
    },
  );
});

test('credential policy locks after five failures for fifteen minutes', () => {
  const fifthFailure = registerFailedLoginAttempt({
    failedAttemptCount: 4,
    now: new Date('2026-04-06T00:00:00.000Z'),
  });

  assert.equal(fifthFailure.nextFailedAttemptCount, 5);
  assert.equal(fifthFailure.lockedUntil?.toISOString(), '2026-04-06T00:15:00.000Z');
  assert.deepEqual(LOGIN_FAILURE_POLICY, {
    maxFailures: 5,
    lockoutMinutes: 15,
  });

  assert.deepEqual(
    evaluateAccountLockState({
      now: new Date('2026-04-06T00:05:01.000Z'),
      lockedUntil: fifthFailure.lockedUntil,
    }),
    { locked: true, remainingSeconds: 599 },
  );

  assert.deepEqual(
    evaluateAccountLockState({
      now: new Date('2026-04-06T00:16:00.000Z'),
      lockedUntil: fifthFailure.lockedUntil,
    }),
    { locked: false, remainingSeconds: 0 },
  );
});

test('bootstrap policy only allows a one-time ticket during the uninitialized window', () => {
  assert.deepEqual(
    validateBootstrapTicket({
      now: new Date('2026-04-06T00:00:00.000Z'),
      systemInitialized: true,
      ticket: {
        issuedAt: new Date('2026-04-05T23:55:00.000Z'),
      },
    }),
    { allowed: false, code: AUTH_BOOTSTRAP_DISABLED, reason: 'system_initialized' },
  );

  assert.deepEqual(
    validateBootstrapTicket({
      now: new Date('2026-04-06T00:11:00.000Z'),
      systemInitialized: false,
      ticket: {
        issuedAt: new Date('2026-04-06T00:00:00.000Z'),
      },
    }),
    { allowed: false, code: AUTH_BOOTSTRAP_TICKET_INVALID, reason: 'ticket_expired' },
  );

  assert.deepEqual(
    validateBootstrapTicket({
      now: new Date('2026-04-06T00:05:00.000Z'),
      systemInitialized: false,
      ticket: {
        issuedAt: new Date('2026-04-06T00:00:00.000Z'),
        consumedAt: new Date('2026-04-06T00:02:00.000Z'),
      },
    }),
    { allowed: false, code: AUTH_BOOTSTRAP_TICKET_INVALID, reason: 'ticket_consumed' },
  );

  const validTicket = validateBootstrapTicket({
    now: new Date('2026-04-06T00:05:00.000Z'),
    systemInitialized: false,
    ticket: {
      issuedAt: new Date('2026-04-06T00:00:00.000Z'),
    },
  });

  assert.equal(validTicket.allowed, true);
  assert.equal(validTicket.expiresAt?.toISOString(), '2026-04-06T00:10:00.000Z');
  assert.equal(BOOTSTRAP_TICKET_TTL_MINUTES, 10);

  assert.deepEqual(
    createBootstrapAdminPlan({
      username: 'admin',
      displayName: 'System Admin',
      departmentId: null,
    }),
    {
      user: {
        username: 'admin',
        displayName: 'System Admin',
        departmentId: null,
        roleCode: 'system_admin_lv1',
        status: 'active',
        mustChangePassword: true,
        provider: 'local',
      },
      bootstrap: {
        requiresOneTimeTicket: true,
        disableBootstrapAfterSuccess: true,
      },
    },
  );
});

test('user lifecycle policy encodes create/freeze/unfreeze/reset auth rules', () => {
  assert.deepEqual(
    planManagedUserCreation({
      username: 'lisi',
      departmentId: 'dept-2',
      roleCode: 'reviewer_lv5',
      createdBy: 'admin-1',
      temporaryCredentialMode: 'temporary-password',
    }),
    {
      user: {
        username: 'lisi',
        departmentId: 'dept-2',
        roleCode: 'reviewer_lv5',
        status: 'active',
        createdBy: 'admin-1',
        mustChangePassword: true,
      },
      credential: {
        mode: 'temporary-password',
        mustChangePassword: true,
      },
      authzVersionIncrement: 0,
      revokeExistingSessions: false,
      auditEvent: 'AUTH_USER_CREATED',
    },
  );

  assert.deepEqual(
    planFreezeUser({
      currentAuthzVersion: 8,
      reason: 'security_hold',
    }),
    {
      nextStatus: 'frozen',
      nextAuthzVersion: 9,
      revokeExistingSessions: true,
      revokeScope: 'all_sessions',
      auditEvent: 'AUTH_USER_FROZEN',
      auditMetadata: { reason: 'security_hold' },
    },
  );

  assert.deepEqual(
    planUnfreezeUser({
      currentAuthzVersion: 9,
    }),
    {
      nextStatus: 'active',
      nextAuthzVersion: 10,
      revokeExistingSessions: false,
      requireFreshLogin: true,
      auditEvent: 'AUTH_USER_UNFROZEN',
    },
  );

  assert.deepEqual(
    planPasswordReset({
      currentAuthzVersion: 10,
      temporaryCredentialMode: 'reset-ticket',
    }),
    {
      nextAuthzVersion: 11,
      revokeExistingSessions: true,
      revokeScope: 'session_family',
      mustChangePassword: true,
      temporaryCredentialMode: 'reset-ticket',
      auditEvent: 'AUTH_PASSWORD_RESET',
    },
  );

  assert.deepEqual(AUTH_AUDIT_EVENTS, {
    userCreated: 'AUTH_USER_CREATED',
    userFrozen: 'AUTH_USER_FROZEN',
    userUnfrozen: 'AUTH_USER_UNFROZEN',
    passwordReset: 'AUTH_PASSWORD_RESET',
  });
});
