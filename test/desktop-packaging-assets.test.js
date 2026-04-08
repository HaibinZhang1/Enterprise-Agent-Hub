import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

test('desktop packaging assets exist and enable the Tauri release path', async () => {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'apps/desktop/package.json'), 'utf8'));
  const tauriConfig = JSON.parse(await readFile(resolve(repoRoot, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8'));
  const cargoToml = await readFile(resolve(repoRoot, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8');
  const mainRs = await readFile(resolve(repoRoot, 'apps/desktop/src-tauri/src/main.rs'), 'utf8');
  const capability = JSON.parse(await readFile(resolve(repoRoot, 'apps/desktop/src-tauri/capabilities/default.json'), 'utf8'));
  const runbook = await readFile(resolve(repoRoot, 'docs/desktop-release-runbook.md'), 'utf8');

  assert.equal(tauriConfig.bundle.active, true);
  assert.equal(tauriConfig.build.frontendDist, '../ui');
  assert.equal(Array.isArray(tauriConfig.bundle.targets), true);
  assert.equal(tauriConfig.bundle.targets.includes('app'), true);
  assert.equal(packageJson.scripts['tauri:build'].includes('@tauri-apps/cli'), true);
  assert.match(cargoToml, /tauri-build/);
  assert.match(cargoToml, /tauri =/);
  assert.match(mainRs, /tauri::Builder::default/);
  assert.equal(capability.identifier, 'desktop-default');
  assert.deepEqual(capability.windows, ['main']);
  assert.equal(capability.permissions.includes('core:default'), true);
  assert.match(runbook, /pnpm --filter @enterprise-agent-hub\/desktop tauri:build/);
  assert.match(runbook, /cargo --version/);
});
