import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createDesktopServer, validateBindingMaterializationPreview } from '../apps/desktop/src/server.js';

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

function assertSkillPreviewContract(preview) {
  assert.deepEqual(validateBindingMaterializationPreview(preview), {
    ok: true,
    reason: 'valid_preview',
    missingFields: [],
  });
}

test('desktop skill-management read models keep disabled tools visible and expose project + tool bindings', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-skill-management-read-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const address = await listen(desktop.server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const toolSkillsDirectory = join(tempDir, 'codex', 'skills');
    const projectPath = join(tempDir, 'project-alpha');
    const projectSkillsDirectory = join(projectPath, 'skills');
    await mkdir(projectSkillsDirectory, { recursive: true });

    assert.equal(typeof desktop.store.saveSkillTargetBinding, 'function', 'Desktop store must expose skill binding APIs.');
    desktop.store.saveTool({
      toolId: 'codex',
      displayName: 'Codex',
      installPath: '/usr/local/bin/codex',
      healthState: 'ready',
      skillsDirectory: toolSkillsDirectory,
      materializationEnabled: false,
    });
    desktop.store.saveProject({
      projectId: 'project-alpha',
      displayName: 'Project Alpha',
      projectPath,
      healthState: 'ready',
      skillsDirectory: projectSkillsDirectory,
    });
    desktop.store.saveSkillTargetBinding({
      targetType: 'project',
      targetId: 'project-alpha',
      skillId: 'skill-shared',
      packageId: 'pkg-shared-1',
      version: '1.0.0',
      enabled: true,
    });
    desktop.store.saveSkillTargetBinding({
      targetType: 'tool',
      targetId: 'codex',
      skillId: 'skill-tool-only',
      packageId: 'pkg-tool-1',
      version: '2.0.0',
      enabled: true,
    });

    const tools = await fetch(`${baseUrl}/api/tools`).then(readJson);
    assert.equal(tools.ok, true);
    const disabledTool = tools.tools.find((tool) => tool.toolId === 'codex');
    assert.ok(disabledTool, 'Disabled tools must remain visible in the tools read model.');
    assert.equal(disabledTool.skillsDirectory, toolSkillsDirectory);
    assert.equal(disabledTool.materializationEnabled, false);
    assert.equal(disabledTool.actions.canMaterialize, false);
    assert.equal(disabledTool.actions.canRescan, true);
    assert.match(disabledTool.skillsDirectorySummary, /codex\/skills/);
    assert.deepEqual(disabledTool.skillBindings, [
      {
        targetType: 'tool',
        targetId: 'codex',
        skillId: 'skill-tool-only',
        packageId: 'pkg-tool-1',
        version: '2.0.0',
        enabled: true,
        materializationStatus: null,
        effectiveSummary: 'Enabled · 2.0.0',
      },
    ]);

    const projects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    assert.equal(projects.ok, true);
    const project = projects.projects.find((entry) => entry.projectId === 'project-alpha');
    assert.ok(project);
    assert.equal(project.skillsDirectory, projectSkillsDirectory);
    assert.deepEqual(project.skillBindings, [
      {
        targetType: 'project',
        targetId: 'project-alpha',
        skillId: 'skill-shared',
        packageId: 'pkg-shared-1',
        version: '1.0.0',
        enabled: true,
        materializationStatus: null,
        effectiveSummary: 'Enabled · 1.0.0',
      },
    ]);
    assert.match(project.effectiveSummary, /1 skill binding/i);
  } finally {
    await close(desktop.server);
  }
});

