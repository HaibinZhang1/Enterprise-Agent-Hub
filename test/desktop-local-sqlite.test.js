import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createLocalSqliteStore } from '../apps/desktop/src/local-sqlite-store.js';

function readSqliteJson(sqlitePath, sql) {
  const result = spawnSync('sqlite3', ['-json', sqlitePath, sql], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim() ? JSON.parse(result.stdout) : [];
}

test('desktop local sqlite store persists state and cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-sqlite-'));
  const store = createLocalSqliteStore({ sqlitePath: join(dir, 'desktop.db') });
  await store.init();

  store.saveState('last-user', { username: 'admin' });
  store.saveCache('/api/market', { ok: true, results: [{ skillId: 'skill-market-1' }] });

  assert.deepEqual(store.getState('last-user')?.payload, { username: 'admin' });
  assert.deepEqual(store.getCache('/api/market')?.payload.results[0].skillId, 'skill-market-1');
  assert.equal(store.listCaches().length, 1);
});

test('desktop local sqlite foundation keeps tool/project tables and settings-like state available', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-sqlite-foundation-'));
  const sqlitePath = join(dir, 'desktop.db');
  const store = createLocalSqliteStore({ sqlitePath });
  await store.init();

  store.saveState('settings', {
    apiBaseUrl: 'http://127.0.0.1:8788',
    defaultProjectId: 'project-alpha',
    appearance: 'system',
  });
  store.saveState('current-project', {
    projectId: 'project-alpha',
    updatedBy: 'desktop-shell',
  });
  store.saveTool({
    toolId: 'tool-alpha',
    displayName: 'Tool Alpha',
    installPath: '/opt/tools/alpha',
    healthState: 'healthy',
  });
  store.saveProject({
    projectId: 'project-alpha',
    displayName: 'Project Alpha',
    projectPath: '/workspace/project-alpha',
    healthState: 'healthy',
  });
  const storedTool = store.getTool('tool-alpha');
  const storedProject = store.getProject('project-alpha');

  assert.deepEqual(store.getState('settings')?.payload, {
    apiBaseUrl: 'http://127.0.0.1:8788',
    defaultProjectId: 'project-alpha',
    appearance: 'system',
  });
  assert.deepEqual(store.getState('current-project')?.payload, {
    projectId: 'project-alpha',
    updatedBy: 'desktop-shell',
  });
  assert.equal(store.listTools().length, 1);
  assert.equal(store.listProjects().length, 1);
  assert.deepEqual(storedTool, {
    toolId: 'tool-alpha',
    displayName: 'Tool Alpha',
    installPath: '/opt/tools/alpha',
    skillsDirectory: null,
    materializationEnabled: true,
    healthState: 'healthy',
    updatedAt: storedTool.updatedAt,
  });
  assert.deepEqual(storedProject, {
    projectId: 'project-alpha',
    displayName: 'Project Alpha',
    projectPath: '/workspace/project-alpha',
    skillsDirectory: null,
    healthState: 'healthy',
    updatedAt: storedProject.updatedAt,
  });

  const tables = readSqliteJson(
    sqlitePath,
    `
      select name
      from sqlite_master
      where type = 'table'
        and name in ('tool_cache', 'projects', 'client_state')
      order by name;
    `,
  );
  const tools = readSqliteJson(
    sqlitePath,
    `
      select
        tool_id as toolId,
        display_name as displayName,
        install_path as installPath,
        skills_directory as skillsDirectory,
        materialization_enabled as materializationEnabled,
        health_state as healthState,
        updated_at as updatedAt
      from tool_cache;
    `,
  );
  const projects = readSqliteJson(
    sqlitePath,
    `
      select
        project_id as projectId,
        display_name as displayName,
        project_path as projectPath,
        skills_directory as skillsDirectory,
        health_state as healthState,
        updated_at as updatedAt
      from projects;
    `,
  );

  assert.deepEqual(
    tables.map((entry) => entry.name),
    ['client_state', 'projects', 'tool_cache'],
  );
  assert.deepEqual(tools, [
    {
      toolId: 'tool-alpha',
      displayName: 'Tool Alpha',
      installPath: '/opt/tools/alpha',
      skillsDirectory: null,
      materializationEnabled: 1,
      healthState: 'healthy',
      updatedAt: tools[0].updatedAt,
    },
  ]);
  assert.deepEqual(projects, [
    {
      projectId: 'project-alpha',
      displayName: 'Project Alpha',
      projectPath: '/workspace/project-alpha',
      skillsDirectory: null,
      healthState: 'healthy',
      updatedAt: projects[0].updatedAt,
    },
  ]);

  store.deleteTool('tool-alpha');
  store.deleteProject('project-alpha');
  assert.equal(store.getTool('tool-alpha'), null);
  assert.equal(store.getProject('project-alpha'), null);
});
