import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  INSTALL_RECONCILE_STATUS_FIXTURE,
  SSE_PAYLOAD_FIXTURE,
  getSourceOfTruthFactsByAuthority,
  isKnownInstallOrReconcileState,
} from '../packages/contracts/src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} state
 */
function assertKnownState(state) {
  assert.equal(isKnownInstallOrReconcileState(state), true, `Expected "${state}" to remain contract-known`);
}

test('phase 3 install lifecycle keeps server, desktop, and derived authority tiers separated', () => {
  const serverFacts = getSourceOfTruthFactsByAuthority('server');
  const desktopFacts = getSourceOfTruthFactsByAuthority('desktop');
  const derivedFacts = getSourceOfTruthFactsByAuthority('derived');

  assert.equal(serverFacts.some((entry) => entry.fact === 'user install request lifecycle'), true);
  assert.equal(
    desktopFacts.some((entry) => entry.fact === 'download progress and extraction rollback checkpoints'),
    true,
  );
  assert.equal(derivedFacts.some((entry) => entry.fact === 'desktop/server drift summary'), true);
  assert.equal(
    derivedFacts.some((entry) => entry.fact === 'offline blocked state for network-dependent install/update work'),
    true,
  );

  const representativeSlice = [
    { serverState: 'requested', localState: 'queued', derivedState: 'in_sync' },
    { serverState: 'installed', localState: 'downloading', derivedState: 'desktop_drift' },
    { serverState: 'active', localState: 'applied', derivedState: 'in_sync' },
    { serverState: 'active', localState: 'rollback_required', derivedState: 'repair_required' },
    { serverState: 'blocked', localState: 'rollback_required', derivedState: 'permission_narrowed' },
    { serverState: 'installed', localState: 'queued', derivedState: 'offline_blocked' },
  ];

  for (const step of representativeSlice) {
    assertKnownState(step.serverState);
    assertKnownState(step.localState);
    assertKnownState(step.derivedState);
  }

  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.serverInstallStates.includes('blocked'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.desktopLocalStates.includes('rollback_required'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('repair_required'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('offline_blocked'), true);
});

test('phase 3 failure recovery keeps install updates, sync jobs, and conflict decisions available for repair flows', async () => {
  const sql = await readFile(
    resolve(repoRoot, 'packages/migrations/sqlite/sql/0001_local_state_foundation.sql'),
    'utf8',
  );

  assert.equal(SSE_PAYLOAD_FIXTURE.streams.installUpdate.event, 'install.update-available');
  assert.match(sql, /create table if not exists installed_skill_cache \(/);
  assert.match(sql, /create table if not exists sync_jobs \(/);
  assert.match(sql, /failure_reason text/);
  assert.match(sql, /create table if not exists conflict_resolutions \(/);
  assert.match(sql, /decision text not null/);
});
