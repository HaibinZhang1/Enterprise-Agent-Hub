import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import { sqliteMigrationPlan } from '../packages/migrations/src/index.js';
import {
  INSTALL_RECONCILE_STATUS_FIXTURE,
  getSourceOfTruthFactsByAuthority,
  isKnownInstallOrReconcileState,
} from '../packages/contracts/src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string} moduleId
 */
function findDesktopModule(moduleId) {
  const match = desktopSkeletonManifest.modules.find((module) => module.id === moduleId);
  assert.ok(match, `Expected desktop module "${moduleId}" to exist`);
  return match;
}

test('sqlite local-state migration preserves the durable install cache, sync jobs, and conflict decisions', async () => {
  const sql = await readFile(resolve(repoRoot, 'packages/migrations', sqliteMigrationPlan.files[0]), 'utf8');

  assert.match(sql, /create table if not exists installed_skill_cache \(/);
  assert.match(sql, /install_id text primary key/);
  assert.match(sql, /skill_id text not null/);
  assert.match(sql, /local_state text not null/);
  assert.match(sql, /reconcile_state text not null/);

  assert.match(sql, /create table if not exists sync_jobs \(/);
  assert.match(sql, /operation text not null/);
  assert.match(sql, /state text not null/);
  assert.match(sql, /failure_reason text/);

  assert.match(sql, /create table if not exists conflict_resolutions \(/);
  assert.match(sql, /decision text not null/);
  assert.match(sql, /decided_at text not null default current_timestamp/);
});

test('install authority boundaries keep server, desktop, and derived states aligned with the desktop modules', () => {
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

  const skillSync = findDesktopModule('skill-sync');
  const conflictResolver = findDesktopModule('conflict-resolver');
  const localState = findDesktopModule('local-state');
  const desktopNotify = findDesktopModule('desktop-notify');
  const updater = findDesktopModule('updater');

  assert.match(skillSync.scope, /install/);
  assert.match(skillSync.scope, /repair/);
  assert.match(conflictResolver.scope, /conflicts/);
  assert.match(localState.scope, /SQLite cache/);
  assert.match(desktopNotify.scope, /badge sync/);
  assert.match(updater.scope, /update orchestration/);

  for (const state of [
    'requested',
    'active',
    'queued',
    'applied',
    'repair_required',
    'offline_blocked',
  ]) {
    assert.equal(isKnownInstallOrReconcileState(state), true, `Expected "${state}" to stay contract-known`);
  }

  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.serverInstallStates.includes('blocked'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.desktopLocalStates.includes('rollback_required'), true);
  assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.derivedReconcileStates.includes('offline_blocked'), true);
});
