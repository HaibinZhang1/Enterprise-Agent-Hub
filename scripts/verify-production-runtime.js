// @ts-nocheck
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const composeFile = resolve(repoRoot, 'infra/docker-compose.production.yml');
const envDir = await mkdtemp(resolve(tmpdir(), 'enterprise-agent-hub-prod-runtime-'));
const envPath = resolve(envDir, '.env.production.local');
const migrationOutput = resolve(envDir, 'postgres.sql');

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

async function main() {
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

  try {
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

    const health = run('curl', ['-sf', 'http://127.0.0.1:8080/api/health']);
    const login = run('curl', [
      '-sf',
      'http://127.0.0.1:8080/api/auth/login',
      '-H',
      'content-type: application/json',
      '-d',
      '{"username":"admin","password":"admin","deviceLabel":"Production Runtime Verification"}',
    ]);

    console.log(
      JSON.stringify(
        {
          ok: true,
          health: JSON.parse(health),
          login: JSON.parse(login),
          envFile: envPath,
          composeFile,
        },
        null,
        2,
      ),
    );
  } finally {
    spawnSync('docker', ['compose', '--env-file', envPath, '-f', composeFile, 'down', '-v'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    await rm(envDir, { recursive: true, force: true });
  }
}

await main();
