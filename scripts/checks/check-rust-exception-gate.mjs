#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const jsonOnly = args.includes('--json');

function readOption(name, fallback) {
  const index = args.findIndex((arg) => arg === name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const repoRoot = path.resolve(readOption('--root', process.cwd()));
const configPath = path.resolve(repoRoot, readOption('--config', 'verification/rust-exception-gate.json'));

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function relativePath(absolutePath) {
  return toPosix(path.relative(repoRoot, absolutePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isSafeRelativePath(candidate) {
  return typeof candidate === 'string'
    && candidate.length > 0
    && !path.isAbsolute(candidate)
    && !candidate.split('/').includes('..')
    && !candidate.startsWith('.git/');
}

function normalizePrefix(candidate) {
  return candidate.replace(/^\.\//, '').replace(/\/+$/, '');
}

function patternMatches(pattern, candidate) {
  const normalizedPattern = normalizePrefix(pattern);
  const normalizedCandidate = normalizePrefix(candidate);

  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3);
    return normalizedCandidate === prefix || normalizedCandidate.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]+');
    return new RegExp(`^${escaped}(?:/.*)?$`).test(normalizedCandidate);
  }

  return normalizedCandidate === normalizedPattern || normalizedCandidate.startsWith(`${normalizedPattern}/`);
}

function pathInAnyPrefix(candidate, prefixes) {
  return prefixes.some((prefix) => patternMatches(prefix, candidate));
}

function listFilesRecursively(startDir, results = []) {
  if (!fs.existsSync(startDir)) return results;

  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    const absolutePath = path.join(startDir, entry.name);
    const rel = relativePath(absolutePath);

    if (entry.isDirectory()) {
      if (
        entry.name === '.git'
        || entry.name === '.omx'
        || entry.name === 'node_modules'
        || entry.name === 'target'
        || entry.name === 'dist'
        || entry.name === 'build'
        || entry.name === 'coverage'
        || entry.name === 'test-results'
      ) {
        continue;
      }
      listFilesRecursively(absolutePath, results);
    } else {
      results.push(rel);
    }
  }

  return results;
}

function listGitFiles() {
  const result = spawnSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 1024 * 1024 * 8,
  });

  if (result.status !== 0) return [];
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

function isRustArtifact(filePath) {
  const basename = path.posix.basename(filePath);
  return filePath.endsWith('.rs')
    || basename === 'Cargo.toml'
    || basename === 'Cargo.lock'
    || basename.startsWith('rust-toolchain')
    || basename === 'build.rs';
}

function listRustArtifacts() {
  const files = new Set([...listGitFiles(), ...listFilesRecursively(repoRoot)]);
  return [...files]
    .filter((file) => fs.existsSync(path.resolve(repoRoot, file)))
    .filter(isRustArtifact)
    .sort();
}

function readIfExists(relativeFilePath) {
  const absolutePath = path.resolve(repoRoot, relativeFilePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
}

function regexes(patterns = []) {
  return patterns.map((pattern) => new RegExp(pattern, 'i'));
}

function extractCargoDependencyNames(cargoToml) {
  const dependencyNames = [];
  let inDependencySection = false;

  for (const rawLine of cargoToml.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      const name = section[1].trim();
      inDependencySection = name === 'dependencies'
        || name === 'build-dependencies'
        || name === 'dev-dependencies'
        || name.startsWith('target.') && name.endsWith('.dependencies');
      continue;
    }

    if (inDependencySection) {
      const dependency = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
      if (dependency) dependencyNames.push(dependency[1]);
    }
  }

  return dependencyNames;
}

function validateException(config, exceptionEntry, index, failures, warnings) {
  const requiredFields = config.requiredExceptionFields ?? [];
  for (const field of requiredFields) {
    const value = exceptionEntry[field];
    const missingArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === '' || missingArray) {
      failures.push(`exceptions[${index}] missing required field: ${field}`);
    }
  }

  if (exceptionEntry.decision !== 'rust-helper') {
    failures.push(`exceptions[${index}] decision must be "rust-helper"`);
  }

  if (!['approved', 'proposed', 'rejected'].includes(exceptionEntry.status)) {
    failures.push(`exceptions[${index}] status must be approved, proposed, or rejected`);
  }

  if (!isSafeRelativePath(exceptionEntry.helperRoot)) {
    failures.push(`exceptions[${index}] helperRoot must be a safe repo-relative path`);
    return;
  }

  const helperRoot = normalizePrefix(exceptionEntry.helperRoot);
  const disallowedFragments = config.disallowedPathFragments ?? [];
  for (const fragment of disallowedFragments) {
    if (helperRoot.toLowerCase().includes(fragment.toLowerCase())) {
      failures.push(`exceptions[${index}] helperRoot cannot include disallowed path fragment: ${fragment}`);
    }
  }

  if (!pathInAnyPrefix(helperRoot, config.allowedHelperRoots ?? [])) {
    failures.push(`exceptions[${index}] helperRoot ${helperRoot} is outside allowed helper roots`);
  }

  const approvedCriteria = new Set(config.approvedCriteria ?? []);
  for (const criterion of exceptionEntry.criteria ?? []) {
    if (!approvedCriteria.has(criterion)) {
      failures.push(`exceptions[${index}] uses unapproved criterion: ${criterion}`);
    }
  }

  if (exceptionEntry.status !== 'approved') {
    warnings.push(`exceptions[${index}] is ${exceptionEntry.status}; only approved entries authorize retained Rust helpers`);
    return;
  }

  const absoluteHelperRoot = path.resolve(repoRoot, helperRoot);
  if (!fs.existsSync(absoluteHelperRoot)) {
    failures.push(`exceptions[${index}] approved helperRoot does not exist: ${helperRoot}`);
    return;
  }

  const helperRustArtifacts = listRustArtifacts().filter((file) => patternMatches(helperRoot, file));
  if (helperRustArtifacts.length === 0) {
    failures.push(`exceptions[${index}] approved helperRoot has no Rust artifacts: ${helperRoot}`);
  }

  const disallowedCratePatterns = regexes(config.disallowedCratePatterns);
  const disallowedContentPatterns = regexes(config.disallowedContentPatterns);

  for (const file of helperRustArtifacts) {
    const source = readIfExists(file);
    if (source === null) continue;

    if (path.posix.basename(file) === 'Cargo.toml') {
      for (const dependencyName of extractCargoDependencyNames(source)) {
        if (disallowedCratePatterns.some((pattern) => pattern.test(dependencyName))) {
          failures.push(`exceptions[${index}] helper Cargo.toml uses disallowed crate ${dependencyName}: ${file}`);
        }
      }
    }

    for (const pattern of disallowedContentPatterns) {
      if (pattern.test(source)) {
        failures.push(`exceptions[${index}] helper contains disallowed runtime content ${pattern}: ${file}`);
      }
    }
  }
}

