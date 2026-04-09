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
