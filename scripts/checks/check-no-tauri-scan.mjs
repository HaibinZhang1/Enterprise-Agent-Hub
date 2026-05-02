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
const configPath = path.resolve(repoRoot, readOption('--config', 'verification/no-tauri-scan-allowlist.json'));

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function normalize(candidate) {
  return candidate.replace(/^\.\//, '').replace(/\/+$/, '');
}

function relativePath(absolutePath) {
  return normalize(toPosix(path.relative(repoRoot, absolutePath)));
}

function isSafeRelativePath(candidate) {
  return typeof candidate === 'string'
    && candidate.length > 0
    && !path.isAbsolute(candidate)
    && !candidate.split('/').includes('..')
    && !candidate.startsWith('.git/');
}

function globToRegExp(glob) {
  const normalized = normalize(glob);
  let regex = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      regex += '.*';
      index += 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else {
      regex += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${regex}$`);
}

function matchesAny(filePath, globs = []) {
  return globs.some((glob) => globToRegExp(glob).test(normalize(filePath)));
}

function listFilesRecursively(startDir, results = []) {
  if (!fs.existsSync(startDir)) return results;

  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    const absolutePath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === '.git'
        || entry.name === '.omx'
        || entry.name === 'node_modules'
        || entry.name === 'target'
        || entry.name === 'dist'
        || entry.name === 'build'
        || entry.name === 'release'
        || entry.name === 'coverage'
        || entry.name === 'test-results'
      ) {
        continue;
      }
      listFilesRecursively(absolutePath, results);
    } else {
      results.push(relativePath(absolutePath));
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
  return result.stdout.split('\n').map((line) => normalize(line.trim())).filter(Boolean);
}

function readText(filePath) {
  return fs.readFileSync(path.resolve(repoRoot, filePath), 'utf8');
}

function findHits(files, terms) {
  const termPattern = new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
  const hits = [];

  for (const filePath of files) {
    let source;
    try {
      source = readText(filePath);
    } catch {
      continue;
    }

    const lines = source.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      if (termPattern.test(line)) {
        hits.push({ file: filePath, line: lineIndex + 1, text: line.trim().slice(0, 240) });
      }
    });
  }

  return hits;
}

if (!fs.existsSync(configPath)) {
  console.error(`No-Tauri scan config not found: ${path.relative(repoRoot, configPath)}`);
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const failures = [];

if (config.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (config.policyId !== 'no-tauri-scan') failures.push('policyId must be no-tauri-scan');
if (!Array.isArray(config.terms) || config.terms.length === 0) failures.push('terms must be a non-empty array');

for (const [field, globs] of Object.entries({
  includeGlobs: config.includeGlobs,
  allowedHistoricalGlobs: config.allowedHistoricalGlobs,
  transitionalBlockerGlobs: config.transitionalBlockerGlobs,
})) {
  if (!Array.isArray(globs)) {
    failures.push(`${field} must be an array`);
    continue;
  }
  for (const glob of globs) {
    const safetyCandidate = normalize(glob).replace(/\/\*\*$/, '').replace(/\*+/g, 'x');
    if (!isSafeRelativePath(safetyCandidate)) {
      failures.push(`${field} entry must be repo-relative: ${glob}`);
    }
  }
}

const files = [...new Set([...listGitFiles(), ...listFilesRecursively(repoRoot)])]
  .filter((filePath) => matchesAny(filePath, config.includeGlobs ?? []))
  .sort();
const hits = findHits(files, config.terms ?? []);
const allowedHistoricalHits = [];
const transitionalBlockers = [];
const unclassifiedHits = [];

for (const hit of hits) {
  if (matchesAny(hit.file, config.allowedHistoricalGlobs ?? [])) {
    allowedHistoricalHits.push(hit);
  } else if (matchesAny(hit.file, config.transitionalBlockerGlobs ?? [])) {
    transitionalBlockers.push(hit);
  } else {
    unclassifiedHits.push(hit);
  }
}

if (unclassifiedHits.length > 0) {
  failures.push(`Unclassified Tauri-era reference(s): ${unclassifiedHits.map((hit) => `${hit.file}:${hit.line}`).join(', ')}`);
}

if (strict && transitionalBlockers.length > 0) {
  const uniqueFiles = [...new Set(transitionalBlockers.map((hit) => hit.file))];
  failures.push(`Strict no-Tauri scan rejects transitional blocker file(s): ${uniqueFiles.join(', ')}`);
}

const report = {
  policyId: config.policyId,
  strict,
  scannedFileCount: files.length,
  hitCount: hits.length,
  allowedHistoricalHitCount: allowedHistoricalHits.length,
  transitionalBlockerHitCount: transitionalBlockers.length,
  unclassifiedHitCount: unclassifiedHits.length,
  transitionalBlockerFiles: [...new Set(transitionalBlockers.map((hit) => hit.file))],
  unclassifiedHits,
  failures,
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else if (failures.length === 0) {
  console.log(
    `No-Tauri scan passed: ${hits.length} hit(s), ${allowedHistoricalHits.length} allowed historical hit(s), ${transitionalBlockers.length} transitional blocker hit(s), ${unclassifiedHits.length} unclassified hit(s).`,
  );
  if (transitionalBlockers.length > 0) {
    console.log('Strict release gate still blocked by transitional files:');
    for (const file of report.transitionalBlockerFiles) console.log(`- ${file}`);
  }
} else {
  console.error('No-Tauri scan failed:');
  for (const failure of failures) console.error(`- ${failure}`);
}

process.exit(failures.length === 0 ? 0 : 1);