if (!fs.existsSync(configPath)) {
  console.error(`Rust exception gate config not found: ${path.relative(repoRoot, configPath)}`);
  process.exit(2);
}

const config = readJson(configPath);
const failures = [];
const warnings = [];

if (config.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (config.policyId !== 'rust-exception-gate') failures.push('policyId must be rust-exception-gate');
if (!Array.isArray(config.allowedHelperRoots) || config.allowedHelperRoots.length === 0) {
  failures.push('allowedHelperRoots must be a non-empty array');
}

for (const helperRoot of config.allowedHelperRoots ?? []) {
  if (!isSafeRelativePath(helperRoot.replace(/\/\*\*$/, ''))) {
    failures.push(`allowedHelperRoots entry must be repo-relative: ${helperRoot}`);
  }
  for (const fragment of config.disallowedPathFragments ?? []) {
    if (helperRoot.toLowerCase().includes(fragment.toLowerCase())) {
      failures.push(`allowedHelperRoots entry cannot include ${fragment}: ${helperRoot}`);
    }
  }
}

if (!Array.isArray(config.exceptions)) failures.push('exceptions must be an array');
if (!Array.isArray(config.transitionalLegacyRustBlockers)) {
  failures.push('transitionalLegacyRustBlockers must be an array');
}

for (const [index, exceptionEntry] of (config.exceptions ?? []).entries()) {
  validateException(config, exceptionEntry, index, failures, warnings);
}

const approvedHelperRoots = (config.exceptions ?? [])
  .filter((exceptionEntry) => exceptionEntry.status === 'approved')
  .map((exceptionEntry) => normalizePrefix(exceptionEntry.helperRoot));
const transitionalBlockerPaths = (config.transitionalLegacyRustBlockers ?? []).map((blocker) => normalizePrefix(blocker.path));
const rustArtifacts = listRustArtifacts();
const legacyBlockersFound = [];
const undocumentedRustArtifacts = [];

for (const artifact of rustArtifacts) {
  if (pathInAnyPrefix(artifact, transitionalBlockerPaths)) {
    legacyBlockersFound.push(artifact);
    continue;
  }

  if (pathInAnyPrefix(artifact, approvedHelperRoots)) {
    continue;
  }

  undocumentedRustArtifacts.push(artifact);
}

if (strict && legacyBlockersFound.length > 0) {
  failures.push(
    `strict mode rejects transitional legacy Rust blockers: ${[...new Set(legacyBlockersFound.map((file) => file.split('/').slice(0, 3).join('/')))].join(', ')}`,
  );
}

if (undocumentedRustArtifacts.length > 0) {
  failures.push(`Undocumented Rust artifact(s) outside approved helper roots: ${undocumentedRustArtifacts.join(', ')}`);
}

for (const blocker of config.transitionalLegacyRustBlockers ?? []) {
  if (!isSafeRelativePath(blocker.path)) {
    failures.push(`transitional blocker path must be repo-relative: ${blocker.path}`);
  }
  if (blocker.status !== 'blocked_for_release') {
    failures.push(`transitional blocker ${blocker.path} must have status blocked_for_release`);
  }
}

const report = {
  policyId: config.policyId,
  migrationPhase: config.migrationPhase,
  strict,
  approvedHelperCount: approvedHelperRoots.length,
  rustArtifactCount: rustArtifacts.length,
  legacyBlockerArtifactCount: legacyBlockersFound.length,
  undocumentedRustArtifacts,
  failures,
  warnings,
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else if (failures.length === 0) {
  console.log(
    `Rust exception gate passed: ${approvedHelperRoots.length} approved helper(s), ${legacyBlockersFound.length} transitional legacy artifact(s), ${undocumentedRustArtifacts.length} undocumented artifact(s).`,
  );
  if (warnings.length > 0) {
    for (const warning of warnings) console.warn(`WARN: ${warning}`);
  }
} else {
  console.error('Rust exception gate failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  if (warnings.length > 0) {
    for (const warning of warnings) console.error(`WARN: ${warning}`);
  }
}

process.exit(failures.length === 0 ? 0 : 1);
