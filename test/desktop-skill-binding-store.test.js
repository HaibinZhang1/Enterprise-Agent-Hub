import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createLocalSqliteStore } from '../apps/desktop/src/local-sqlite-store.js';

function readSqliteJson(sqlitePath, sql) {
  const database = new DatabaseSync(sqlitePath);
  try {
    return JSON.parse(JSON.stringify(database.prepare(sql).all()));
  } finally {
    database.close();
  }
}

function assertStoreSkillBindingApi(store) {
  for (const method of [
    'saveToolProjectAssociation',
    'getToolProjectAssociation',
    'listToolProjectAssociations',
    'saveSkillTargetBinding',
    'getSkillTargetBinding',
    'listSkillTargetBindings',
    'saveSkillTargetVersionOverride',
    'getSkillTargetVersionOverride',
    'saveSkillMaterializationStatus',
    'getSkillMaterializationStatus',
    'listSkillMaterializationStatuses',
    'resolveEffectiveSkillBinding',
  ]) {
    assert.equal(typeof store[method], 'function', `Expected local sqlite store to expose ${method}()`);
  }
}

test('desktop sqlite store persists target directories, bindings, status, and manual version choices across restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-binding-store-'));
  const sqlitePath = join(dir, 'desktop.db');
  const toolSkillsDirectory = join(dir, 'codex', 'skills');
  const projectSkillsDirectory = join(dir, 'project-alpha', 'skills');

  const store = createLocalSqliteStore({ sqlitePath });
  await store.init();
  assertStoreSkillBindingApi(store);

  const columns = readSqliteJson(
    sqlitePath,
    `
      select m.name as tableName, p.name as columnName
      from sqlite_master m
      join pragma_table_info(m.name) p
      where m.type = 'table'
        and m.name in (
          'tool_cache',
          'projects',
          'tool_project_associations',
          'skill_target_bindings',
          'skill_target_version_overrides',
          'skill_materialization_status'
        )
      order by m.name, p.cid;
    `,
  );
  const columnNamesByTable = Map.groupBy(columns, (entry) => entry.tableName);
  assert.deepEqual(
    [...columnNamesByTable.keys()].sort(),
    [
      'projects',
      'skill_materialization_status',
      'skill_target_bindings',
      'skill_target_version_overrides',
      'tool_cache',
      'tool_project_associations',
    ],
  );
  assert.equal(columnNamesByTable.get('tool_cache').some((entry) => entry.columnName === 'skills_directory'), true);
  assert.equal(columnNamesByTable.get('tool_cache').some((entry) => entry.columnName === 'materialization_enabled'), true);
  assert.equal(columnNamesByTable.get('projects').some((entry) => entry.columnName === 'skills_directory'), true);

  const tool = store.saveTool({
    toolId: 'codex',
    displayName: 'Codex',
    installPath: '/usr/local/bin/codex',
    healthState: 'ready',
    skillsDirectory: toolSkillsDirectory,
    materializationEnabled: false,
  });
  const project = store.saveProject({
    projectId: 'project-alpha',
    displayName: 'Project Alpha',
    projectPath: join(dir, 'project-alpha'),
    healthState: 'ready',
    skillsDirectory: projectSkillsDirectory,
  });

  assert.equal(tool.skillsDirectory, toolSkillsDirectory);
  assert.equal(tool.materializationEnabled, false);
  assert.equal(project.skillsDirectory, projectSkillsDirectory);

  const association = store.saveToolProjectAssociation({
    associationId: 'assoc-codex-project-alpha',
    toolId: 'codex',
    projectId: 'project-alpha',
    enabled: true,
    searchRoots: [projectSkillsDirectory, toolSkillsDirectory],
    conflictState: 'clear',
  });
  assert.deepEqual(association.searchRoots, [projectSkillsDirectory, toolSkillsDirectory]);

  const toolBinding = store.saveSkillTargetBinding({
    targetType: 'tool',
    targetId: 'codex',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-1',
    version: '1.0.0',
    enabled: true,
  });
  const projectBinding = store.saveSkillTargetBinding({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-2',
    version: '2.0.0',
    enabled: true,
  });
  assert.equal(toolBinding.version, '1.0.0');
  assert.equal(projectBinding.version, '2.0.0');
  assert.equal(store.listSkillTargetBindings({ skillId: 'skill-shared' }).length, 2);

  const conflict = store.resolveEffectiveSkillBinding({
    associationId: 'assoc-codex-project-alpha',
    skillId: 'skill-shared',
  });
  assert.equal(conflict.status, 'manual_choice_required');
  assert.deepEqual(conflict.candidates.map((candidate) => candidate.version).sort(), ['1.0.0', '2.0.0']);

  const manualChoice = store.saveSkillTargetVersionOverride({
    associationId: 'assoc-codex-project-alpha',
    skillId: 'skill-shared',
    selectedVersion: '2.0.0',
    selectedPackageId: 'pkg-shared-2',
    reason: 'manual_conflict_resolution',
  });
  assert.equal(manualChoice.selectedVersion, '2.0.0');

  const effectiveAfterChoice = store.resolveEffectiveSkillBinding({
    associationId: 'assoc-codex-project-alpha',
    skillId: 'skill-shared',
  });
  assert.equal(effectiveAfterChoice.status, 'resolved');
  assert.equal(effectiveAfterChoice.effectiveBinding.version, '2.0.0');
  assert.equal(effectiveAfterChoice.effectiveBinding.targetType, 'project');

  const status = store.saveSkillMaterializationStatus({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-shared',
    packageId: 'pkg-shared-2',
    version: '2.0.0',
    mode: 'symlink',
    status: 'materialized',
    targetPath: join(projectSkillsDirectory, 'skill-shared'),
    sourcePath: join(dir, 'packages', 'pkg-shared-2'),
    lastError: null,
  });
  assert.equal(status.mode, 'symlink');
  assert.equal(status.status, 'materialized');

  const restartedStore = createLocalSqliteStore({ sqlitePath });
  await restartedStore.init();
  assertStoreSkillBindingApi(restartedStore);
  assert.equal(
    restartedStore.getSkillTargetVersionOverride({
      associationId: 'assoc-codex-project-alpha',
      skillId: 'skill-shared',
    })?.selectedVersion,
    '2.0.0',
  );
  assert.equal(
    restartedStore.getSkillMaterializationStatus({
      targetType: 'project',
      targetId: 'project-alpha',
      skillId: 'skill-shared',
    })?.status,
    'materialized',
  );
});

