// @ts-nocheck
import { spawnSync } from 'node:child_process';

function normalize(value) {
  return value === undefined ? null : value;
}

export function sqlLiteral(value) {
  const normalized = normalize(value);
  if (normalized === null) {
    return 'null';
  }
  return `'${String(normalized).replaceAll("'", "''")}'`;
}

export function sqlUuid(value) {
  const normalized = normalize(value);
  return normalized === null ? 'null' : `${sqlLiteral(normalized)}::uuid`;
}

export function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function run(databaseUrl, sql) {
  const result = spawnSync(
    'psql',
    [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-F', '\t', '-c', sql],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'psql command failed').trim());
  }
  return result.stdout.trim();
}

export function execSql(databaseUrl, sql) {
  run(databaseUrl, sql);
}

export function queryScalar(databaseUrl, sql, fallback = null) {
  const output = run(databaseUrl, sql);
  if (!output) {
    return fallback;
  }
  return output;
}

export function queryOne(databaseUrl, sql) {
  const output = queryScalar(databaseUrl, `select row_to_json(t) from (${sql}) as t limit 1;`);
  return output ? JSON.parse(output) : null;
}

export function queryMany(databaseUrl, sql) {
  const output = queryScalar(databaseUrl, `select coalesce(json_agg(row_to_json(t)), '[]'::json) from (${sql}) as t;`, '[]');
  return JSON.parse(output || '[]');
}
