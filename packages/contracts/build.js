import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phaseGateFixtures } from './src/index.js';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(packageRoot, 'dist');

await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, 'phase-gate-fixtures.json'), `${JSON.stringify(phaseGateFixtures, null, 2)}
`);
console.log(JSON.stringify({ ok: true, package: '@enterprise-agent-hub/contracts', output: 'dist/phase-gate-fixtures.json' }));
