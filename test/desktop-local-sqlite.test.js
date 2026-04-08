import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createLocalSqliteStore } from '../apps/desktop/src/local-sqlite-store.js';

test('desktop local sqlite store persists state and cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-sqlite-'));
  const store = createLocalSqliteStore({ sqlitePath: join(dir, 'desktop.db') });
  await store.init();

  store.saveState('last-user', { username: 'admin' });
  store.saveCache('/api/market', { ok: true, results: [{ skillId: 'skill-market-1' }] });

  assert.deepEqual(store.getState('last-user')?.payload, { username: 'admin' });
  assert.deepEqual(store.getCache('/api/market')?.payload.results[0].skillId, 'skill-market-1');
  assert.equal(store.listCaches().length, 1);
});
