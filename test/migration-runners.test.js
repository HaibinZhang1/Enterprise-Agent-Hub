import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const cwd = new URL('../', import.meta.url);

function run(script) {
  const result = spawnSync(process.execPath, [script, '--dry-run'], {
    cwd,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('migration runners include the new MVP sql bundles', () => {
  const postgres = run('packages/migrations/src/run-postgres-migrations.js');
  const sqlite = run('packages/migrations/src/run-sqlite-migrations.js');

  assert.equal(postgres.files.some((file) => file.endsWith('0002_mvp_read_models.sql')), true);
  assert.equal(postgres.files.some((file) => file.endsWith('0003_package_artifact_storage.sql')), true);
  assert.equal(postgres.files.some((file) => file.endsWith('0004_review_resolution_history.sql')), true);
  assert.equal(sqlite.files.some((file) => file.endsWith('0002_desktop_client_state.sql')), true);
});