test('desktop skill-management mutations are preview-first and cancel leaves state unchanged', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-skill-management-preview-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const address = await listen(desktop.server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const projectPath = join(tempDir, 'project-alpha');
    await mkdir(projectPath, { recursive: true });

    const project = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: 'project-alpha', displayName: 'Project Alpha', projectPath }),
    }).then(readJson);
    assert.equal(project.ok, true);

    const rejectedBind = await fetch(`${baseUrl}/api/projects/project-alpha/skills/skill-shared/bind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ packageId: 'pkg-shared-1', version: '1.0.0', enabled: true }),
    }).then(readJson);
    assert.equal(rejectedBind.ok, false);
    assert.equal(rejectedBind.reason, 'invalid_preview');

    const previewPayload = {
      packageId: 'pkg-shared-1',
      version: '1.0.0',
      skillsDirectory: join(projectPath, 'skills'),
      enabled: true,
    };
    const preview = await fetch(`${baseUrl}/api/projects/project-alpha/skills/skill-shared/bind-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(previewPayload),
    }).then(readJson);
    assert.equal(preview.ok, true);
    assertSkillPreviewContract(preview.preview);
    assert.equal(preview.preview.action, 'bind-skill-target');
    assert.equal(preview.preview.targetType, 'project');
    assert.equal(preview.preview.targetId, 'project-alpha');
    assert.equal(preview.preview.targetKey, 'project:project-alpha');
    assert.equal(preview.preview.skillId, 'skill-shared');
    assert.equal(preview.preview.incomingSummary.version, '1.0.0');
    assert.equal(preview.preview.effectiveVersion, '1.0.0');
    assert.equal(preview.preview.fallbackMode, 'copy');
    assert.equal(preview.preview.plannedFilesystemOperations.length, 1);

    const cancelled = await fetch(`${baseUrl}/api/previews/${encodeURIComponent(preview.preview.previewId)}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);
    assert.equal(cancelled.ok, true);
    assert.equal(desktop.store.listSkillTargetBindings({ targetType: 'project', targetId: 'project-alpha' }).length, 0);

    const secondPreview = await fetch(`${baseUrl}/api/projects/project-alpha/skills/skill-shared/bind-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(previewPayload),
    }).then(readJson);
    const confirmed = await fetch(`${baseUrl}/api/projects/project-alpha/skills/skill-shared/bind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: secondPreview.preview.previewId }),
    }).then(readJson);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.binding.skillId, 'skill-shared');
    assert.equal(confirmed.binding.version, '1.0.0');
    const refreshedProjects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    const refreshedProject = refreshedProjects.projects.find((entry) => entry.projectId === 'project-alpha');
    assert.equal(refreshedProject.skillBindings[0].materializationStatus?.status, 'pending');

    desktop.store.saveTool({
      toolId: 'codex',
      displayName: 'Codex',
      installPath: '/usr/local/bin/codex',
      healthState: 'ready',
      skillsDirectory: join(tempDir, 'codex', 'skills'),
      materializationEnabled: true,
    });

    const toolPreviewPayload = {
      packageId: 'pkg-tool-1',
      version: '2.0.0',
      skillsDirectory: join(tempDir, 'codex', 'skills'),
      enabled: true,
    };
    const toolPreview = await fetch(`${baseUrl}/api/tools/codex/skills/skill-tool-only/bind-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(toolPreviewPayload),
    }).then(readJson);
    assert.equal(toolPreview.ok, true);
    assertSkillPreviewContract(toolPreview.preview);
    assert.equal(toolPreview.preview.targetType, 'tool');
    assert.equal(toolPreview.preview.targetId, 'codex');
    assert.equal(toolPreview.preview.targetKey, 'tool:codex');
    assert.equal(toolPreview.preview.effectiveVersion, '2.0.0');

    const confirmedToolBinding = await fetch(`${baseUrl}/api/tools/codex/skills/skill-tool-only/bind`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: toolPreview.preview.previewId }),
    }).then(readJson);
    assert.equal(confirmedToolBinding.ok, true);
    assert.equal(confirmedToolBinding.binding.targetType, 'tool');
    assert.equal(confirmedToolBinding.binding.skillId, 'skill-tool-only');
    const refreshedTools = await fetch(`${baseUrl}/api/tools`).then(readJson);
    const refreshedTool = refreshedTools.tools.find((entry) => entry.toolId === 'codex');
    assert.equal(refreshedTool.skillBindings[0].materializationStatus?.status, 'pending');
  } finally {
    await close(desktop.server);
  }
});
