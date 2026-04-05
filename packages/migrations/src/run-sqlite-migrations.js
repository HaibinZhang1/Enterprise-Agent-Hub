import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sqlFiles = [resolve(packageRoot, 'sqlite/sql/0001_local_state_foundation.sql')];
const args = process.argv.slice(2);
const emitIndex = args.indexOf('--emit');
const dryRun = args.includes('--dry-run');

async function loadSqlBundle() {
  const parts = [];
  for (const file of sqlFiles) {
    parts.push(`-- ${file}`);
    parts.push(await readFile(file, 'utf8'));
  }
  return parts.join('\n');
}

if (dryRun) {
  console.log(JSON.stringify({ ok: true, engine: 'sqlite', mode: 'dry-run', files: sqlFiles }, null, 2));
  process.exit(0);
}

if (emitIndex >= 0) {
  const output = args[emitIndex + 1];
  if (!output) {
    throw new Error('Missing path after --emit');
  }
  const bundle = await loadSqlBundle();
  const outputPath = resolve(process.cwd(), output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${bundle}\n`);
  console.log(JSON.stringify({ ok: true, engine: 'sqlite', mode: 'emit', output: outputPath }, null, 2));
  process.exit(0);
}

const sqlitePath = process.env.SQLITE_PATH;
if (!sqlitePath) {
  throw new Error('Set SQLITE_PATH or use --dry-run / --emit');
}

const sqliteBinary = spawnSync('sqlite3', ['--version'], { encoding: 'utf8' });
if (sqliteBinary.status !== 0) {
  throw new Error('sqlite3 is required for direct execution; use --dry-run if unavailable');
}

const bundle = await loadSqlBundle();
for (const file of sqlFiles) {
  await access(file, constants.R_OK);
  const run = spawnSync('sqlite3', [sqlitePath], { input: bundle, stdio: ['pipe', 'inherit', 'inherit'] });
  if (run.status !== 0) {
    throw new Error(`sqlite3 failed for ${file}`);
  }
  break;
}
