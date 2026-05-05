import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts/checks/check-legacy-runtime-reference-scan.mjs');
const legacyBrand = ['Ta', 'uri'].join('');
const legacyBrandLower = legacyBrand.toLowerCase();
const legacyGlobal = ['__', 'TA', 'URI', '__'].join('');
const legacySourceDir = ['src-', 'ta', 'uri'].join('');

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
    policyId: 'legacy-runtime-reference-scan',
    termPatterns: ['T[a]uri', 't[a]uri', '__T[A]URI__', 'src-t[a]uri'],
    includeGlobs: ['apps/**', 'docs/**'],
    allowedHistoricalGlobs: ['docs/migration-map.md'],
    transitionalBlockerGlobs: [],
    ...overrides,
  };
}

test('repository legacy runtime reference scan tracks current transition blockers in non-strict mode', () => {
  const result = runScan();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Legacy runtime reference scan passed/);
  assert.match(result.stdout, /transitional blocker/);
});

test('unclassified legacy runtime references fail the scan', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-runtime-unclassified-'));
  try {
    mkdirSync(path.join(root, 'apps/desktop'), { recursive: true });
    writeFileSync(path.join(root, 'apps/desktop/runtime.ts'), `window.${legacyGlobal}?.core.invoke("x");\n`);
    writeJson(path.join(root, 'gate.json'), config());

    const result = runScan(['--root', root, '--config', 'gate.json']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unclassified legacy runtime reference/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('transitional blockers pass non-strict and fail strict', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-runtime-transition-'));
  try {
    mkdirSync(path.join(root, 'apps/desktop'), { recursive: true });
    writeFileSync(path.join(root, 'apps/desktop/runtime.ts'), `${legacyBrand} legacy bridge\n`);
    writeJson(path.join(root, 'gate.json'), config({ transitionalBlockerGlobs: ['apps/desktop/runtime.ts'] }));

    const nonStrict = runScan(['--root', root, '--config', 'gate.json']);
    assert.equal(nonStrict.status, 0, `${nonStrict.stdout}\n${nonStrict.stderr}`);

    const strict = runScan(['--root', root, '--config', 'gate.json', '--strict']);
    assert.notEqual(strict.status, 0);
    assert.match(strict.stderr, /Strict legacy runtime reference scan rejects/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('historical migration-map references remain allowed in strict mode', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-runtime-history-'));
  try {
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs/migration-map.md'), `Historical ${legacyBrand} command mapping.\n`);
    writeJson(path.join(root, 'gate.json'), config());

    const result = runScan(['--root', root, '--config', 'gate.json', '--strict']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
