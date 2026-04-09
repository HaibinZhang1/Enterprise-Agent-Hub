import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

test('desktop sqlite smoke script stays runnable from the package entrypoint', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-smoke-script-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const run = spawnSync(process.execPath, ['apps/desktop/src/desktop-shell/smoke.js'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DESKTOP_SQLITE_PATH: sqlitePath, DESKTOP_API_BASE_URL: 'http://127.0.0.1:65530' },
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);

  const summary = JSON.parse(run.stdout.trim());
  assert.equal(summary.ok, true);
  assert.equal(summary.smoke, 'sqlite');
  assert.equal(summary.sqlitePath, sqlitePath);
  assert.equal(summary.cacheEntries, 1);
});
