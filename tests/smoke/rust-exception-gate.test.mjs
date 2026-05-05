import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts/checks/check-rust-exception-gate.mjs');
const legacyCrate = ['ta', 'uri'].join('');

function runGate(args = [], options = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function baseConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    policyId: 'rust-exception-gate',
    migrationPhase: 'test',
    allowedHelperRoots: ['helpers/**'],
    approvedCriteria: ['hashing-or-authenticode-verification-more-reliable-in-helper'],
    requiredExceptionFields: [
      'id',
      'capability',
      'decision',
      'status',
      'owner',
      'helperRoot',
      'rationale',
      'criteria',
      'parityTests',
      'packagingCheck',
      'ipcErrorMapping',
      'migrationMapReference',
    ],
    disallowedPathFragments: ['src-t[a]uri'],
    disallowedCratePatterns: ['^t[a]uri$'],
    disallowedContentPatterns: ['t[a]uri::'],
    exceptions: [],
    transitionalLegacyRustBlockers: [],
    ...overrides,
  };
}

function approvedHelperException(overrides = {}) {
  return {
    id: 'authenticode-helper',
    capability: 'Windows signature verification',
    decision: 'rust-helper',
    status: 'approved',
    owner: 'worker-6',
    helperRoot: 'helpers/authenticode',
    rationale: 'Existing verification semantics are safer to preserve in a helper.',
    criteria: ['hashing-or-authenticode-verification-more-reliable-in-helper'],
    parityTests: ['node --test tests/smoke/rust-exception-gate.test.mjs'],
    packagingCheck: 'helper packaged by Electron builder extraResources gate',
    ipcErrorMapping: 'main process maps helper exit codes to typed DesktopBridge errors',
    migrationMapReference: 'docs/DetailedDesign/electron-runtime-capability-map.md#client-update',
    ...overrides,
  };
}

test('repository Rust exception gate config is present and currently approves no retained helper', () => {
  const config = JSON.parse(readFileSync('verification/rust-exception-gate.json', 'utf8'));

  assert.equal(config.policyId, 'rust-exception-gate');
  assert.equal(Array.isArray(config.exceptions), true);
  assert.equal(config.exceptions.length, 0);
  assert.deepEqual(config.transitionalLegacyRustBlockers, []);

  const result = runGate();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Rust exception gate passed/);
});

test('undocumented Rust artifacts outside approved helper roots fail the gate', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'rust-gate-undocumented-'));
  try {
    mkdirSync(path.join(root, 'helpers/authenticode/src'), { recursive: true });
    writeFileSync(path.join(root, 'helpers/authenticode/src/main.rs'), 'fn main() {}\n');
    writeJson(path.join(root, 'gate.json'), baseConfig());

    const result = runGate(['--root', root, '--config', 'gate.json']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Undocumented Rust artifact/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('approved non-legacy helper with required documentation passes the gate', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'rust-gate-approved-'));
  try {
    mkdirSync(path.join(root, 'helpers/authenticode/src'), { recursive: true });
    writeFileSync(path.join(root, 'helpers/authenticode/Cargo.toml'), '[package]\nname = "authenticode"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nsha2 = "0.10"\n');
    writeFileSync(path.join(root, 'helpers/authenticode/src/main.rs'), 'fn main() {}\n');
    writeJson(path.join(root, 'gate.json'), baseConfig({ exceptions: [approvedHelperException()] }));

    const result = runGate(['--root', root, '--config', 'gate.json']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('approved helper cannot depend on disallowed legacy runtime crates', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'rust-gate-legacy-runtime-'));
  try {
    mkdirSync(path.join(root, 'helpers/authenticode/src'), { recursive: true });
    writeFileSync(path.join(root, 'helpers/authenticode/Cargo.toml'), `[package]\nname = "authenticode"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n${legacyCrate} = "2"\n`);
    writeFileSync(path.join(root, 'helpers/authenticode/src/main.rs'), 'fn main() {}\n');
    writeJson(path.join(root, 'gate.json'), baseConfig({ exceptions: [approvedHelperException()] }));

    const result = runGate(['--root', root, '--config', 'gate.json']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /disallowed crate/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
