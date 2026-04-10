import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

const dependencySections = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

const approvedPackageDependencyNames = {
  'package.json': {
    devDependencies: ['@types/node', 'typescript'],
  },
  'apps/api/package.json': {
    dependencies: ['@enterprise-agent-hub/contracts'],
  },
  'apps/desktop/package.json': {
    dependencies: ['@enterprise-agent-hub/contracts'],
  },
  'packages/contracts/package.json': {},
  'packages/migrations/package.json': {},
};

const approvedCargoDependencyNames = {
  dependencies: ['tauri'],
  'build-dependencies': ['tauri-build'],
};

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'));
}

function sortedDependencyNames(manifest, section) {
  return Object.keys(manifest[section] ?? {}).sort();
}

function parseCargoDependencyNames(toml) {
  const dependencyNamesBySection = {};
  let currentSection = null;

  for (const rawLine of toml.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = Object.hasOwn(approvedCargoDependencyNames, sectionMatch[1])
        ? sectionMatch[1]
        : null;
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const dependencyMatch = line.match(/^([A-Za-z0-9_-]+)\s*=/);
    if (dependencyMatch) {
      dependencyNamesBySection[currentSection] ??= [];
      dependencyNamesBySection[currentSection].push(dependencyMatch[1]);
    }
  }

  return Object.fromEntries(
    Object.entries(dependencyNamesBySection).map(([section, names]) => [
      section,
      names.sort(),
    ]),
  );
}

test('desktop skill-management work stays within the approved package dependency surface', async () => {
  for (const [path, approvedSections] of Object.entries(approvedPackageDependencyNames)) {
    const manifest = await readJson(path);

    for (const section of dependencySections) {
      assert.deepEqual(
        sortedDependencyNames(manifest, section),
        approvedSections[section] ?? [],
        `${path} ${section} must not gain new direct dependencies`,
      );
    }
  }
});

test('desktop shell keeps the approved direct Rust dependency surface', async () => {
  const cargoToml = await readFile(resolve(repoRoot, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8');
  const actual = parseCargoDependencyNames(cargoToml);

  assert.deepEqual(actual, approvedCargoDependencyNames);
});
