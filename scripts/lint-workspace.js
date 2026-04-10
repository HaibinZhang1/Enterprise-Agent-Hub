import assert from 'node:assert/strict';
import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import {
  AUTH_PENDING_CODE,
  AUTH_ERROR_FIXTURE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
  INSTALL_RECONCILE_STATUS_FIXTURE,
  SSE_PAYLOAD_FIXTURE,
  PHASE_GATES_FIXTURE,
  CONTRACT_OWNERSHIP_FIXTURE,
} from '../packages/contracts/src/index.js';
import {
  postgresMigrationPlan,
  sqliteMigrationPlan,
} from '../packages/migrations/src/index.js';

const expectedDomains = ['auth', 'org', 'skill', 'package', 'review', 'install', 'search', 'notify', 'audit'];
const expectedDesktopModules = [
  'tool-scanner',
  'project-manager',
  'skill-sync',
  'conflict-resolver',
  'local-state',
  'desktop-notify',
  'updater',
];

assert.equal(AUTH_PENDING_CODE, 'AUTHZ_RECALC_PENDING');
assert.equal(AUTH_ERROR_FIXTURE.error.code, AUTH_PENDING_CODE);
assert.deepEqual(apiSkeletonManifest.domains.map((domain) => domain.id), expectedDomains);
assert.deepEqual(desktopSkeletonManifest.modules.map((module) => module.id), expectedDesktopModules);
assert.equal(INSTALL_RECONCILE_STATUS_FIXTURE.serverInstallStates.includes('installed'), true);
assert.equal(SOURCE_OF_TRUTH_MATRIX_FIXTURE.every((entry) => ['server', 'desktop', 'derived'].includes(entry.authority)), true);
assert.equal(SSE_PAYLOAD_FIXTURE.streams.badge.event, 'notify.badge.updated');
assert.deepEqual(
  PHASE_GATES_FIXTURE.map((gate) => gate.gate),
  ['gate-0-foundation', 'gate-0.5-contract-freeze'],
);
assert.equal(CONTRACT_OWNERSHIP_FIXTURE.every((entry) => entry.consumers.length > 0), true);
assert.equal(postgresMigrationPlan.files.length > 0, true);
assert.equal(sqliteMigrationPlan.files.length > 0, true);

console.log(
  JSON.stringify(
    {
      ok: true,
      domains: apiSkeletonManifest.domains.length,
      desktopModules: desktopSkeletonManifest.modules.length,
      sourceOfTruthFacts: SOURCE_OF_TRUTH_MATRIX_FIXTURE.length,
      phaseGates: PHASE_GATES_FIXTURE.length,
      ownedContracts: CONTRACT_OWNERSHIP_FIXTURE.length,
      postgresMigrations: postgresMigrationPlan.files.length,
      sqliteMigrations: sqliteMigrationPlan.files.length,
    },
    null,
    2,
  ),
);
