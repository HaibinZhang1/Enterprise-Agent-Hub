import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from './src/manifest.js';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(packageRoot, 'dist');
await mkdir(distDir, { recursive: true });
await writeFile(resolve(distDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}
`);
console.log(JSON.stringify({ ok: true, package: '@enterprise-agent-hub/web', output: 'dist/manifest.json' }));