test('desktop effective binding resolution stays scoped to explicit tool-project associations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-skill-binding-precedence-'));
  const store = createLocalSqliteStore({ sqlitePath: join(dir, 'desktop.db') });
  await store.init();
  assertStoreSkillBindingApi(store);

  store.saveTool({
    toolId: 'codex',
    displayName: 'Codex',
    installPath: '/usr/local/bin/codex',
    healthState: 'ready',
    skillsDirectory: join(dir, 'codex', 'skills'),
    materializationEnabled: true,
  });
  store.saveProject({
    projectId: 'project-alpha',
    displayName: 'Project Alpha',
    projectPath: join(dir, 'project-alpha'),
    healthState: 'ready',
    skillsDirectory: join(dir, 'project-alpha', 'skills'),
  });
  store.saveProject({
    projectId: 'project-unrelated',
    displayName: 'Project Unrelated',
    projectPath: join(dir, 'project-unrelated'),
    healthState: 'ready',
    skillsDirectory: join(dir, 'project-unrelated', 'skills'),
  });

  store.saveSkillTargetBinding({
    targetType: 'tool',
    targetId: 'codex',
    skillId: 'skill-precedence',
    packageId: 'pkg-tool-v1',
    version: '1.0.0',
    enabled: true,
  });
  store.saveSkillTargetBinding({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-precedence',
    packageId: 'pkg-project-v1',
    version: '1.0.0',
    enabled: true,
  });
  store.saveSkillTargetBinding({
    targetType: 'project',
    targetId: 'project-unrelated',
    skillId: 'skill-precedence',
    packageId: 'pkg-unrelated-v9',
    version: '9.0.0',
    enabled: true,
  });

  assert.equal(
    store.resolveEffectiveSkillBinding({
      toolId: 'codex',
      projectId: 'project-alpha',
      skillId: 'skill-precedence',
    }).status,
    'independent_targets',
    'No explicit association means project/tool precedence must not be evaluated globally.',
  );

  store.saveToolProjectAssociation({
    associationId: 'assoc-codex-alpha',
    toolId: 'codex',
    projectId: 'project-alpha',
    enabled: true,
    searchRoots: [join(dir, 'project-alpha', 'skills'), join(dir, 'codex', 'skills')],
    conflictState: 'clear',
  });

  const associatedResolution = store.resolveEffectiveSkillBinding({
    associationId: 'assoc-codex-alpha',
    skillId: 'skill-precedence',
  });
  assert.equal(associatedResolution.status, 'resolved');
  assert.equal(associatedResolution.effectiveBinding.targetType, 'project');
  assert.equal(associatedResolution.effectiveBinding.targetId, 'project-alpha');
  assert.equal(
    associatedResolution.candidates.some((candidate) => candidate.targetId === 'project-unrelated'),
    false,
    'Unrelated project bindings must not participate in an explicit tool-project search-path domain.',
  );

  store.saveSkillTargetBinding({
    targetType: 'project',
    targetId: 'project-alpha',
    skillId: 'skill-precedence',
    packageId: 'pkg-project-v1',
    version: '1.0.0',
    enabled: false,
  });

  const fallbackResolution = store.resolveEffectiveSkillBinding({
    associationId: 'assoc-codex-alpha',
    skillId: 'skill-precedence',
  });
  assert.equal(fallbackResolution.status, 'resolved');
  assert.equal(fallbackResolution.effectiveBinding.targetType, 'tool');
  assert.equal(fallbackResolution.effectiveBinding.targetId, 'codex');
  assert.equal(fallbackResolution.effectiveBinding.version, '1.0.0');
});
