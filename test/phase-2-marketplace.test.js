import assert from 'node:assert/strict';
import test from 'node:test';

import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import {
  INSTALL_RECONCILE_STATUS_FIXTURE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
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

test('phase 2 marketplace scaffold keeps the publish/review/search/notify loop represented across surfaces', () => {
  const packageDomain = findById(apiSkeletonManifest.domains, 'package');
  const skill = findById(apiSkeletonManifest.domains, 'skill');
  const review = findById(apiSkeletonManifest.domains, 'review');
  const search = findById(apiSkeletonManifest.domains, 'search');
  const notify = findById(apiSkeletonManifest.domains, 'notify');
  const install = findById(apiSkeletonManifest.domains, 'install');

  assert.match(packageDomain.focus, /artifact upload/);
  assert.match(packageDomain.focus, /risk checks/);
  assert.match(skill.focus, /visibility/);
  assert.match(skill.focus, /history/);
  assert.match(review.focus, /claim locks/);
  assert.match(review.focus, /decision logging/);
  assert.match(search.focus, /permission-filter-before-rank/);
  assert.match(notify.focus, /badge counts/);
  assert.match(install.focus, /entitlement narrowing/);

  const skillSync = findById(desktopSkeletonManifest.modules, 'skill-sync');
  const desktopNotify = findById(desktopSkeletonManifest.modules, 'desktop-notify');
  const conflictResolver = findById(desktopSkeletonManifest.modules, 'conflict-resolver');

  assert.match(skillSync.scope, /download, extract, install, activate, repair/);
  assert.match(desktopNotify.scope, /badge sync/);
  assert.match(conflictResolver.scope, /conflict/);
});

test('phase 2 contracts keep minimal search-notify and install authority boundaries stable', () => {
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.reviewQueue.event, 'review.queue.updated');
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.installUpdate.event, 'install.update-available');
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('offline_blocked'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.serverInstallStates.includes('installed'), true);

  const serverFacts = SOURCE_OF_TRUTH_MATRIX_FIXTURE.filter((entry) => entry.authority === 'server');
  assert.equal(serverFacts.some((entry) => entry.fact === 'skill visibility and install entitlement'), true);
  assert.equal(serverFacts.some((entry) => entry.fact === 'notification unread badge'), true);

  const desktopModules = desktopSkeletonManifest.modules.map((module) => module.id);
  assert.equal(desktopModules.includes('skill-sync'), true);
  assert.equal(desktopModules.includes('desktop-notify'), true);
});
