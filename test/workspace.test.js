import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { apiSkeletonManifest } from '../apps/api/src/index.js';
import { webSkeletonManifest } from '../apps/web/src/index.js';
import { desktopSkeletonManifest } from '../apps/desktop/src/index.js';
import {
  AUTH_PENDING_CODE,
  SOURCE_OF_TRUTH_MATRIX_FIXTURE,
} from '../packages/contracts/src/index.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {string[]} args
 */
function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

test('api/web/desktop manifests stay aligned to the approved phase-gate contract', () => {
  assert.equal(apiSkeletonManifest.requestContext.authPendingCode, AUTH_PENDING_CODE);
  assert.deepEqual(
    apiSkeletonManifest.domains.map((domain) => domain.id),
    ['auth', 'org', 'skill', 'package', 'review', 'install', 'search', 'notify', 'audit'],
  );

  assert.equal(webSkeletonManifest.authPendingCode, AUTH_PENDING_CODE);
  assert.equal(webSkeletonManifest.realtime.fallback, 'polling');
  assert.equal(
    webSkeletonManifest.pages.every((page) =>
      assert.deepEqual(page.requiredStates, webSkeletonManifest.sharedStates) === undefined),
    true,
  );

  assert.equal(desktopSkeletonManifest.sessionStorageRule.includes('never in SQLite'), true);
  assert.deepEqual(desktopSkeletonManifest.authorityModel, SOURCE_OF_TRUTH_MATRIX_FIXTURE);
});

test('app build scripts emit manifests that match the runtime source of truth', async () => {
  runNode(['apps/api/build.js']);
  runNode(['apps/web/build.js']);
  runNode(['apps/desktop/build.js']);

  const apiDist = JSON.parse(await readFile(resolve(repoRoot, 'apps/api/dist/manifest.json'), 'utf8'));
  const webDist = JSON.parse(await readFile(resolve(repoRoot, 'apps/web/dist/manifest.json'), 'utf8'));
  const desktopDist = JSON.parse(await readFile(resolve(repoRoot, 'apps/desktop/dist/manifest.json'), 'utf8'));

  assert.deepEqual(apiDist, apiSkeletonManifest);
  assert.deepEqual(webDist, webSkeletonManifest);
  assert.deepEqual(desktopDist, desktopSkeletonManifest);
});

test('postgres migration runner can emit a bundled SQL script', async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'enterprise-agent-hub-postgres-'));
  const outputPath = resolve(tempDir, 'postgres.sql');

  const stdout = runNode(['packages/migrations/src/run-postgres-migrations.js', '--emit', outputPath]);
  const emitted = await readFile(outputPath, 'utf8');
  const summary = JSON.parse(stdout);

  assert.equal(summary.ok, true);
  assert.equal(summary.engine, 'postgres');
  assert.equal(summary.mode, 'emit');
  assert.equal(summary.output, outputPath);
  assert.match(emitted, /create schema if not exists auth;/);
  assert.match(emitted, /create table if not exists infra\.outbox_events/);
});

test('sqlite migration runner can emit a bundled SQL script', async () => {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'enterprise-agent-hub-sqlite-'));
  const outputPath = resolve(tempDir, 'sqlite.sql');

  const stdout = runNode(['packages/migrations/src/run-sqlite-migrations.js', '--emit', outputPath]);
  const emitted = await readFile(outputPath, 'utf8');
  const summary = JSON.parse(stdout);

  assert.equal(summary.ok, true);
  assert.equal(summary.engine, 'sqlite');
  assert.equal(summary.mode, 'emit');
  assert.equal(summary.output, outputPath);
  assert.match(emitted, /create table if not exists schema_version/);
  assert.match(emitted, /create table if not exists installed_skill_cache/);
});
