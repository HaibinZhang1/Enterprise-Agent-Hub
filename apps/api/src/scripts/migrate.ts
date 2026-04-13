import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

function resolveMigrationDir(): string {
  const candidates = [
    join(__dirname, '..', 'database', 'migrations'),
    join(__dirname, '..', '..', 'src', 'database', 'migrations'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Migration directory not found. Tried: ${candidates.join(', ')}`);
  }
  return found;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const migrationDir = resolveMigrationDir();
  const migrationFiles = readdirSync(migrationDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
  const client = new Client({ connectionString });
  await client.connect();
  try {
    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationDir, file), 'utf8');
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
