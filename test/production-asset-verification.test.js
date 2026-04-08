import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

test('production asset verification script reports local release and deploy readiness evidence', () => {
  const run = spawnSync(process.execPath, ['scripts/verify-production-assets.js'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);

  const summary = JSON.parse(run.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.desktopArtifact.appExists, true);
  assert.equal(summary.desktopArtifact.binaryExists, true);
  assert.equal(summary.desktopArtifact.binarySizeBytes > 0, true);
  assert.equal(summary.deployReadiness.dockerInfoOk, true);
  assert.equal(summary.deployReadiness.composeConfigOk, true);
  assert.equal(summary.deployReadiness.composeServiceCount >= 3, true);
  assert.equal(Array.isArray(summary.warnings), true);
});
