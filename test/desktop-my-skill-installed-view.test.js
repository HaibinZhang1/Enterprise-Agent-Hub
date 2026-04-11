import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createDesktopServer } from '../apps/desktop/src/server.js';

function listen(server, host = '127.0.0.1') {
  return new Promise((resolvePromise) => {
    server.listen(0, host, () => resolvePromise(server.address()));
  });
}

async function close(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

async function readJson(response) {
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  return response.json();
}

test('desktop installed-skills aggregate groups local bindings and materialization state by skill', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-installed-skills-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const desktop = await createDesktopServer({ port: 0, sqlitePath, apiBaseUrl: 'http://127.0.0.1:65530' });

  try {
    const address = await listen(desktop.server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const projectPath = join(tempDir, 'project-alpha');
    const projectSkillsDirectory = join(projectPath, 'skills');
    await mkdir(projectSkillsDirectory, { recursive: true });

    desktop.store.saveTool({
      toolId: 'codex',
      displayName: 'Codex',
      installPath: '/usr/local/bin/codex',
      healthState: 'ready',
      skillsDirectory: join(tempDir, 'codex', 'skills'),
    });
    desktop.store.saveProject({
      projectId: 'project-alpha',
      displayName: 'Project Alpha',
      projectPath,
      healthState: 'ready',
      skillsDirectory: projectSkillsDirectory,
    });
    desktop.store.saveSkillTargetBinding({
      targetType: 'tool',
      targetId: 'codex',
      skillId: 'skill-shared',
      packageId: 'pkg-shared-1',
      version: '1.0.0',
      enabled: true,
    });
    desktop.store.saveSkillTargetBinding({
      targetType: 'project',
      targetId: 'project-alpha',
      skillId: 'skill-shared',
      packageId: 'pkg-shared-1',
      version: '1.0.0',
      enabled: false,
    });
    desktop.store.saveSkillMaterializationStatus({
      targetType: 'tool',
      targetId: 'codex',
      skillId: 'skill-shared',
      packageId: 'pkg-shared-1',
      version: '1.0.0',
      mode: 'symlink',
      status: 'pending',
      reportStatus: 'available',
      targetPath: join(tempDir, 'codex', 'skills', 'skill-shared'),
      sourcePath: null,
      lastError: null,
    });

    const installed = await fetch(`${baseUrl}/api/skills/installed`).then(readJson);
    assert.equal(installed.ok, true);
    assert.equal(installed.skills.length, 1);
    assert.deepEqual(installed.skills[0], {
      skillId: 'skill-shared',
      versions: [{ version: '1.0.0', packageId: 'pkg-shared-1' }],
      enabledTools: [{ toolId: 'codex', displayName: 'Codex' }],
      enabledProjects: [],
      materialization: [{ targetType: 'tool', targetId: 'codex', status: 'pending', mode: 'symlink', lastError: null }],
      effectiveState: 'mixed',
      restrictionNote: null,
      updatedAt: installed.skills[0].updatedAt,
    });
    assert.equal(typeof installed.skills[0].updatedAt, 'string');
  } finally {
    await close(desktop.server);
  }
});
