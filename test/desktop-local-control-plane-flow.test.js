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

test('desktop local-control-plane routes support settings, scan, multi-project switching, and preview-first repair flow', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-local-control-plane-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const projectA = join(tempDir, 'project-a');
  const projectB = join(tempDir, 'project-b');
  const projectC = join(tempDir, 'project-c');

  await mkdir(projectA, { recursive: true });
  await mkdir(projectB, { recursive: true });
  await mkdir(projectC, { recursive: true });

  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const desktopAddress = await listen(desktop.server);
    assert.equal(typeof desktopAddress, 'object');
    const baseUrl = `http://127.0.0.1:${desktopAddress.port}`;

    const initialSettings = await fetch(`${baseUrl}/api/settings`).then(readJson);
    assert.equal(initialSettings.ok, true);
    assert.equal(initialSettings.settings.storage.mode, 'managed_sqlite');

    const updatedSettings = await fetch(`${baseUrl}/api/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiBaseUrl: 'http://127.0.0.1:8788',
        scanCommands: ['node', 'tool-missing'],
        defaultProjectBehavior: 'last-active',
        appearance: 'dark',
        updateChannel: 'preview',
      }),
    }).then(readJson);

    assert.equal(updatedSettings.ok, true);
    assert.deepEqual(updatedSettings.settings.execution.scanCommands, ['node', 'tool-missing']);
    assert.equal(updatedSettings.settings.execution.apiBaseUrl, 'http://127.0.0.1:8788');
    assert.equal(updatedSettings.settings.desktop.appearance, 'dark');
    assert.equal(updatedSettings.settings.desktop.updateChannel, 'preview');

    const scannedTools = await fetch(`${baseUrl}/api/tools/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);

    assert.equal(scannedTools.ok, true);
    assert.equal(scannedTools.tools.some((tool) => tool.toolId === 'tool-missing' && tool.healthState === 'missing'), true);
    assert.equal(scannedTools.tools.some((tool) => tool.toolId === 'node'), true);

    const toolRepairPreview = await fetch(`${baseUrl}/api/tools/tool-missing/repair-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);

    assert.equal(toolRepairPreview.ok, true);
    assert.equal(typeof toolRepairPreview.preview.previewId, 'string');
    assert.equal(toolRepairPreview.preview.targetKey, 'tool:tool-missing');
    assert.match(toolRepairPreview.preview.consequenceSummary, /refresh tool-missing from Not found to Not found/i);

    const repairedTool = await fetch(`${baseUrl}/api/tools/tool-missing/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: toolRepairPreview.preview.previewId }),
    }).then(readJson);

    assert.equal(repairedTool.ok, true);
    assert.equal(repairedTool.tool.toolId, 'tool-missing');

    const firstProject = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Project Alpha',
        projectPath: projectA,
      }),
    }).then(readJson);
    const secondProject = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Project Beta',
        projectPath: projectB,
      }),
    }).then(readJson);

    assert.equal(firstProject.ok, true);
    assert.equal(secondProject.ok, true);

    const listedProjects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    assert.equal(listedProjects.ok, true);
    assert.equal(listedProjects.projects.length, 2);
    assert.equal(listedProjects.currentProjectId, firstProject.project.projectId);

    const switchPreview = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(secondProject.project.projectId)}/switch-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);

    assert.equal(switchPreview.ok, true);
    assert.equal(typeof switchPreview.preview.previewId, 'string');
    assert.equal(switchPreview.preview.targetKey, `project:${secondProject.project.projectId}`);
    assert.match(switchPreview.preview.consequenceSummary, /switch the active project/i);

    const switched = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(secondProject.project.projectId)}/switch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: switchPreview.preview.previewId }),
    }).then(readJson);

    assert.equal(switched.ok, true);
    assert.equal(switched.project.projectId, secondProject.project.projectId);

    const switchedProjects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    assert.equal(switchedProjects.currentProjectId, secondProject.project.projectId);
    assert.equal(switchedProjects.projects.some((project) => project.projectId === secondProject.project.projectId && project.isCurrent), true);

    const cancelledRepairPreview = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(secondProject.project.projectId)}/repair-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectPath: join(tempDir, 'missing-project') }),
    }).then(readJson);

    assert.equal(cancelledRepairPreview.ok, true);
    await fetch(`${baseUrl}/api/previews/${encodeURIComponent(cancelledRepairPreview.preview.previewId)}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);

    const afterCancelProjects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    assert.equal(
      afterCancelProjects.projects.find((project) => project.projectId === secondProject.project.projectId)?.projectPath,
      projectB,
    );

    const repairPreview = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(secondProject.project.projectId)}/repair-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectPath: projectC }),
    }).then(readJson);

    assert.equal(repairPreview.ok, true);
    assert.equal(repairPreview.preview.targetKey, `project:${secondProject.project.projectId}`);
    assert.match(repairPreview.preview.consequenceSummary, /update .* and refresh local validation/i);

    const repaired = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(secondProject.project.projectId)}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: repairPreview.preview.previewId }),
    }).then(readJson);

    assert.equal(repaired.ok, true);
    assert.equal(repaired.project.projectPath, projectC);

    const removed = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(firstProject.project.projectId)}`, {
      method: 'DELETE',
    }).then(readJson);

    assert.equal(removed.ok, true);

    const remainingProjects = await fetch(`${baseUrl}/api/projects`).then(readJson);
    assert.equal(remainingProjects.projects.length, 1);
    assert.equal(remainingProjects.projects[0].projectPath, projectC);

    const health = await fetch(`${baseUrl}/health`).then(readJson);
    assert.equal(health.apiBaseUrl, 'http://127.0.0.1:8788');
    assert.equal(health.sqlitePath, sqlitePath);

    const resetSettings = await fetch(`${baseUrl}/api/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scanCommands: [] }),
    }).then(readJson);

    assert.equal(resetSettings.ok, true);
    assert.equal(resetSettings.settings.execution.scanCommands.includes('node'), true);

    const fallbackScan = await fetch(`${baseUrl}/api/tools/scan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);

    assert.equal(fallbackScan.ok, true);
    assert.equal(fallbackScan.tools.length > 0, true);
  } finally {
    await close(desktop.server);
  }
});
