import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  BINDING_MATERIALIZATION_MUTATION_ACTIONS,
  BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS,
  createDesktopServer,
  validateBindingMaterializationPreview,
  validatePreviewConfirmation,
} from '../apps/desktop/src/server.js';

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

function completeBindingPreview(overrides = {}) {
  return {
    previewId: 'preview-bind-1',
    action: 'bind-skill-target',
    targetType: 'project',
    targetId: 'project-alpha',
    targetKey: 'project:project-alpha',
    skillId: 'skill-alpha',
    currentSummary: { enabled: false, version: null },
    incomingSummary: { enabled: true, version: '1.2.3' },
    currentSkillsDirectory: '/workspace/project-alpha/skills',
    incomingSkillsDirectory: '/workspace/project-alpha/skills',
    effectiveVersion: '1.2.3',
    plannedFilesystemOperations: [{ operation: 'link', path: '/workspace/project-alpha/skills/skill-alpha' }],
    fallbackMode: 'copy',
    consequenceSummary: 'Desktop will materialize skill-alpha into the project skills directory.',
    issues: [],
    ...overrides,
  };
}

test('binding/materialization mutations have an explicit preview payload contract', () => {
  assert.equal(BINDING_MATERIALIZATION_MUTATION_ACTIONS.includes('bind-skill-target'), true);
  assert.equal(BINDING_MATERIALIZATION_MUTATION_ACTIONS.includes('reconcile-target-materialization'), true);
  assert.equal(BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS.includes('plannedFilesystemOperations'), true);
  assert.equal(BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS.includes('incomingSkillsDirectory'), true);

  assert.deepEqual(validateBindingMaterializationPreview(null), {
    ok: false,
    reason: 'missing_preview',
    missingFields: [...BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS],
  });

  const incomplete = validateBindingMaterializationPreview({
    previewId: 'preview-bind-1',
    action: 'bind-skill-target',
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-alpha',
  });
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.reason, 'incomplete_preview');
  assert.deepEqual(
    incomplete.missingFields,
    [
      'currentSummary',
      'incomingSummary',
      'currentSkillsDirectory',
      'incomingSkillsDirectory',
      'effectiveVersion',
      'plannedFilesystemOperations',
      'fallbackMode',
      'consequenceSummary',
      'issues',
    ],
  );

  assert.deepEqual(validateBindingMaterializationPreview(completeBindingPreview()), {
    ok: true,
    reason: 'valid_preview',
    missingFields: [],
  });
  assert.equal(
    validateBindingMaterializationPreview(completeBindingPreview({ action: 'batch-bind-skill-target' })).reason,
    'unsupported_binding_materialization_action',
  );
});

test('preview confirmation rejects missing, mismatched, and incomplete binding materialization previews', () => {
  const preview = completeBindingPreview();

  assert.deepEqual(validatePreviewConfirmation({ body: {}, preview, action: preview.action }), {
    ok: false,
    reason: 'invalid_preview',
  });
  assert.deepEqual(
    validatePreviewConfirmation({
      body: { previewId: preview.previewId },
      preview,
      action: preview.action,
      targetType: preview.targetType,
      targetId: 'other-project',
      skillId: preview.skillId,
      requireBindingMaterializationPreview: true,
    }),
    { ok: false, reason: 'invalid_preview' },
  );
  assert.deepEqual(
    validatePreviewConfirmation({
      body: { previewId: preview.previewId },
      preview: completeBindingPreview({ plannedFilesystemOperations: [] }),
      action: preview.action,
      targetType: preview.targetType,
      targetId: preview.targetId,
      skillId: preview.skillId,
      requireBindingMaterializationPreview: true,
    }),
    { ok: false, reason: 'incomplete_preview', missingFields: ['plannedFilesystemOperations'] },
  );
  assert.deepEqual(
    validatePreviewConfirmation({
      body: { previewId: preview.previewId },
      preview,
      action: preview.action,
      targetType: preview.targetType,
      targetId: preview.targetId,
      skillId: preview.skillId,
      requireBindingMaterializationPreview: true,
    }),
    { ok: true, reason: 'valid_preview', missingFields: [] },
  );
});

test('desktop local mutation routes still require matching previewId confirmation', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-preview-guardrail-'));
  const sqlitePath = join(tempDir, 'desktop.db');
  const projectPath = join(tempDir, 'project-alpha');
  await mkdir(projectPath, { recursive: true });

  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const desktopAddress = await listen(desktop.server);
    assert.equal(typeof desktopAddress, 'object');
    const baseUrl = `http://127.0.0.1:${desktopAddress.port}`;

    const createdProject = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Project Alpha', projectPath }),
    }).then(readJson);
    assert.equal(createdProject.ok, true);

    const missingPreviewRepair = await fetch(`${baseUrl}/api/projects/${createdProject.project.projectId}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }).then(readJson);
    assert.deepEqual(missingPreviewRepair, { ok: false, reason: 'invalid_preview' });

    const repairPreview = await fetch(`${baseUrl}/api/projects/${createdProject.project.projectId}/repair-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    }).then(readJson);
    assert.equal(repairPreview.ok, true);

    const wrongPreviewRepair = await fetch(`${baseUrl}/api/projects/${createdProject.project.projectId}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: 'not-the-preview' }),
    }).then(readJson);
    assert.deepEqual(wrongPreviewRepair, { ok: false, reason: 'invalid_preview' });

    const confirmedRepair = await fetch(`${baseUrl}/api/projects/${createdProject.project.projectId}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ previewId: repairPreview.preview.previewId }),
    }).then(readJson);
    assert.equal(confirmedRepair.ok, true);
  } finally {
    await close(desktop.server);
  }
});
