import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function loadReconcilerFactory() {
  const module = await import('../apps/desktop/src/runtime/skill-materialization-reconciler.js');
  assert.equal(
    typeof module.createSkillMaterializationReconciler,
    'function',
    'Expected createSkillMaterializationReconciler() export.',
  );
  return module.createSkillMaterializationReconciler;
}

async function writePackage(root, marker) {
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'SKILL.md'), `name: skill-shared\nversion: ${marker}\n`);
  await writeFile(join(root, 'README.md'), `# ${marker}\n`);
}

test('skill materialization reconciler creates a symlink first and is idempotent', async () => {
  const createSkillMaterializationReconciler = await loadReconcilerFactory();
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-reconcile-link-'));
  const packageRoot = join(dir, 'packages', 'pkg-shared-v1');
  const skillsDirectory = join(dir, 'target', 'skills');
  await writePackage(packageRoot, '1.0.0');

  const reconciler = createSkillMaterializationReconciler();
  const first = await reconciler.reconcileSkillTarget({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-v1',
    version: '1.0.0',
    packageRoot,
    skillsDirectory,
    enabled: true,
  });
  const second = await reconciler.reconcileSkillTarget({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-v1',
    version: '1.0.0',
    packageRoot,
    skillsDirectory,
    enabled: true,
  });

  assert.equal(first.status, 'materialized');
  assert.equal(first.mode, 'symlink');
  assert.equal(second.status, 'materialized');
  assert.equal(second.operation, 'noop');
  assert.equal((await lstat(join(skillsDirectory, 'skill-shared'))).isSymbolicLink(), true);
  assert.equal(await readFile(join(skillsDirectory, 'skill-shared', 'README.md'), 'utf8'), '# 1.0.0\n');
});

test('skill materialization reconciler falls back to copy when symlink creation fails', async () => {
  const createSkillMaterializationReconciler = await loadReconcilerFactory();
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-reconcile-copy-'));
  const packageRoot = join(dir, 'packages', 'pkg-shared-v2');
  const skillsDirectory = join(dir, 'target', 'skills');
  await writePackage(packageRoot, '2.0.0');

  const attemptedLinks = [];
  const reconciler = createSkillMaterializationReconciler({
    async createSymlink(sourcePath, targetPath) {
      attemptedLinks.push({ sourcePath, targetPath });
      throw Object.assign(new Error('simulated symlink failure'), { code: 'EPERM' });
    },
  });

  const result = await reconciler.reconcileSkillTarget({
    targetType: 'tool',
    targetId: 'codex',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-v2',
    version: '2.0.0',
    packageRoot,
    skillsDirectory,
    enabled: true,
  });

  assert.equal(attemptedLinks.length, 1);
  assert.equal(result.status, 'materialized');
  assert.equal(result.mode, 'copy');
  assert.match(result.fallbackReason, /symlink failure|EPERM|simulated/i);
  assert.equal((await lstat(join(skillsDirectory, 'skill-shared'))).isDirectory(), true);
  assert.equal(await readFile(join(skillsDirectory, 'skill-shared', 'SKILL.md'), 'utf8'), 'name: skill-shared\nversion: 2.0.0\n');
});

test('skill materialization reconciler removes only the targeted skill on disable', async () => {
  const createSkillMaterializationReconciler = await loadReconcilerFactory();
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-reconcile-disable-'));
  const packageRoot = join(dir, 'packages', 'pkg-target');
  const otherPackageRoot = join(dir, 'packages', 'pkg-other');
  const skillsDirectory = join(dir, 'target', 'skills');
  await writePackage(packageRoot, 'target');
  await writePackage(otherPackageRoot, 'other');
  await mkdir(skillsDirectory, { recursive: true });
  await symlink(packageRoot, join(skillsDirectory, 'skill-target'), 'dir');
  await symlink(otherPackageRoot, join(skillsDirectory, 'skill-other'), 'dir');

  const reconciler = createSkillMaterializationReconciler();
  const result = await reconciler.reconcileSkillTarget({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-target',
    packageId: 'pkg-target',
    version: '1.0.0',
    packageRoot,
    skillsDirectory,
    enabled: false,
  });

  assert.equal(result.status, 'removed');
  await assert.rejects(lstat(join(skillsDirectory, 'skill-target')), { code: 'ENOENT' });
  assert.equal((await lstat(join(skillsDirectory, 'skill-other'))).isSymbolicLink(), true);
});

test('skill materialization reconciler skips filesystem writes for disabled tool targets', async () => {
  const createSkillMaterializationReconciler = await loadReconcilerFactory();
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-reconcile-disabled-tool-'));
  const packageRoot = join(dir, 'packages', 'pkg-target');
  const skillsDirectory = join(dir, 'tool', 'skills');
  await writePackage(packageRoot, 'target');

  const reconciler = createSkillMaterializationReconciler();
  const result = await reconciler.reconcileSkillTarget({
    targetType: 'tool',
    targetId: 'codex',
    skillId: 'skill-disabled-tool',
    packageId: 'pkg-target',
    version: '1.0.0',
    packageRoot,
    skillsDirectory,
    enabled: true,
    targetMaterializationEnabled: false,
  });

  assert.equal(result.status, 'removed');
  assert.equal(result.operation, 'skip_disabled_target');
  await assert.rejects(lstat(join(skillsDirectory, 'skill-disabled-tool')), { code: 'ENOENT' });
});

test('skill materialization reconciler records unavailable packages without substituting another version', async () => {
  const createSkillMaterializationReconciler = await loadReconcilerFactory();
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-reconcile-unavailable-'));
  const skillsDirectory = join(dir, 'target', 'skills');
  await mkdir(skillsDirectory, { recursive: true });
  await writePackage(join(dir, 'packages', 'pkg-old'), 'old');
  await symlink(join(dir, 'packages', 'pkg-old'), join(skillsDirectory, 'skill-shared'), 'dir');

  const reconciler = createSkillMaterializationReconciler();
  const result = await reconciler.reconcileSkillTarget({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-shared',
    packageId: 'pkg-new',
    version: '2.0.0',
    packageRoot: join(dir, 'packages', 'pkg-new-missing'),
    skillsDirectory,
    enabled: true,
  });

  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /offline|unavailable|access/i);
  assert.equal(await readFile(join(skillsDirectory, 'skill-shared', 'SKILL.md'), 'utf8'), 'name: skill-shared\nversion: old\n');

  await rm(dir, { recursive: true, force: true });
});
