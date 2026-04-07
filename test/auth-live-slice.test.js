import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_ACCOUNT_FROZEN, AUTHZ_VERSION_MISMATCH } from '../apps/api/src/modules/auth/core/access-policy.js';
import { createLiveAuthGovernanceSlice } from '../apps/api/src/modules/auth/live-governance-slice.js';
import { AUTH_PENDING_CODE } from '../packages/contracts/src/index.js';

test('phase 1 live governance controllers issue sessions and preserve frozen auth/admin contracts', () => {
  const slice = createLiveAuthGovernanceSlice();
  const admin = {
    userId: 'admin-1',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
  };

  const provisioned = slice.authAdminController.provisionUser({
    requestId: 'req-live-create',
    actor: admin,
    userId: 'user-1',
    username: 'lisi',
    departmentId: 'dept-1',
    roleCode: 'reviewer_lv5',
    temporaryCredentialMode: 'temporary-password',
    now: new Date('2026-04-06T00:00:00.000Z'),
  });

  assert.equal(provisioned.user.userId, 'user-1');
  assert.equal(provisioned.user.mustChangePassword, true);
  assert.match(provisioned.temporaryCredential, /^temp-user-1-/);

  const login = slice.authController.login({
    requestId: 'req-live-login-1',
    username: 'lisi',
    password: provisioned.temporaryCredential,
    clientType: 'web',
    deviceLabel: 'Chrome on macOS',
    now: new Date('2026-04-06T00:00:10.000Z'),
  });

  assert.equal(login.ok, true);
  if (!login.ok) {
    throw new Error('expected login success');
  }
  assert.equal(login.user.userId, 'user-1');
  assert.equal(login.user.mustChangePassword, true);
  assert.equal(login.session.userId, 'user-1');
  assert.equal(login.accessToken.sub, 'user-1');
  assert.equal(login.accessToken.sid, login.session.sessionId);
  assert.equal(login.accessToken.authzVersion, 1);
  assert.equal(login.refreshToken.sessionFamilyId, login.session.sessionFamilyId);
  assert.equal(slice.listSessions('user-1').length, 1);

  const changedPassword = slice.authController.changePassword({
    requestId: 'req-live-change-password',
    userId: 'user-1',
    currentPassword: provisioned.temporaryCredential,
    nextPassword: 'brand-new-passphrase-1',
    now: new Date('2026-04-06T00:00:30.000Z'),
  });

  assert.equal(changedPassword.ok, true);
  if (!changedPassword.ok) {
    throw new Error('expected password change success');
  }
  assert.equal(changedPassword.user.mustChangePassword, false);
  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-after-password-change',
      userId: 'user-1',
      sessionId: login.session.sessionId,
      tokenAuthzVersion: 1,
    }),
    {
      ok: false,
      code: 'AUTH_SESSION_REVOKED',
      reason: 'session_revoked',
    },
  );
  assert.deepEqual(
    slice.authController.login({
      requestId: 'req-live-login-stale-after-password-change',
      username: 'lisi',
      password: provisioned.temporaryCredential,
      clientType: 'web',
      deviceLabel: 'Chrome on macOS',
      now: new Date('2026-04-06T00:00:40.000Z'),
    }),
    {
      ok: false,
      code: 'AUTH_INVALID_CREDENTIALS',
      reason: 'invalid_credentials',
    },
  );

  const postPasswordChangeLogin = slice.authController.login({
    requestId: 'req-live-login-after-password-change',
    username: 'lisi',
    password: 'brand-new-passphrase-1',
    clientType: 'web',
    deviceLabel: 'Chrome on macOS',
    now: new Date('2026-04-06T00:00:50.000Z'),
  });

  assert.equal(postPasswordChangeLogin.ok, true);
  if (!postPasswordChangeLogin.ok) {
    throw new Error('expected login success after password change');
  }
  assert.equal(postPasswordChangeLogin.user.mustChangePassword, false);

  slice.orgAdminController.reassignUser({
    requestId: 'req-live-org',
    actor: admin,
    userId: 'user-1',
    departmentId: 'dept-2',
    roleCode: 'dept_admin_lv4',
    now: new Date('2026-04-06T00:01:00.000Z'),
  });

  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-pending',
      userId: 'user-1',
      sessionId: postPasswordChangeLogin.session.sessionId,
      tokenAuthzVersion: 1,
    }),
    {
      ok: false,
      code: AUTH_PENDING_CODE,
      reason: 'authz_recalc_pending',
    },
  );

  slice.orgAdminController.completeScopeConvergence({
    requestId: 'req-live-converged',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T00:02:00.000Z'),
  });

  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-stale',
      userId: 'user-1',
      sessionId: postPasswordChangeLogin.session.sessionId,
      tokenAuthzVersion: 1,
    }),
    {
      ok: false,
      code: AUTHZ_VERSION_MISMATCH,
      reason: 'token_authz_version_stale',
    },
  );

  const relogin = slice.authController.login({
    requestId: 'req-live-login-2',
    username: 'lisi',
    password: 'brand-new-passphrase-1',
    clientType: 'web',
    deviceLabel: 'Chrome on macOS',
    now: new Date('2026-04-06T00:02:10.000Z'),
  });

  assert.equal(relogin.ok, true);
  if (!relogin.ok) {
    throw new Error('expected relogin success');
  }
  assert.equal(relogin.accessToken.authzVersion, 2);

  slice.authAdminController.freezeUser({
    requestId: 'req-live-freeze',
    actor: admin,
    userId: 'user-1',
    reason: 'security_investigation',
    now: new Date('2026-04-06T00:03:00.000Z'),
  });

  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-frozen',
      userId: 'user-1',
      sessionId: relogin.session.sessionId,
      tokenAuthzVersion: 2,
    }),
    {
      ok: false,
      code: 'AUTH_SESSION_REVOKED',
      reason: 'session_revoked',
    },
  );
  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-frozen-without-session',
      userId: 'user-1',
      tokenAuthzVersion: 3,
    }),
    {
      ok: false,
      code: AUTH_ACCOUNT_FROZEN,
      reason: 'user_frozen',
    },
  );
  assert.equal(slice.listActiveSessions('user-1').length, 0);

  slice.authAdminController.unfreezeUser({
    requestId: 'req-live-unfreeze',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T00:04:00.000Z'),
  });

  const postUnfreezeLogin = slice.authController.login({
    requestId: 'req-live-login-3',
    username: 'lisi',
    password: 'brand-new-passphrase-1',
    clientType: 'web',
    deviceLabel: 'Chrome on macOS',
    now: new Date('2026-04-06T00:04:20.000Z'),
  });

  assert.equal(postUnfreezeLogin.ok, true);
  if (!postUnfreezeLogin.ok) {
    throw new Error('expected post-unfreeze login success');
  }
  assert.equal(postUnfreezeLogin.accessToken.authzVersion, 4);

  const reset = slice.authAdminController.resetPassword({
    requestId: 'req-live-reset',
    actor: admin,
    userId: 'user-1',
    temporaryCredentialMode: 'reset-ticket',
    now: new Date('2026-04-06T00:05:00.000Z'),
  });

  assert.equal(reset.user.mustChangePassword, true);
  assert.match(reset.temporaryCredential, /^reset-user-1-/);
  assert.equal(slice.getUser('user-1').authzVersion, 5);
  assert.deepEqual(
    slice.authController.authorize({
      requestId: 'req-live-authorize-reset-revoked',
      userId: 'user-1',
      sessionId: postUnfreezeLogin.session.sessionId,
      tokenAuthzVersion: 4,
    }),
    {
      ok: false,
      code: 'AUTH_SESSION_REVOKED',
      reason: 'session_revoked',
    },
  );
  assert.deepEqual(
    slice.authController.login({
      requestId: 'req-live-login-stale-credential',
      username: 'lisi',
      password: 'brand-new-passphrase-1',
      clientType: 'web',
      deviceLabel: 'Chrome on macOS',
      now: new Date('2026-04-06T00:05:10.000Z'),
    }),
    {
      ok: false,
      code: 'AUTH_INVALID_CREDENTIALS',
      reason: 'invalid_credentials',
    },
  );
  const loginWithResetCredential = slice.authController.login({
    requestId: 'req-live-login-4',
    username: 'lisi',
    password: reset.temporaryCredential,
    clientType: 'web',
    deviceLabel: 'Chrome on macOS',
    now: new Date('2026-04-06T00:05:20.000Z'),
  });
  assert.equal(loginWithResetCredential.ok, true);
  if (!loginWithResetCredential.ok) {
    throw new Error('expected reset credential login success');
  }
  assert.equal(loginWithResetCredential.accessToken.authzVersion, 5);
  assert.equal(slice.getBadges('user-1').unreadCount, 6);
  assert.deepEqual(
    slice.getAuditTrail().map((entry) => entry.action),
    [
      'AUTH_USER_CREATED',
      'AUTH_LOGIN_SUCCEEDED',
      'AUTH_PASSWORD_CHANGED',
      'AUTH_LOGIN_SUCCEEDED',
      'org.user.assignment.changed',
      'org.scope.recalc.completed',
      'AUTH_LOGIN_SUCCEEDED',
      'AUTH_USER_FROZEN',
      'AUTH_USER_UNFROZEN',
      'AUTH_LOGIN_SUCCEEDED',
      'AUTH_PASSWORD_RESET',
      'AUTH_LOGIN_SUCCEEDED',
    ],
  );
  const resetAuditEntry = slice
    .getAuditTrail()
    .find((entry) => entry.requestId === 'req-live-reset');
  assert.deepEqual(resetAuditEntry, {
    requestId: 'req-live-reset',
    actorSnapshot: admin,
    targetType: 'user',
    targetId: 'user-1',
    action: 'AUTH_PASSWORD_RESET',
    result: 'success',
    reason: null,
    occurredAt: '2026-04-06T00:05:00.000Z',
    details: {
      temporaryCredentialMode: 'reset-ticket',
    },
  });
  assert.equal(
    slice.drainEvents('user-1').some((entry) => entry.event === 'sse.reconnect-required'),
    true,
  );
});

