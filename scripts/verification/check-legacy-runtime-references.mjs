#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const legacyRuntime = ['ta', 'uri'].join('');
const legacySourceDir = ['src-', legacyRuntime].join('');
const legacyGlobal = ['__', 'TAURI', '__'].join('');
const legacyPatterns = [
  new RegExp(legacyRuntime, 'iu'),
  new RegExp(legacySourceDir, 'iu'),
  new RegExp(legacyGlobal, 'u'),
];

const scanTargets = [
  'package.json',
  'package-lock.json',
  'apps/desktop',
  'packages',
  'verification',
  'scripts',
  'tests',
  'docs/RequirementDocument',
  'docs/DetailedDesign',
  'docs/Architecture',
];

const ignoredSegments = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'target',
  '.DS_Store',
]);

const allowedHistoricalFiles = new Set([
  ['docs', 'DetailedDesign', `${legacyRuntime}-to-electron-migration-map.md`].join(path.sep),
]);

function shouldRead(filePath) {
  const relative = path.relative(repoRoot, filePath);
  if (!relative || allowedHistoricalFiles.has(relative)) return false;
  const parts = relative.split(path.sep);
  if (parts.some((part) => ignoredSegments.has(part))) return false;
  return /\.(?:c?js|mjs|ts|tsx|json|md|ya?ml|toml|rs|html|css)$/u.test(filePath) || path.basename(filePath) === 'package-lock.json';
}

function collectFiles(targetPath) {
  const absolutePath = path.resolve(repoRoot, targetPath);
  let stat;
  try {
    stat = statSync(absolutePath);
  } catch {
    return [];
  }
  if (stat.isFile()) return shouldRead(absolutePath) ? [absolutePath] : [];
  if (!stat.isDirectory()) return [];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredSegments.has(entry.name)) return [];
    return collectFiles(path.relative(repoRoot, path.join(absolutePath, entry.name)));
  });
}

const violations = [];
for (const filePath of scanTargets.flatMap(collectFiles)) {
  const relative = path.relative(repoRoot, filePath);
  const lines = readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (legacyPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${relative}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Legacy desktop runtime references remain in active delivery paths:');
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Legacy desktop runtime reference scan passed.');
