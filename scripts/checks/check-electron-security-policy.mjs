#!/usr/bin/env node
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
const configPath = path.resolve(repoRoot, readOption('--config', 'verification/electron-security-policy.json'));

function isSafeRelativePath(candidate) {
  return typeof candidate === 'string'
    && candidate.length > 0
    && !path.isAbsolute(candidate)
    && !candidate.split('/').includes('..')
    && !candidate.startsWith('.git/');
}

function readFileIfPresent(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
}

function compilePatterns(patterns = []) {
  return patterns.map((pattern) => new RegExp(pattern, 'im'));
}

function checkRequiredPatterns(label, source, patterns, failures) {
  for (const pattern of compilePatterns(patterns)) {
    if (!pattern.test(source)) {
      failures.push(`${label} missing required security pattern: ${pattern.source}`);
    }
  }
}

function checkForbiddenPatterns(label, source, patterns, failures) {
  for (const pattern of compilePatterns(patterns)) {
    if (pattern.test(source)) {
      failures.push(`${label} contains forbidden raw exposure pattern: ${pattern.source}`);
    }
  }
}

if (!fs.existsSync(configPath)) {
  console.error(`Electron security policy config not found: ${path.relative(repoRoot, configPath)}`);
  process.exit(2);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const failures = [];
const pending = [];

if (config.schemaVersion !== 1) failures.push('schemaVersion must be 1');
if (config.policyId !== 'electron-security-policy') failures.push('policyId must be electron-security-policy');
if (!config.requiredFiles || typeof config.requiredFiles !== 'object') failures.push('requiredFiles must be an object');

for (const [label, relativeFilePath] of Object.entries(config.requiredFiles ?? {})) {
  if (!isSafeRelativePath(relativeFilePath)) {
    failures.push(`requiredFiles.${label} must be a safe repo-relative path`);
  }
}

const mainSource = config.requiredFiles?.main ? readFileIfPresent(config.requiredFiles.main) : null;
const preloadSource = config.requiredFiles?.preload ? readFileIfPresent(config.requiredFiles.preload) : null;
const ipcPolicySource = config.requiredFiles?.ipcPolicy ? readFileIfPresent(config.requiredFiles.ipcPolicy) : null;
const ipcContractSource = config.requiredFiles?.ipcContract ? readFileIfPresent(config.requiredFiles.ipcContract) : null;
const securitySource = config.requiredFiles?.security ? readFileIfPresent(config.requiredFiles.security) : null;

if (mainSource === null) pending.push(`missing ${config.requiredFiles?.main}`);
if (preloadSource === null) pending.push(`missing ${config.requiredFiles?.preload}`);
if (config.requiredFiles?.ipcPolicy && ipcPolicySource === null) pending.push(`missing ${config.requiredFiles.ipcPolicy}`);
if (config.requiredFiles?.ipcContract && ipcContractSource === null) pending.push(`missing ${config.requiredFiles.ipcContract}`);
if (config.requiredFiles?.security && securitySource === null) pending.push(`missing ${config.requiredFiles.security}`);

if (mainSource !== null) checkRequiredPatterns('main', mainSource, config.mainRequiredPatterns, failures);
if (preloadSource !== null) {
  checkRequiredPatterns('preload', preloadSource, config.preloadRequiredPatterns, failures);
  checkForbiddenPatterns('preload', preloadSource, config.preloadForbiddenPatterns, failures);
}
if (ipcPolicySource !== null) checkRequiredPatterns('ipc policy', ipcPolicySource, config.ipcPolicyRequiredPatterns, failures);
if (ipcContractSource !== null) checkRequiredPatterns('ipc contract', ipcContractSource, config.ipcContractRequiredPatterns, failures);
if (securitySource !== null) checkRequiredPatterns('security', securitySource, config.securityRequiredPatterns, failures);

if (strict && pending.length > 0) {
  failures.push(`strict mode rejects pending Electron security files: ${pending.join(', ')}`);
}

const report = {
  policyId: config.policyId,
  strict,
  pending,
  requiredControls: config.requiredControls ?? [],
  failures,
};

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else if (failures.length === 0) {
  console.log(`Electron security policy passed with ${pending.length} pending file(s).`);
  for (const item of pending) console.log(`PENDING: ${item}`);
} else {
  console.error('Electron security policy failed:');
  for (const failure of failures) console.error(`- ${failure}`);
}

process.exit(failures.length === 0 ? 0 : 1);
