import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

function resolveSqlPath(): string {
  const candidates = [
    join(__dirname, '..', 'database', 'migrations', '001_p1_base.sql'),
    join(__dirname, '..', '..', 'src', 'database', 'migrations', '001_p1_base.sql'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Migration SQL not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const sql = readFileSync(resolveSqlPath(), 'utf8');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
