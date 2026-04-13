import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Client as MinioClient } from 'minio';
import { Client } from 'pg';

function resolveSqlPath(): string {
  const candidates = [
    join(__dirname, '..', 'database', 'seeds', 'p1_seed.sql'),
    join(__dirname, '..', '..', 'src', 'database', 'seeds', 'p1_seed.sql'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Seed SQL not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

function resolveSeedPackagePath(): string {
  const candidates = [
    join(__dirname, '..', 'database', 'seeds', 'packages', 'codex-review-helper', '1.2.0', 'package.zip'),
    join(__dirname, '..', '..', 'src', 'database', 'seeds', 'packages', 'codex-review-helper', '1.2.0', 'package.zip'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Seed package zip not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

async function uploadSeedPackage(): Promise<void> {
  if (!process.env.MINIO_ENDPOINT) {
    return;
  }

  const packagePath = resolveSeedPackagePath();
  const client = new MinioClient({
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'change-me-minio-secret',
  });
  const bucket = process.env.MINIO_SKILL_PACKAGE_BUCKET ?? 'skill-packages';
  const objectKey = 'skills/codex-review-helper/1.2.0/package.zip';
  await client.putObject(bucket, objectKey, readFileSync(packagePath), statSync(packagePath).size, {
    'Content-Type': 'application/zip',
  });
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to seed P1 data');
  }

  const sql = readFileSync(resolveSqlPath(), 'utf8');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    await uploadSeedPackage();
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
