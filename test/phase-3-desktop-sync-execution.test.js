import assert from 'node:assert/strict';
import test from 'node:test';

import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import {
  INSTALL_RECONCILE_STATUS_FIXTURE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
  SSE_PAYLOAD_FIXTURE,
} from '../packages/contracts/src/index.js';

const moduleIds = desktopSkeletonManifest.modules.map((module) => module.id);

/**
 * @param {string} moduleId
 */
function getModule(moduleId) {
  const match = desktopSkeletonManifest.modules.find((module) => module.id === moduleId);
  assert.ok(match, `Expected module "${moduleId}" to exist`);
  return match;
}

test('phase 3 desktop sync/local execution slice keeps the required module handoff intact', () => {
  assert.deepEqual(moduleIds, [
    'tool-scanner',
    'project-manager',
    'skill-sync',
    'conflict-resolver',
    'local-state',
    'desktop-notify',
    'updater',
  ]);

  const toolScanner = getModule('tool-scanner');
  const projectManager = getModule('project-manager');
  const skillSync = getModule('skill-sync');
  const conflictResolver = getModule('conflict-resolver');
  const localState = getModule('local-state');
  const desktopNotify = getModule('desktop-notify');
  const updater = getModule('updater');

  assert.match(toolScanner.scope, /writable-path health/);
  assert.match(projectManager.scope, /degraded states/);
  assert.match(skillSync.scope, /download/);
  assert.match(skillSync.scope, /activate/);
  assert.match(conflictResolver.scope, /file conflicts/);
  assert.match(localState.scope, /sync queue/);
  assert.match(desktopNotify.scope, /badge sync/);
  assert.match(updater.scope, /skill update/);
});

test('phase 3 desktop sync/local execution slice preserves repair and update signals across authority tiers', () => {
  const desktopFacts = SOURCE_OF_TRUTH_MATRIX_FIXTURE.filter((entry) => entry.authority === 'desktop');
  const derivedFacts = SOURCE_OF_TRUTH_MATRIX_FIXTURE.filter((entry) => entry.authority === 'derived');

  assert.equal(desktopFacts.some((entry) => entry.fact === 'download progress and extraction rollback checkpoints'), true);
  assert.equal(desktopFacts.some((entry) => entry.fact === 'tool discovery cache'), true);
  assert.equal(desktopFacts.some((entry) => entry.fact === 'project path health'), true);

  assert.equal(derivedFacts.some((entry) => entry.fact === 'desktop/server drift summary'), true);
  assert.equal(derivedFacts.some((entry) => entry.fact === 'offline blocked state for network-dependent install/update work'), true);

  assert.deepEqual(INSTALL_RECONCILE_STATUS_FIXTURE.desktopLocalStates, [
    'queued',
    'downloading',
    'extracting',
    'applying',
    'applied',
    'rollback_required',
  ]);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('desktop_drift'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('offline_blocked'), true);
  assert.equal(SSE_PAYLOAD_FIXTURE.streams.installUpdate.event, 'install.update-available');
});
