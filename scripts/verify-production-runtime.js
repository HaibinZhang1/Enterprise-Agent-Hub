// @ts-nocheck
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(repoRoot, 'infra/docker-compose.production.yml');
const configuredBaseUrl = process.env.INTRANET_BASE_URL || process.env.PRODUCTION_BASE_URL || '';
const verificationMode = configuredBaseUrl ? 'intranet-url' : 'localhost-fallback';
const baseUrl = normalizeBaseUrl(configuredBaseUrl || 'http://127.0.0.1:8080');
const envDir = await mkdtemp(resolve(tmpdir(), 'enterprise-agent-hub-prod-runtime-'));
const envPath = resolve(envDir, '.env.production.local');
const migrationOutput = resolve(envDir, 'postgres.sql');

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  }
  return result.stdout.trim();
}

function runJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options));
}

function apiUrl(pathname) {
  return `${baseUrl}${pathname}`;
}

function curlJson(pathname, args = []) {
  return runJson('curl', ['-sf', apiUrl(pathname), ...args]);
}

async function prepareLocalFallbackStack() {
  await writeFile(
    envPath,
    [
      'POSTGRES_USER=enterprise_agent_hub',
      'POSTGRES_PASSWORD=change_me',
      'POSTGRES_DB=enterprise_agent_hub',
      'DATABASE_URL=postgresql://enterprise_agent_hub:change_me@postgres:5432/enterprise_agent_hub',
      'PUBLIC_HTTP_PORT=8080',
      'NGINX_IMAGE=nginx:1.27-alpine',
      'POSTGRES_IMAGE=pgvector/pgvector:pg16',
      'NODE_RUNTIME_IMAGE=docker-backend:latest',
      'API_BASE_IMAGE=pgvector/pgvector:pg16',
      'API_HAS_POSTGRES_CLIENT=1',
      'API_OFFLINE_WORKSPACE=1',
      'SKIP_MIGRATIONS=1',
      'PNPM_REGISTRY_URL=https://registry.npmjs.org',
      '',
    ].join('\n'),
  );

  run('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'down', '-v']);
  run('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'up', '-d', 'postgres']);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = spawnSync(
      'docker',
      ['compose', '--env-file', envPath, '-f', composeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'enterprise_agent_hub', '-d', 'enterprise_agent_hub'],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    if (ready.status === 0) {
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    if (attempt === 29) {
      throw new Error((ready.stderr || ready.stdout || 'postgres not ready').trim());
    }
  }

  run('node', ['packages/migrations/src/run-postgres-migrations.js', '--emit', migrationOutput]);
  const migrationSql = await readFile(migrationOutput, 'utf8');
  run(
    'docker',
    ['compose', '--env-file', envPath, '-f', composeFile, 'exec', '-T', 'postgres', 'psql', '-U', 'enterprise_agent_hub', '-d', 'enterprise_agent_hub'],
    { input: migrationSql },
  );

  run('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'build', 'api']);
  run('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'up', '-d', 'api', 'nginx']);

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
}

function verifyRuntime() {
  const health = curlJson('/api/health');
  const login = curlJson('/api/auth/login', [
    '-H',
    'content-type: application/json',
    '-d',
    '{"username":"admin","password":"admin","deviceLabel":"Production Runtime Verification"}',
  ]);
  const sessionId = login.sessionId ?? login.session?.sessionId ?? login.accessToken;
  if (!sessionId) {
    throw new Error('Production runtime login did not return a usable session token.');
  }

  const authHeader = ['-H', `authorization: Bearer ${sessionId}`];
  const market = curlJson('/api/market', authHeader);
  const mySkills = curlJson('/api/skills/my', authHeader);

  return {
    ok: true,
    mode: verificationMode,
    baseUrl,
    health,
    login: {
      ok: login.ok,
      username: login.user?.username ?? null,
      userId: login.user?.userId ?? null,
      hasSessionId: Boolean(sessionId),
    },
    market: {
      ok: market.ok,
      resultCount: Array.isArray(market.results) ? market.results.length : null,
    },
    mySkills: {
      ok: mySkills.ok,
      count: Array.isArray(mySkills.skills) ? mySkills.skills.length : null,
    },
    envFile: verificationMode === 'localhost-fallback' ? envPath : null,
    composeFile: verificationMode === 'localhost-fallback' ? composeFile : null,
  };
}

async function main() {
  try {
    if (verificationMode === 'localhost-fallback') {
      await prepareLocalFallbackStack();
    }

    console.log(JSON.stringify(verifyRuntime(), null, 2));
  } finally {
    if (verificationMode === 'localhost-fallback') {
      spawnSync('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'down', '-v'], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
    }
    await rm(envDir, { recursive: true, force: true });
  }
}

await main();
