import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresMigrationPlan, sqliteMigrationPlan } from './src/index.js';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(packageRoot, 'dist');
await mkdir(distDir, { recursive: true });
await writeFile(
  resolve(distDir, 'migration-plans.json'),
  `${JSON.stringify({ postgresMigrationPlan, sqliteMigrationPlan }, null, 2)}
`,
);
console.log(JSON.stringify({ ok: true, package: '@enterprise-agent-hub/migrations', output: 'dist/migration-plans.json' }));
