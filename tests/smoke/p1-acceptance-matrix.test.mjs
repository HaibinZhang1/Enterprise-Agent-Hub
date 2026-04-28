import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const requiredScenarioIds = [
  'bootstrap-login-p1-navigation',
  'market-search-filter-sort',
  'restricted-detail-no-leakage',
  'install-hash-success-central-store',
  'install-hash-failure-preserves-state',
  'update-local-hash-change-warning',
  'enable-codex-symlink-success',
  'enable-symlink-failure-copy-fallback',
  'disable-preserves-central-store',
  'uninstall-managed-targets-with-confirmation',
  'offline-enable-disable-queue-restart',
  'local-events-idempotent-sync',
  'publisher-upload-review-browser-flow',
  'publisher-return-resubmit-browser-flow',
  'publisher-reject-no-market-leakage',
  'permission-change-visibility-switch-after-approval',
  'update-publish-old-version-remains-live',
  'same-skill-market-download-install-enable',
  'notifications-read-offline-cache',
];

const requiredCommandIds = [
  'workspace-typecheck',
  'workspace-test',
  'api-test',
  'desktop-frontend-test',
  'cargo-check',
  'cargo-test',
  'fixture-transform-check',
  'docker-config-prod',
  'deploy-script-syntax',
  'w6-acceptance-matrix-test',
  'p1-ui-closure',
  'p1-native-closure',
  'p1-full-closure',
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('W6 verification runner and config are present', () => {
  assert.equal(existsSync('scripts/verification/p1-verify.mjs'), true);
  assert.equal(existsSync('verification/p1-verification.config.json'), true);
});

test('verification config includes required release-gate command lanes', () => {
  const config = readJson('verification/p1-verification.config.json');
  const commandIds = new Set(config.commands.map((command) => command.id));

  for (const id of requiredCommandIds) {
    assert.equal(commandIds.has(id), true, `missing command check: ${id}`);
  }

  for (const command of config.commands) {
    assert.equal(typeof command.command, 'string', `command text missing for ${command.id}`);
    assert.ok(command.command.length > 0, `command text empty for ${command.id}`);
    assert.equal(Array.isArray(command.whenPathExists), true, `whenPathExists must be explicit for ${command.id}`);
  }
});

test('smoke/e2e spec covers required P1 acceptance scenarios', () => {
  const config = readJson('verification/p1-verification.config.json');
  const spec = readJson('tests/smoke/p1-e2e-smoke-spec.json');
  const configScenarioIds = new Set(config.acceptanceScenarioIds);
  const specScenarioIds = new Set(spec.scenarios.map((scenario) => scenario.id));

  for (const id of requiredScenarioIds) {
    assert.equal(configScenarioIds.has(id), true, `verification config missing scenario: ${id}`);
    assert.equal(specScenarioIds.has(id), true, `smoke spec missing scenario: ${id}`);
  }

  for (const scenario of spec.scenarios) {
    assert.equal(typeof scenario.title, 'string', `title missing for ${scenario.id}`);
    assert.ok(scenario.title.length > 0, `title empty for ${scenario.id}`);
    assert.ok(Array.isArray(scenario.coverage) && scenario.coverage.length > 0, `coverage missing for ${scenario.id}`);
    assert.ok(Array.isArray(scenario.steps) && scenario.steps.length > 0, `steps missing for ${scenario.id}`);
    assert.ok(
      Array.isArray(scenario.expectedEvidence) && scenario.expectedEvidence.length > 0,
      `expectedEvidence missing for ${scenario.id}`,
    );
  }
});


test('verification config rejects tracked generated dependency/build artifacts', () => {
  const config = readJson('verification/p1-verification.config.json');
  assert.equal(Array.isArray(config.generatedArtifactChecks), true);
  const generatedCheck = config.generatedArtifactChecks.find((check) => check.id === 'tracked-generated-artifacts');
  assert.ok(generatedCheck, 'missing tracked-generated-artifacts check');

  for (const pattern of ['node_modules/**', '*/node_modules/**', 'packages/*/dist/**']) {
    assert.equal(
      generatedCheck.disallowedGlobs.includes(pattern),
      true,
      `missing generated artifact glob: ${pattern}`,
    );
  }
});
