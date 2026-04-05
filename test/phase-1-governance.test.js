import assert from 'node:assert/strict';
import test from 'node:test';

import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { webSkeletonManifest } from '../apps/web/src/index.js';
import {
  AUTH_ORG_CONVERGENCE_FIXTURE,
  AUTH_PENDING_CODE,
  SSE_PAYLOAD_FIXTURE,
} from '../packages/contracts/src/index.js';

/**
 * @param {readonly { id: string }[]} entries
 * @param {string} id
 */
function findById(entries, id) {
  const match = entries.find((entry) => entry.id === id);
  assert.ok(match, `Expected entry with id "${id}" to exist`);
  return match;
}

test('phase 1 governance scaffold keeps auth/org/audit/notify rails wired across api and web', () => {
  const auth = findById(apiSkeletonManifest.domains, 'auth');
  const org = findById(apiSkeletonManifest.domains, 'org');
  const audit = findById(apiSkeletonManifest.domains, 'audit');
  const notify = findById(apiSkeletonManifest.domains, 'notify');

  assert.deepEqual(auth.controllers, ['auth.controller', 'auth-admin.controller', 'bootstrap.controller']);
  assert.deepEqual(auth.services, [
    'auth.service',
    'session.service',
    'password.service',
    'bootstrap.service',
    'authz-version.service',
  ]);
  assert.deepEqual(auth.corePolicies, [
    'access-policy',
    'session-policy',
    'credential-policy',
    'bootstrap-policy',
    'user-lifecycle-policy',
  ]);

  assert.match(org.focus, /department tree/);
  assert.match(org.focus, /impacted-user calculation/);
  assert.match(org.focus, /scope convergence triggers/);

  assert.match(audit.focus, /actor snapshots/);

  assert.match(notify.focus, /badge counts/);
  assert.match(notify.focus, /SSE payload publication/);
  assert.match(notify.focus, /polling fallback metadata/);

  const departmentManagement = findById(webSkeletonManifest.pages, 'department-management');
  const userManagement = findById(webSkeletonManifest.pages, 'user-management');
  const notifications = findById(webSkeletonManifest.pages, 'notifications');

  assert.equal(webSkeletonManifest.authPendingCode, AUTH_PENDING_CODE);
  assert.deepEqual(departmentManagement.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(userManagement.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(notifications.requiredStates, webSkeletonManifest.sharedStates);
  assert.match(departmentManagement.focus, /impact preview/);
  assert.match(userManagement.focus, /freeze, unfreeze, reset password/);
  assert.match(notifications.focus, /badge sync/);
});

test('phase 1 convergence and notify contracts preserve fail-closed pending behavior and polling fallback', () => {
  assert.equal(AUTH_ORG_CONVERGENCE_FIXTURE.serverActions.onPendingProtectedRequest, 'deny with AUTHZ_RECALC_PENDING');
  assert.equal(AUTH_ORG_CONVERGENCE_FIXTURE.serverActions.onPendingRefresh, 'deny and require fresh login after convergence');
  assert.equal(AUTH_ORG_CONVERGENCE_FIXTURE.progression.includes('protected requests fail closed while pending=true'), true);

  assert.equal(SSE_PAYLOAD_FIXTURE.streams.badge.event, 'notify.badge.updated');
  assert.deepEqual(Object.keys(SSE_PAYLOAD_FIXTURE.streams.badge.payload), [
    'unreadCount',
    'reviewTodoCount',
    'updateAvailableCount',
    'generatedAt',
  ]);
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.reconnect.payload.fallback, 'polling');
});
