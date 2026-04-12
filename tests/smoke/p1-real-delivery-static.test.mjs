import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const p1Client = readFileSync('apps/desktop/src/services/p1Client.ts', 'utf8');
const tauriBridge = readFileSync('apps/desktop/src/services/tauriBridge.ts', 'utf8');
const desktopPackage = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync('apps/desktop/src-tauri/tauri.conf.json', 'utf8'));
const cargoToml = readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8');
const tauriMain = readFileSync('apps/desktop/src-tauri/src/main.rs', 'utf8');
const apiPackage = JSON.parse(readFileSync('apps/api/package.json', 'utf8'));
const apiDockerfile = readFileSync('apps/api/Dockerfile', 'utf8');

test('Desktop client defaults to the real API surface and does not auto-fallback to seed data', () => {
  assert.doesNotMatch(p1Client, /\/api\/v1/);
  assert.doesNotMatch(p1Client, /fixtures\/p1SeedData/);
  assert.match(p1Client, /VITE_DESKTOP_API_BASE_URL/);
  assert.match(p1Client, /http:\/\/127\.0\.0\.1:3000/);
  assert.match(p1Client, /authorization/);
});

test('Tauri bridge only permits local command mocks behind an explicit env flag', () => {
  assert.match(tauriBridge, /VITE_P1_ALLOW_TAURI_MOCKS/);
  assert.match(tauriBridge, /Tauri runtime is unavailable/);
  assert.match(tauriBridge, /if \(!allowTauriMocks\) \{\n\s+await requireInvoke\(\);/);
});

test('Tauri packaging config exposes Windows installer intent and command registration', () => {
  assert.equal(tauriConfig.identifier, 'com.enterpriseagenthub.desktop');
  assert.deepEqual(tauriConfig.bundle.targets, ['nsis']);
  assert.match(desktopPackage.scripts['tauri:build:windows'], /x86_64-pc-windows-msvc/);
  assert.match(cargoToml, /tauri =/);
  for (const command of ['get_local_bootstrap', 'install_skill_package', 'enable_skill', 'disable_skill']) {
    assert.match(tauriMain, new RegExp(command));
  }
});

test('API production image uses compiled migrate and seed scripts instead of ts-node', () => {
  assert.equal(apiPackage.scripts.migrate, 'node dist/scripts/migrate.js');
  assert.equal(apiPackage.scripts.seed, 'node dist/scripts/seed.js');
  assert.match(apiDockerfile, /COPY apps\/api\/dist/);
  assert.doesNotMatch(apiDockerfile, /ts-node/);
});
