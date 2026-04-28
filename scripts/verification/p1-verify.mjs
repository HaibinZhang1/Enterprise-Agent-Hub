#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const jsonOnly = args.includes('--json');
const configArgIndex = args.findIndex((arg) => arg === '--config');
const reportDirArgIndex = args.findIndex((arg) => arg === '--report-dir');
const configPath = path.resolve(
  repoRoot,
  configArgIndex >= 0 && args[configArgIndex + 1]
    ? args[configArgIndex + 1]
    : 'verification/p1-verification.config.json',
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function relativeStatusPath(filePath) {
  return path.relative(repoRoot, filePath) || '.';
}

function truncate(text, limit = 4000) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated ${text.length - limit} chars]` : text;
}

function nowIso() {
  return new Date().toISOString();
}

function runCommand(check) {
  const missingWhenPaths = (check.whenPathExists ?? []).filter(
    (candidate) => !existsSync(path.resolve(repoRoot, candidate)),
  );

  if (missingWhenPaths.length > 0) {
    return {
      id: check.id,
      label: check.label,
      type: 'command',
      status: 'pending',
      requiredForRelease: Boolean(check.requiredForRelease),
      command: check.command,
      cwd: check.cwd ?? '.',
      skippedReason: `Missing prerequisite path(s): ${missingWhenPaths.join(', ')}`,
      startedAt: nowIso(),
      endedAt: nowIso(),
    };
  }

  const startedAt = nowIso();
  const result = spawnSync(check.command, {
    cwd: path.resolve(repoRoot, check.cwd ?? '.'),
    encoding: 'utf8',
    shell: true,
    timeout: check.timeoutMs ?? 120_000,
    maxBuffer: 1024 * 1024 * 8,
  });
  const endedAt = nowIso();

  const timedOut = result.error?.code === 'ETIMEDOUT';
  const status = result.status === 0 && !timedOut ? 'pass' : 'fail';

  return {
    id: check.id,
    label: check.label,
    type: 'command',
    status,
    requiredForRelease: Boolean(check.requiredForRelease),
    command: check.command,
    cwd: check.cwd ?? '.',
    exitCode: result.status,
    signal: result.signal,
    error: result.error ? String(result.error.message ?? result.error) : null,
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
    startedAt,
    endedAt,
  };
}

function checkArtifact(check) {
  const absolutePath = path.resolve(repoRoot, check.path);
  return {
    id: check.id,
    label: check.label,
    type: 'artifact',
    status: existsSync(absolutePath) ? 'pass' : 'pending',
    requiredForRelease: Boolean(check.requiredForRelease),
    owner: check.owner,
    path: check.path,
    resolvedPath: relativeStatusPath(absolutePath),
  };
}

function checkGeneratedArtifacts(check) {
  const patterns = check.disallowedGlobs ?? [];
  const result = spawnSync('git', ['ls-files', '--', ...patterns], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: check.timeoutMs ?? 30_000,
    maxBuffer: 1024 * 1024,
  });
  const trackedPaths = result.status === 0
    ? result.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
    : [];

  return {
    id: check.id,
    label: check.label,
    type: 'generated-artifact',
    status: result.status === 0 && trackedPaths.length === 0 ? 'pass' : 'fail',
    requiredForRelease: Boolean(check.requiredForRelease),
    owner: check.owner,
    disallowedGlobs: patterns,
    trackedPaths,
    remediation: check.remediation,
    exitCode: result.status,
    stderr: truncate(result.stderr),
  };
}

function markdownReport(report) {
  const lines = [];
  lines.push(`# ${report.name}`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Mode: ${report.strict ? 'strict release gate' : 'non-strict parallel-development audit'}`);
  lines.push(`Overall status: **${report.overallStatus.toUpperCase()}**`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Artifact checks: ${report.summary.artifacts.pass} pass, ${report.summary.artifacts.pending} pending, ${report.summary.artifacts.fail} fail`);
  lines.push(`- Generated artifact checks: ${report.summary.generatedArtifacts.pass} pass, ${report.summary.generatedArtifacts.pending} pending, ${report.summary.generatedArtifacts.fail} fail`);
  lines.push(`- Command checks: ${report.summary.commands.pass} pass, ${report.summary.commands.pending} pending, ${report.summary.commands.fail} fail`);
  lines.push(`- Acceptance scenarios covered by spec: ${report.acceptance.covered}/${report.acceptance.expected}`);
  lines.push('');
  lines.push('## Artifact checks');
  lines.push('');
  lines.push('| Status | ID | Owner | Path |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of report.artifacts) {
    lines.push(`| ${check.status} | ${check.id} | ${check.owner ?? ''} | \`${check.path}\` |`);
  }
  lines.push('');
  lines.push('## Generated artifact checks');
  lines.push('');
  lines.push('| Status | ID | Disallowed globs | Tracked paths |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of report.generatedArtifacts) {
    const tracked = check.trackedPaths?.length ? check.trackedPaths.map((trackedPath) => `\`${trackedPath}\``).join('<br>') : '';
    lines.push(`| ${check.status} | ${check.id} | ${(check.disallowedGlobs ?? []).map((glob) => `\`${glob}\``).join('<br>')} | ${tracked} |`);
  }
  lines.push('');
  lines.push('## Command checks');
  lines.push('');
  lines.push('| Status | ID | Command | Notes |');
  lines.push('| --- | --- | --- | --- |');
  for (const check of report.commands) {
    const notes = check.status === 'pending' ? check.skippedReason : `exit=${check.exitCode ?? ''}`;
    lines.push(`| ${check.status} | ${check.id} | \`${check.command}\` | ${notes} |`);
  }
  lines.push('');
  lines.push('## Acceptance coverage');
  lines.push('');
  lines.push('| Status | Scenario ID |');
  lines.push('| --- | --- |');
  for (const scenario of report.acceptance.scenarios) {
    lines.push(`| ${scenario.covered ? 'covered' : 'missing'} | ${scenario.id} |`);
  }
  lines.push('');
  lines.push('## Failed command output');
  lines.push('');
  const failedCommands = report.commands.filter((check) => check.status === 'fail');
  if (failedCommands.length === 0) {
    lines.push('No failed command output captured.');
  } else {
    for (const check of failedCommands) {
      lines.push(`### ${check.id}`);
      lines.push('');
      lines.push(`Command: \`${check.command}\``);
      lines.push('');
      if (check.stdout) {
        lines.push('<details><summary>stdout</summary>');
        lines.push('');
        lines.push('```text');
        lines.push(check.stdout);
        lines.push('```');
        lines.push('</details>');
        lines.push('');
      }
      if (check.stderr) {
        lines.push('<details><summary>stderr</summary>');
        lines.push('');
        lines.push('```text');
        lines.push(check.stderr);
        lines.push('```');
        lines.push('</details>');
        lines.push('');
      }
    }
  }
  lines.push('');
  lines.push('## Release gate usage');
  lines.push('');
  lines.push('Run `node scripts/verification/p1-verify.mjs --strict` after all worker lanes are integrated. Strict mode fails on pending required artifacts, pending required commands, missing acceptance scenarios, or failed commands.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function summarize(checks) {
  return checks.reduce(
    (acc, check) => {
      acc[check.status] = (acc[check.status] ?? 0) + 1;
      return acc;
    },
    { pass: 0, pending: 0, fail: 0 },
  );
}

