import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { validateRuntimeConfig } = require('../src/config/runtime-config.ts');

test('validateRuntimeConfig accepts an explicit client update bucket alongside existing MinIO buckets', () => {
  const env = validateRuntimeConfig({
    DATABASE_URL: 'postgresql://eah:secret@db.example.local:5432/enterprise_agent_hub',
    MINIO_ENDPOINT: 'minio.example.local',
    MINIO_PORT: '9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'super-secret-value',
    MINIO_SKILL_PACKAGE_BUCKET: 'skill-packages',
    MINIO_SKILL_ASSET_BUCKET: 'skill-assets',
    MINIO_CLIENT_UPDATE_BUCKET: 'client-updates',
  });

  assert.equal(env.MINIO_CLIENT_UPDATE_BUCKET, 'client-updates');
});

test('validateRuntimeConfig rejects invalid client update bucket names', () => {
  assert.throws(
    () =>
      validateRuntimeConfig({
        DATABASE_URL: 'postgresql://eah:secret@db.example.local:5432/enterprise_agent_hub',
        MINIO_CLIENT_UPDATE_BUCKET: 'Client Updates',
      }),
    /MINIO_CLIENT_UPDATE_BUCKET must be a valid lowercase bucket name/,
  );
});
