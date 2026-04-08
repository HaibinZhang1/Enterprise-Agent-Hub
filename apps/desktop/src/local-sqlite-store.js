// @ts-nocheck
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(packageRoot, '..', '..', '..');
const migrationScript = resolve(workspaceRoot, 'packages/migrations/src/run-sqlite-migrations.js');

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
      const output = runSqlite(
        sqlitePath,
        `select payload, updated_at as updatedAt from client_state where state_key = ${sqlLiteral(key)};`,
        true,
      );
      const rows = output ? JSON.parse(output) : [];
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
      const output = runSqlite(
        sqlitePath,
        `select payload, updated_at as updatedAt from client_cache where cache_key = ${sqlLiteral(key)};`,
        true,
      );
      const rows = output ? JSON.parse(output) : [];
      if (rows.length === 0) {
        return null;
      }
      return Object.freeze({ payload: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt });
    },

    listCaches() {
      const output = runSqlite(sqlitePath, 'select cache_key as cacheKey, updated_at as updatedAt from client_cache order by updated_at desc;', true);
      return Object.freeze(output ? JSON.parse(output) : []);
    },
  });
}
