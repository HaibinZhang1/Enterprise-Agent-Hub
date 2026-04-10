import assert from 'node:assert/strict';
import test from 'node:test';

import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import {
  CONTRACT_OWNERSHIP_FIXTURE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
  SSE_PAYLOAD_FIXTURE,
} from '../packages/contracts/src/index.js';

/**
 * @template {{ id: string }} T
 * @param {readonly T[]} collection
 * @param {string} id
 */
function getById(collection, id) {
  const entry = collection.find((item) => item.id === id);
  assert.ok(entry, `expected ${id} to exist`);
  return entry;
}

/**
 * @param {string} contract
 */
function getContract(contract) {
  const entry = CONTRACT_OWNERSHIP_FIXTURE.find((item) => item.contract === contract);
  assert.ok(entry, `expected contract ${contract} to exist`);
  return entry;
}

/**
 * @param {string} fact
 */
function getAuthorityFact(fact) {
  const entry = SOURCE_OF_TRUTH_MATRIX_FIXTURE.find((item) => item.fact === fact);
  assert.ok(entry, `expected authority fact ${fact} to exist`);
  return entry;
}

test('phase 1 governance scaffold keeps auth/org/audit/notify rails wired', () => {
  const auth = getById(apiSkeletonManifest.domains, 'auth');
  const org = getById(apiSkeletonManifest.domains, 'org');
  const audit = getById(apiSkeletonManifest.domains, 'audit');
  const notify = getById(apiSkeletonManifest.domains, 'notify');

  assert.match(auth.focus, /convergence fail-closed handling/);
  assert.deepEqual(auth.corePolicies, [
    'access-policy',
    'session-policy',
    'credential-policy',
    'bootstrap-policy',
    'user-lifecycle-policy',
  ]);
  assert.match(org.focus, /scope convergence triggers/);
  assert.match(audit.focus, /actor snapshots/);
  assert.match(notify.focus, /SSE payload publication/);

  const desktopNotify = getById(desktopSkeletonManifest.modules, 'desktop-notify');
  const localState = getById(desktopSkeletonManifest.modules, 'local-state');

  assert.match(desktopNotify.scope, /badge sync/);
  assert.match(localState.scope, /SQLite cache/);

  const authOrgContract = getContract('auth-org-convergence');
  const sseContract = getContract('sse-payload');
  const unreadBadge = getAuthorityFact('notification unread badge');

  assert.deepEqual(authOrgContract.consumers, ['apps/api']);
  assert.deepEqual(sseContract.consumers, ['apps/api', 'apps/desktop']);
  assert.equal(unreadBadge.authority, 'server');
  assert.deepEqual(unreadBadge.writers, ['notify service']);
});

test('phase 2 publish-review-search-notify slice stays connected across scaffold surfaces', () => {
  const packageDomain = getById(apiSkeletonManifest.domains, 'package');
  const skill = getById(apiSkeletonManifest.domains, 'skill');
  const review = getById(apiSkeletonManifest.domains, 'review');
  const search = getById(apiSkeletonManifest.domains, 'search');
  const notify = getById(apiSkeletonManifest.domains, 'notify');

  assert.match(packageDomain.focus, /artifact upload/);
  assert.match(packageDomain.focus, /risk checks/);
  assert.match(skill.focus, /visibility/);
  assert.match(skill.focus, /history/);
  assert.match(review.focus, /claim locks/);
  assert.match(review.focus, /decision logging/);
  assert.match(search.focus, /permission-filter-before-rank/);
  assert.match(notify.focus, /badge counts/);

  const skillSync = getById(desktopSkeletonManifest.modules, 'skill-sync');
  const desktopNotify = getById(desktopSkeletonManifest.modules, 'desktop-notify');
  const projectManager = getById(desktopSkeletonManifest.modules, 'project-manager');

  assert.match(skillSync.scope, /install, activate, repair/);
  assert.match(desktopNotify.scope, /badge sync/);
  assert.match(projectManager.scope, /manage local project paths and degraded states/);

  assert.equal(SSE_PAYLOAD_FIXTURE.streams.badge.event, 'notify.badge.updated');
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.reviewQueue.event, 'review.queue.updated');
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.badge.payload.reviewTodoCount > 0, true);
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.badge.payload.unreadCount > 0, true);

  const visibilityFact = getAuthorityFact('skill visibility and install entitlement');
  const sourceOfTruthContract = getContract('source-of-truth-matrix');

  assert.equal(visibilityFact.authority, 'server');
  assert.deepEqual(visibilityFact.writers, [
    'review service',
    'skill service',
    'org permission convergence',
  ]);
  assert.deepEqual(sourceOfTruthContract.consumers, ['apps/api', 'apps/desktop']);
});