if (!existsSync(configPath)) {
  console.error(`Verification config not found: ${configPath}`);
  process.exit(2);
}

const config = readJson(configPath);
  const reportDir = path.resolve(
    repoRoot,
    reportDirArgIndex >= 0 && args[reportDirArgIndex + 1]
      ? args[reportDirArgIndex + 1]
    : config.reportDefaults?.directory ?? 'test-results/verification',
  );
const smokeSpecPath = path.resolve(repoRoot, 'tests/smoke/p1-e2e-smoke-spec.json');
const smokeSpec = existsSync(smokeSpecPath) ? readJson(smokeSpecPath) : { scenarios: [] };
const smokeScenarioIds = new Set((smokeSpec.scenarios ?? []).map((scenario) => scenario.id));

const artifacts = (config.artifactChecks ?? []).map(checkArtifact);
const generatedArtifacts = (config.generatedArtifactChecks ?? []).map(checkGeneratedArtifacts);
const commands = (config.commands ?? []).map(runCommand);
const acceptanceScenarios = (config.acceptanceScenarioIds ?? []).map((id) => ({
  id,
  covered: smokeScenarioIds.has(id),
}));
const missingAcceptance = acceptanceScenarios.filter((scenario) => !scenario.covered);
const requiredArtifacts = artifacts.filter((check) => check.requiredForRelease);
const requiredCommands = commands.filter((check) => check.requiredForRelease);
const generatedArtifactFailures = generatedArtifacts.filter((check) => check.status === 'fail');
const hasFailure = [...artifacts, ...generatedArtifacts, ...commands].some((check) => check.status === 'fail') || missingAcceptance.length > 0;
const hasStrictPending = strict && (
  requiredArtifacts.some((check) => check.status === 'pending') ||
  requiredCommands.some((check) => check.status === 'pending')
);

const report = {
  schemaVersion: 1,
  name: config.name,
  generatedAt: nowIso(),
  strict,
  overallStatus: hasFailure || hasStrictPending ? 'fail' : 'pass',
  summary: {
    artifacts: summarize(artifacts),
    generatedArtifacts: summarize(generatedArtifacts),
    commands: summarize(commands),
  },
  artifacts,
  generatedArtifacts,
  commands,
  acceptance: {
    expected: acceptanceScenarios.length,
    covered: acceptanceScenarios.filter((scenario) => scenario.covered).length,
    scenarios: acceptanceScenarios,
  },
};

mkdirSync(reportDir, { recursive: true });
const markdownPath = path.join(reportDir, config.reportDefaults?.markdownFile ?? 'p1-verification-report.md');
const jsonPath = path.join(reportDir, config.reportDefaults?.jsonFile ?? 'p1-verification-report.json');
writeFileSync(markdownPath, markdownReport(report));
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`P1 verification ${report.overallStatus.toUpperCase()}`);
  console.log(`Markdown report: ${relativeStatusPath(markdownPath)}`);
  console.log(`JSON report: ${relativeStatusPath(jsonPath)}`);
  console.log(`Artifacts: ${report.summary.artifacts.pass} pass, ${report.summary.artifacts.pending} pending, ${report.summary.artifacts.fail} fail`);
  console.log(`Generated artifacts: ${report.summary.generatedArtifacts.pass} pass, ${report.summary.generatedArtifacts.pending} pending, ${report.summary.generatedArtifacts.fail} fail`);
  console.log(`Commands: ${report.summary.commands.pass} pass, ${report.summary.commands.pending} pending, ${report.summary.commands.fail} fail`);
  console.log(`Acceptance coverage: ${report.acceptance.covered}/${report.acceptance.expected}`);
}

process.exit(report.overallStatus === 'pass' ? 0 : 1);
