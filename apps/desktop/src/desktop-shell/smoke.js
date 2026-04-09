import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDesktopServer } from '../server.js';

const tempDir = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-desktop-smoke-'));
const sqlitePath = process.env.DESKTOP_SQLITE_PATH ?? join(tempDir, 'desktop.db');

const created = await createDesktopServer({
  port: 0,
  apiBaseUrl: process.env.DESKTOP_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://127.0.0.1:65530',
  sqlitePath,
});

try {
  created.store.saveState('smoke-session', { ok: true, source: 'desktop-smoke' });
  created.store.saveCache('/api/smoke', { ok: true, cachedAt: new Date().toISOString() });

  assert.equal(created.config.sqlitePath, sqlitePath);
  assert.deepEqual(created.store.getState('smoke-session')?.payload, { ok: true, source: 'desktop-smoke' });
  assert.equal(created.store.getCache('/api/smoke')?.payload.ok, true);

  console.log(JSON.stringify({
    ok: true,
    service: '@enterprise-agent-hub/desktop',
    smoke: 'sqlite',
    sqlitePath,
    cacheEntries: created.store.listCaches().length,
  }));
} finally {
  created.server.close();
}
