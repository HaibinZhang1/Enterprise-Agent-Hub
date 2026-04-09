import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

test('production asset verification script reports local, Windows, and deploy readiness evidence', async () => {
  const fixtureDir = resolve(repoRoot, 'apps/desktop/src-tauri/target/release/bundle/nsis');
  const fixtureArtifact = resolve(fixtureDir, 'Enterprise Agent Hub Desktop_0.0.0_x64-setup.exe');
  const macFixtureDir = resolve(repoRoot, 'apps/desktop/src-tauri/target/release/bundle/macos/Enterprise Agent Hub Desktop.app');
  const binaryFixture = resolve(repoRoot, 'apps/desktop/src-tauri/target/release/enterprise-agent-hub-desktop');

  await mkdir(fixtureDir, { recursive: true });
  await mkdir(macFixtureDir, { recursive: true });
  await writeFile(fixtureArtifact, 'windows installer fixture');
  await writeFile(binaryFixture, 'desktop binary fixture');

  try {
    const run = spawnSync(process.execPath, ['scripts/verify-production-assets.js'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        WINDOWS_BUILD_COMMAND: 'pnpm --filter @enterprise-agent-hub/desktop tauri:build:windows',
        WINDOWS_BUILD_RUNNER: 'node-test-fixture',
      },
    });

    assert.equal(run.status, 0, run.stderr || run.stdout);

    const summary = JSON.parse(run.stdout);
    assert.equal(summary.ok, true);
    assert.equal(summary.desktopArtifact.appExists, true);
    assert.equal(summary.desktopArtifact.binaryExists, true);
    assert.equal(summary.desktopArtifact.binarySizeBytes > 0, true);
    assert.equal(summary.desktopArtifact.role, 'macOS supporting artifact only; not Windows release proof');
    assert.equal(summary.windowsArtifact.exists, true);
    assert.equal(summary.windowsArtifact.path, fixtureArtifact);
    assert.equal(summary.windowsArtifact.type, 'nsis-exe');
    assert.equal(summary.windowsArtifact.sizeBytes > 0, true);
    assert.equal(summary.windowsArtifact.buildRunner, 'node-test-fixture');
    assert.equal(summary.releaseGate.ok, true);
    assert.equal(summary.releaseGate.windowsArtifactRequired, true);
    assert.equal(summary.windowsRuntimeValidated, false);
    assert.equal(summary.windowsRuntimeValidationMode, 'not-run');
    assert.match(summary.windowsRuntimeResidualRiskReason, /Windows runtime readiness is not fully proven/i);
    assert.equal(summary.deployReadiness.dockerInfoOk, true);
    assert.equal(summary.deployReadiness.composeConfigOk, true);
    assert.equal(summary.deployReadiness.composeServiceCount >= 3, true);
    assert.equal(Array.isArray(summary.warnings), true);
  } finally {
    await rm(fixtureArtifact, { force: true });
    await rm(binaryFixture, { force: true });
    await rm(macFixtureDir, { recursive: true, force: true });
  }
});
