import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const contracts = readFileSync(new URL('../src/common/p1-contracts.ts', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../src/database/p1-seed.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../src/database/migrations/001_p1_base.sql', import.meta.url), 'utf8');
const skillsService = readFileSync(new URL('../src/skills/skills.service.ts', import.meta.url), 'utf8');

test('P1 API contracts preserve symlink-first copy fallback fields', () => {
  for (const field of ['requestedMode', 'resolvedMode', 'fallbackReason', 'installMode']) {
    assert.match(contracts, new RegExp(field));
  }
  assert.match(contracts, /'symlink' \| 'copy'/);
});

test('P1 seed covers full, restricted, and delisted skill scenarios', () => {
  assert.match(seed, /detailAccess: 'full'/);
  assert.match(seed, /detailAccess: 'summary'/);
  assert.match(seed, /status: 'delisted'/);
  assert.match(skillsService, /packageHash: 'sha256:[a-f0-9]{64}'/);
});

test('PostgreSQL migration includes FTS and local-event idempotency gates', () => {
  assert.match(migration, /TSVECTOR NOT NULL/);
  assert.match(migration, /USING GIN\(search_vector\)/);
  assert.match(migration, /UNIQUE\(device_id, event_id\)/);
  assert.match(migration, /requested_mode TEXT CHECK/);
  assert.match(migration, /resolved_mode TEXT CHECK/);
});
