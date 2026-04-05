import assert from 'node:assert/strict';
import test from 'node:test';

import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import { webSkeletonManifest } from '../apps/web/src/index.js';
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

  const market = findById(webSkeletonManifest.pages, 'market');
  const mySkill = findById(webSkeletonManifest.pages, 'my-skill');
  const reviewPage = findById(webSkeletonManifest.pages, 'review');
  const skillManagement = findById(webSkeletonManifest.pages, 'skill-management');
  const notifications = findById(webSkeletonManifest.pages, 'notifications');

  assert.deepEqual(market.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(mySkill.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(reviewPage.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(skillManagement.requiredStates, webSkeletonManifest.sharedStates);
  assert.deepEqual(notifications.requiredStates, webSkeletonManifest.sharedStates);

  assert.match(market.focus, /search/);
  assert.match(market.focus, /install entry/);
  assert.match(mySkill.focus, /upload progress/);
  assert.match(reviewPage.focus, /todo\/in-progress\/done workflow/);
  assert.match(skillManagement.focus, /history/);
  assert.match(notifications.focus, /reconnect banner/);
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
