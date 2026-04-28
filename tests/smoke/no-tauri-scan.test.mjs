import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts/checks/check-no-tauri-scan.mjs');

function runScan(args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function config(overrides = {}) {
  return {
    schemaVersion: 1,
    policyId: 'no-tauri-scan',
    terms: ['Tauri', 'tauri', '__TAURI__', 'src-tauri'],
    includeGlobs: ['apps/**', 'docs/**'],
    allowedHistoricalGlobs: ['docs/migration-map.md'],
    transitionalBlockerGlobs: [],
    ...overrides,
  };
}

test('repository no-Tauri scan tracks current transition blockers in non-strict mode', () => {
  const result = runScan();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /No-Tauri scan passed/);
  assert.match(result.stdout, /transitional blocker/);
});

test('unclassified Tauri-era references fail the scan', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'no-tauri-unclassified-'));
  try {
    mkdirSync(path.join(root, 'apps/desktop'), { recursive: true });
    writeFileSync(path.join(root, 'apps/desktop/runtime.ts'), 'window.__TAURI__?.core.invoke("x");\n');
    writeJson(path.join(root, 'gate.json'), config());

    const result = runScan(['--root', root, '--config', 'gate.json']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unclassified Tauri-era reference/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('transitional blockers pass non-strict and fail strict', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'no-tauri-transition-'));
  try {
    mkdirSync(path.join(root, 'apps/desktop'), { recursive: true });
    writeFileSync(path.join(root, 'apps/desktop/runtime.ts'), 'Tauri legacy bridge\n');
    writeJson(path.join(root, 'gate.json'), config({ transitionalBlockerGlobs: ['apps/desktop/runtime.ts'] }));

    const nonStrict = runScan(['--root', root, '--config', 'gate.json']);
    assert.equal(nonStrict.status, 0, `${nonStrict.stdout}\n${nonStrict.stderr}`);

    const strict = runScan(['--root', root, '--config', 'gate.json', '--strict']);
    assert.notEqual(strict.status, 0);
    assert.match(strict.stderr, /Strict no-Tauri scan rejects/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('historical migration-map references remain allowed in strict mode', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'no-tauri-history-'));
  try {
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs/migration-map.md'), 'Historical Tauri command mapping.\n');
    writeJson(path.join(root, 'gate.json'), config());

    const result = runScan(['--root', root, '--config', 'gate.json', '--strict']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
