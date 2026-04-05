import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AUTH_PENDING_CODE,
  AUTH_ERROR_FIXTURE,
  AUTH_ORG_CONVERGENCE_FIXTURE,
  CONTRACT_OWNERSHIP_FIXTURE,
  createAuthPendingError,
  getContractsForConsumer,
  getSourceOfTruthFactsByAuthority,
  INSTALL_RECONCILE_STATUS_FIXTURE,
  isKnownInstallOrReconcileState,
  PHASE_GATES_FIXTURE,
  SSE_PAYLOAD_FIXTURE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
} from '../src/index.js';

const fixturesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

/**
 * @param {string} name
 */
async function loadFixture(name) {
  const raw = await readFile(resolve(fixturesRoot, name), 'utf8');
  return JSON.parse(raw);
}

test('auth error fixture stays aligned with AUTHZ_RECALC_PENDING', async () => {
  const fixture = await loadFixture('auth-error-envelope.fixture.json');
  assert.equal(AUTH_PENDING_CODE, 'AUTHZ_RECALC_PENDING');
  assert.deepEqual(AUTH_ERROR_FIXTURE, fixture);
});

test('auth/org convergence fixture stays stable', async () => {
  const fixture = await loadFixture('auth-org-convergence.fixture.json');
  assert.deepEqual(AUTH_ORG_CONVERGENCE_FIXTURE, fixture);
});

test('install reconcile states do not overlap across authority tiers', async () => {
  const fixture = await loadFixture('install-reconcile-status.fixture.json');
  assert.deepEqual(INSTALL_RECONCILE_STATUS_FIXTURE, fixture);

  const overlapping = fixture.serverInstallStates.filter(/** @param {string} state */ (state) =>
    fixture.desktopLocalStates.includes(state) || fixture.derivedReconcileStates.includes(state),
  );

  assert.deepEqual(overlapping, []);
});

test('sse payload fixture includes polling fallback metadata', async () => {
  const fixture = await loadFixture('sse-payload.fixture.json');
  assert.deepEqual(SSE_PAYLOAD_FIXTURE, fixture);
  assert.equal(fixture.streams.reconnect.payload.fallback, 'polling');
});

test('source-of-truth matrix fixture stays limited to supported authorities', async () => {
  const fixture = await loadFixture('source-of-truth-matrix.fixture.json');
  assert.deepEqual(SOURCE_OF_TRUTH_MATRIX_FIXTURE, fixture);
  assert.equal(
    fixture.every(
      /** @param {{ authority: string }} entry */ (entry) =>
        ['server', 'desktop', 'derived'].includes(entry.authority),
    ),
    true,
  );
});

test('phase gate fixture preserves the approved gate sequence', async () => {
  const fixture = await loadFixture('phase-gates.fixture.json');
  assert.deepEqual(PHASE_GATES_FIXTURE, fixture);
  assert.deepEqual(
    fixture.map(/** @param {{ gate: string }} gate */ (gate) => gate.gate),
    ['gate-0-foundation', 'gate-0.5-contract-freeze'],
  );
});

test('contract ownership fixture keeps one canonical source per frozen contract', async () => {
  const fixture = await loadFixture('contract-ownership.fixture.json');
  assert.deepEqual(CONTRACT_OWNERSHIP_FIXTURE, fixture);
  assert.equal(
    fixture.every(
      /** @param {{ canonicalSource: string, fixture: string, consumers: string[] }} entry */ (entry) =>
        Boolean(entry.canonicalSource) && Boolean(entry.fixture) && entry.consumers.length > 0,
    ),
    true,
  );
});

test('runtime helper builds the frozen auth pending envelope with request metadata', () => {
  const envelope = createAuthPendingError({
    requestId: 'req-123',
    details: { retryAfter: 'relogin-after-convergence' },
  });

  assert.equal(envelope.error.code, AUTH_PENDING_CODE);
  assert.equal(envelope.requestId, 'req-123');
  assert.deepEqual(envelope.details, { retryAfter: 'relogin-after-convergence' });
});

test('runtime helpers expose contract ownership and authority lookups', () => {
  const desktopContracts = getContractsForConsumer('apps/desktop');
  const desktopFacts = getSourceOfTruthFactsByAuthority('desktop');

  assert.equal(desktopContracts.length > 0, true);
  assert.equal(desktopContracts.every((entry) => entry.consumers.includes('apps/desktop')), true);
  assert.equal(desktopFacts.length > 0, true);
  assert.equal(desktopFacts.every((entry) => entry.authority === 'desktop'), true);
  assert.equal(isKnownInstallOrReconcileState('offline_blocked'), true);
  assert.equal(isKnownInstallOrReconcileState('unknown_state'), false);
});