test('phase 1 bootstrap controller only allows one admin bootstrap during the init window', () => {
  const slice = createLiveAuthGovernanceSlice();

  const issuedTicket = slice.bootstrapController.issueTicket({
    requestId: 'req-bootstrap-ticket',
    now: new Date('2026-04-06T01:00:00.000Z'),
  });

  assert.equal(issuedTicket.ok, true);
  if (!issuedTicket.ok) {
    throw new Error('expected bootstrap ticket issuance');
  }

  const bootstrapped = slice.bootstrapController.bootstrapAdmin({
    requestId: 'req-bootstrap-admin',
    bootstrapTicket: issuedTicket.ticket.value,
    userId: 'bootstrap-admin-1',
    username: 'bootstrap-admin',
    displayName: 'Bootstrap Admin',
    departmentId: null,
    now: new Date('2026-04-06T01:02:00.000Z'),
  });

  assert.equal(bootstrapped.ok, true);
  if (!bootstrapped.ok) {
    throw new Error('expected bootstrap success');
  }
  assert.equal(bootstrapped.user.roleCode, 'system_admin_lv1');
  assert.equal(bootstrapped.user.mustChangePassword, true);
  assert.match(bootstrapped.temporaryCredential, /^bootstrap-bootstrap-admin-1-/);

  assert.deepEqual(
    slice.bootstrapController.issueTicket({
      requestId: 'req-bootstrap-ticket-after-init',
      now: new Date('2026-04-06T01:03:00.000Z'),
    }),
    {
      ok: false,
      code: 'AUTH_BOOTSTRAP_DISABLED',
      reason: 'system_initialized',
    },
  );
  assert.deepEqual(
    slice.bootstrapController.bootstrapAdmin({
      requestId: 'req-bootstrap-admin-repeat',
      bootstrapTicket: issuedTicket.ticket.value,
      userId: 'bootstrap-admin-2',
      username: 'bootstrap-admin-2',
      displayName: 'Bootstrap Admin 2',
      departmentId: null,
      now: new Date('2026-04-06T01:04:00.000Z'),
    }),
    {
      ok: false,
      code: 'AUTH_BOOTSTRAP_DISABLED',
      reason: 'system_initialized',
    },
  );
  assert.deepEqual(
    slice.getAuditTrail().map((entry) => entry.action),
    ['AUTH_BOOTSTRAP_ADMIN'],
  );
});
