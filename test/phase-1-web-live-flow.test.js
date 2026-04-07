import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_ACCOUNT_FROZEN } from '../apps/api/src/modules/auth/core/access-policy.js';
import { createPhase1LiveWebFlow } from '../apps/web/src/live/phase-1-live-web-flow.js';
import { AUTH_PENDING_CODE } from '../packages/contracts/src/index.js';

test('phase 1 live web flow executes login/manage-user actions and surfaces notify/audit evidence', () => {
  const flow = createPhase1LiveWebFlow();
  const admin = {
    userId: 'admin-1',
    username: 'admin',
    roleCode: 'system_admin_lv1',
    departmentId: null,
  };

  assert.deepEqual(flow.userManagementPage.load({ actor: null }), {
    state: 'permission-denied',
    reason: 'actor_required',
  });

  const provisioned = flow.userManagementPage.provisionUser({
    requestId: 'req-web-provision',
    actor: admin,
    userId: 'user-1',
    username: 'lisi',
    departmentId: 'dept-1',
    roleCode: 'reviewer_lv5',
    temporaryCredentialMode: 'temporary-password',
    now: new Date('2026-04-06T05:00:00.000Z'),
  });

  assert.equal(provisioned.state, 'ready');
  assert.equal(provisioned.user.userId, 'user-1');
  assert.match(provisioned.temporaryCredential, /^temp-user-1-/);

  assert.equal(flow.userManagementPage.load({ actor: admin }).state, 'ready');
  assert.equal(flow.userManagementPage.load({ actor: admin }).users.length, 1);

  const firstLogin = flow.loginPage.submit({
    requestId: 'req-web-login-1',
    username: 'lisi',
    password: provisioned.temporaryCredential,
    now: new Date('2026-04-06T05:00:10.000Z'),
  });
  assert.equal(firstLogin.state, 'ready');
  assert.equal(firstLogin.user.mustChangePassword, true);

  flow.userManagementPage.reassignUser({
    requestId: 'req-web-reassign',
    actor: admin,
    userId: 'user-1',
    departmentId: 'dept-2',
    roleCode: 'dept_admin_lv4',
    now: new Date('2026-04-06T05:01:00.000Z'),
  });

  assert.deepEqual(
    flow.loginPage.submit({
      requestId: 'req-web-login-pending',
      username: 'lisi',
      password: provisioned.temporaryCredential,
      now: new Date('2026-04-06T05:01:10.000Z'),
    }),
    {
      state: 'error',
      code: AUTH_PENDING_CODE,
      reason: 'authz_recalc_pending',
    },
  );

  flow.userManagementPage.completeScopeConvergence({
    requestId: 'req-web-converged',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T05:02:00.000Z'),
  });

  assert.equal(
    flow.loginPage.submit({
      requestId: 'req-web-login-2',
      username: 'lisi',
      password: provisioned.temporaryCredential,
      now: new Date('2026-04-06T05:02:10.000Z'),
    }).state,
    'ready',
  );

  flow.userManagementPage.freezeUser({
    requestId: 'req-web-freeze',
    actor: admin,
    userId: 'user-1',
    reason: 'security_investigation',
    now: new Date('2026-04-06T05:03:00.000Z'),
  });

  assert.deepEqual(
    flow.loginPage.submit({
      requestId: 'req-web-login-frozen',
      username: 'lisi',
      password: provisioned.temporaryCredential,
      now: new Date('2026-04-06T05:03:10.000Z'),
    }),
    {
      state: 'error',
      code: AUTH_ACCOUNT_FROZEN,
      reason: 'user_frozen',
    },
  );

  flow.userManagementPage.unfreezeUser({
    requestId: 'req-web-unfreeze',
    actor: admin,
    userId: 'user-1',
    now: new Date('2026-04-06T05:04:00.000Z'),
  });

  const reset = flow.userManagementPage.resetPassword({
    requestId: 'req-web-reset',
    actor: admin,
    userId: 'user-1',
    temporaryCredentialMode: 'reset-ticket',
    now: new Date('2026-04-06T05:05:00.000Z'),
  });

  assert.equal(reset.state, 'ready');
  assert.match(reset.temporaryCredential, /^reset-user-1-/);
  assert.equal(
    flow.loginPage.submit({
      requestId: 'req-web-login-reset',
      username: 'lisi',
      password: reset.temporaryCredential,
      now: new Date('2026-04-06T05:05:10.000Z'),
    }).state,
    'ready',
  );

  const notifications = flow.notificationsPage.load({ userId: 'user-1' });
  assert.equal(notifications.state, 'ready');
  assert.equal(notifications.badges.unreadCount >= 1, true);
  assert.equal(notifications.reconnectBanner.visible, true);
  assert.equal(notifications.reconnectBanner.fallback, 'polling');

  assert.deepEqual(
    flow.auditPage.load().entries.map((entry) => entry.action),
    [
      'AUTH_USER_CREATED',
      'AUTH_LOGIN_SUCCEEDED',
      'org.user.assignment.changed',
      'org.scope.recalc.completed',
      'AUTH_LOGIN_SUCCEEDED',
      'AUTH_USER_FROZEN',
      'AUTH_USER_UNFROZEN',
      'AUTH_PASSWORD_RESET',
      'AUTH_LOGIN_SUCCEEDED',
    ],
  );
});
