import assert from 'node:assert/strict';
import test from 'node:test';
import { lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSkillMaterializer } from '../apps/desktop/src/runtime/skill-materializer.js';

async function createPackageSource(root, name, content = 'skill payload') {
  const sourceDirectory = join(root, name);
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(sourceDirectory, 'SKILL.md'), content);
  return sourceDirectory;
}

test('desktop skill materializer defaults to symlink materialization', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-link-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'linked content');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');

  const result = await createSkillMaterializer().materialize({
    skillId: 'skill-linked',
    sourceDirectory,
    skillsDirectory,
  });

  const targetStats = await lstat(result.targetPath);
  assert.equal(result.mode, 'symlink');
  assert.equal(result.fallbackUsed, false);
  assert.equal(targetStats.isSymbolicLink(), true);
  assert.equal(await readFile(join(result.targetPath, 'SKILL.md'), 'utf8'), 'linked content');
});

test('desktop skill materializer falls back to copy when symlink creation fails', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-copy-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'copied content');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');
  const symlinkError = Object.assign(new Error('symlink not permitted in target directory'), { code: 'EPERM' });

  const result = await createSkillMaterializer({
    filesystem: {
      symlink: async () => {
        throw symlinkError;
      },
    },
  }).materialize({
    skillId: 'skill-copied',
    sourceDirectory,
    skillsDirectory,
  });

  const targetStats = await lstat(result.targetPath);
  assert.equal(result.mode, 'copy');
  assert.equal(result.fallbackUsed, true);
  assert.match(result.fallbackReason ?? '', /EPERM/);
  assert.equal(targetStats.isDirectory(), true);
  assert.equal(targetStats.isSymbolicLink(), false);
  assert.equal(await readFile(join(result.targetPath, 'SKILL.md'), 'utf8'), 'copied content');
});

test('desktop skill materializer removes only the requested skill materialization', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-remove-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'remove content');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');
  const materializer = createSkillMaterializer();

  const removedSkill = await materializer.materialize({
    skillId: 'skill-remove-me',
    sourceDirectory,
    skillsDirectory,
    preferredMode: 'copy',
  });
  const keptSkill = await materializer.materialize({
    skillId: 'skill-keep-me',
    sourceDirectory,
    skillsDirectory,
    preferredMode: 'copy',
  });

  const removal = await materializer.removeMaterialization({
    skillId: 'skill-remove-me',
    skillsDirectory,
  });

  await assert.rejects(lstat(removedSkill.targetPath), { code: 'ENOENT' });
  assert.equal((await lstat(keptSkill.targetPath)).isDirectory(), true);
  assert.equal(removal.status, 'removed');
});

test('desktop skill materializer replays copy materialization idempotently', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-replay-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'v1 content');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');
  const materializer = createSkillMaterializer();

  await materializer.materialize({
    skillId: 'skill-replayed',
    sourceDirectory,
    skillsDirectory,
    preferredMode: 'copy',
  });
  await writeFile(join(sourceDirectory, 'SKILL.md'), 'v2 content');
  const replayed = await materializer.materialize({
    skillId: 'skill-replayed',
    sourceDirectory,
    skillsDirectory,
    preferredMode: 'copy',
  });

  assert.equal(replayed.mode, 'copy');
  assert.equal(await readFile(join(replayed.targetPath, 'SKILL.md'), 'utf8'), 'v2 content');
});

test('desktop skill materializer reports source unavailability before touching destination', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-offline-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'existing content');
  const missingSourceDirectory = join(fixtureRoot, 'missing-source');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');
  const materializer = createSkillMaterializer();

  const existing = await materializer.materialize({
    skillId: 'skill-offline',
    sourceDirectory,
    skillsDirectory,
    preferredMode: 'copy',
  });
  const blocked = await materializer.materialize({
    skillId: 'skill-offline',
    sourceDirectory: missingSourceDirectory,
    skillsDirectory,
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'offline_blocked');
  assert.match(blocked.failureReason, /ENOENT/);
  assert.equal(await readFile(join(existing.targetPath, 'SKILL.md'), 'utf8'), 'existing content');
});

test('desktop skill materializer reports access denial as an explicit degraded status', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'skill-materializer-denied-'));
  const sourceDirectory = await createPackageSource(fixtureRoot, 'source-skill', 'denied content');
  const skillsDirectory = join(fixtureRoot, 'target', 'skills');
  const accessError = Object.assign(new Error('package report is not readable'), { code: 'EACCES' });

  const blocked = await createSkillMaterializer({
    filesystem: {
      stat: async () => {
        throw accessError;
      },
    },
  }).materialize({
    skillId: 'skill-denied',
    sourceDirectory,
    skillsDirectory,
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 'access_denied');
  assert.match(blocked.failureReason, /EACCES/);
});
