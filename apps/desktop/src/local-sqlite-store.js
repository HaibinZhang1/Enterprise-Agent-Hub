// @ts-nocheck
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(dirname(packageRoot)));
const migrationScript = `${workspaceRoot}/packages/migrations/src/run-sqlite-migrations.js`;

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseJsonRows(output) {
  return output ? JSON.parse(output) : [];
}

function runSqlite(sqlitePath, sql, json = false) {
  const args = json ? ['-json', sqlitePath, sql] : [sqlitePath, sql];
  const result = spawnSync('sqlite3', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'sqlite3 command failed').trim());
  }
  return result.stdout.trim();
}

export function createLocalSqliteStore(input) {
  const sqlitePath = input.sqlitePath;

  return Object.freeze({
    sqlitePath,

    async init() {
      await mkdir(dirname(sqlitePath), { recursive: true });
      const migrate = spawnSync(process.execPath, [migrationScript], {
        env: { ...process.env, SQLITE_PATH: sqlitePath },
        stdio: 'inherit',
      });
      if (migrate.status !== 0) {
        throw new Error('SQLite migrations failed.');
      }
    },

    saveState(key, payload) {
      runSqlite(
        sqlitePath,
        `
          insert into client_state (state_key, payload, updated_at)
          values (${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(payload))}, current_timestamp)
          on conflict(state_key) do update set payload = excluded.payload, updated_at = current_timestamp;
        `,
      );
      return this.getState(key);
    },

    getState(key) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `select payload, updated_at as updatedAt from client_state where state_key = ${sqlLiteral(key)};`,
          true,
        ),
      );
      if (rows.length === 0) {
        return null;
      }
      return Object.freeze({ payload: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt });
    },

    deleteState(key) {
      runSqlite(sqlitePath, `delete from client_state where state_key = ${sqlLiteral(key)};`);
    },

    saveCache(key, payload) {
      runSqlite(
        sqlitePath,
        `
          insert into client_cache (cache_key, payload, updated_at)
          values (${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(payload))}, current_timestamp)
          on conflict(cache_key) do update set payload = excluded.payload, updated_at = current_timestamp;
        `,
      );
      return this.getCache(key);
    },

    getCache(key) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `select payload, updated_at as updatedAt from client_cache where cache_key = ${sqlLiteral(key)};`,
          true,
        ),
      );
      if (rows.length === 0) {
        return null;
      }
      return Object.freeze({ payload: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt });
    },

    listCaches() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            'select cache_key as cacheKey, updated_at as updatedAt from client_cache order by updated_at desc;',
            true,
          ),
        ),
      );
    },

    saveTool(tool) {
      runSqlite(
        sqlitePath,
        `
          insert into tool_cache (tool_id, display_name, install_path, health_state, updated_at)
          values (
            ${sqlLiteral(tool.toolId)},
            ${sqlLiteral(tool.displayName)},
            ${sqlLiteral(tool.installPath)},
            ${sqlLiteral(tool.healthState)},
            current_timestamp
          )
          on conflict(tool_id) do update set
            display_name = excluded.display_name,
            install_path = excluded.install_path,
            health_state = excluded.health_state,
            updated_at = current_timestamp;
        `,
      );
      return this.getTool(tool.toolId);
    },

    getTool(toolId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              tool_id as toolId,
              display_name as displayName,
              install_path as installPath,
              health_state as healthState,
              updated_at as updatedAt
            from tool_cache
            where tool_id = ${sqlLiteral(toolId)};
          `,
          true,
        ),
      );
      return Object.freeze(rows[0] ?? null);
    },

    listTools() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                tool_id as toolId,
                display_name as displayName,
                install_path as installPath,
                health_state as healthState,
                updated_at as updatedAt
              from tool_cache
              order by lower(display_name), tool_id;
            `,
            true,
          ),
        ),
      );
    },

    deleteTool(toolId) {
      runSqlite(sqlitePath, `delete from tool_cache where tool_id = ${sqlLiteral(toolId)};`);
    },

    saveProject(project) {
      runSqlite(
        sqlitePath,
        `
          insert into projects (project_id, display_name, project_path, health_state, updated_at)
          values (
            ${sqlLiteral(project.projectId)},
            ${sqlLiteral(project.displayName)},
            ${sqlLiteral(project.projectPath)},
            ${sqlLiteral(project.healthState)},
            current_timestamp
          )
          on conflict(project_id) do update set
            display_name = excluded.display_name,
            project_path = excluded.project_path,
            health_state = excluded.health_state,
            updated_at = current_timestamp;
        `,
      );
      return this.getProject(project.projectId);
    },

    getProject(projectId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              project_id as projectId,
              display_name as displayName,
              project_path as projectPath,
              health_state as healthState,
              updated_at as updatedAt
            from projects
            where project_id = ${sqlLiteral(projectId)};
          `,
          true,
        ),
      );
      return Object.freeze(rows[0] ?? null);
    },

    listProjects() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                project_id as projectId,
                display_name as displayName,
                project_path as projectPath,
                health_state as healthState,
                updated_at as updatedAt
              from projects
              order by lower(display_name), project_id;
            `,
            true,
          ),
        ),
      );
    },

    deleteProject(projectId) {
      runSqlite(sqlitePath, `delete from projects where project_id = ${sqlLiteral(projectId)};`);
    },
  });
}
