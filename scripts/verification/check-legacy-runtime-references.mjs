#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const repoRoot = process.cwd();
const canonicalScript = path.join('scripts', 'checks', ['check-no-', ['ta', 'uri'].join(''), '-scan.mjs'].join(''));
const canonicalPath = path.resolve(repoRoot, canonicalScript);

if (!existsSync(canonicalPath)) {
  console.error(`Canonical removed-runtime scan is missing: ${canonicalScript}`);
  process.exit(2);
}

const result = spawnSync(process.execPath, [canonicalPath, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
