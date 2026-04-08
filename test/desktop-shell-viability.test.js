import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDesktopServer } from '../apps/desktop/src/server.js';

test('desktop shell bootstraps sqlite-backed local environment before api wiring', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-shell-'));
  const created = await createDesktopServer({
    port: 4194,
    sqlitePath: join(dir, 'desktop.db'),
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  assert.equal(created.config.port, 4194);
  assert.equal(created.config.sqlitePath.endsWith('desktop.db'), true);
  assert.equal(created.store.listCaches().length, 0);
  created.server.close();
});
