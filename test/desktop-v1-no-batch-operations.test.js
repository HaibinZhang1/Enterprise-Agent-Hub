import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

const desktopProductFiles = [
  'apps/desktop/src/server.js',
  'apps/desktop/ui/index.html',
  'apps/desktop/ui/app.js',
  'apps/desktop/ui/style.css',
  'apps/desktop/ui/styles.css',
];

const forbiddenBatchOperationPatterns = [
  /\b(batch|bulk)[\w/-]*(bind|enable|disable|upgrade)\b/i,
  /\b(bind|enable|disable|upgrade)[\w/-]*(batch|bulk|all)\b/i,
  /\b(bind|enable|disable|upgrade)-all\b/i,
  /批量(绑定|启用|停用|升级)/,
  /一键(绑定|启用|停用|升级)/,
];

async function read(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

async function fileExists(path) {
  try {
    await stat(resolve(repoRoot, path));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function listDesktopSourceFiles(dir = 'apps/desktop') {
  const absoluteDir = resolve(repoRoot, dir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (['dist', 'node_modules', 'src-tauri'].includes(entry.name)) {
        continue;
      }
      files.push(...(await listDesktopSourceFiles(relative)));
      continue;
    }

    if (/\.(?:js|jsx|ts|tsx|html|css|md)$/.test(entry.name)) {
      files.push(relative);
    }
  }

  return files;
}

test('desktop V1 documents the no-batch skill-management boundary', async () => {
  const readme = await read('README.md');
  const detailedDesignReadme = await read('docs/DetailedDesign/README.md');
  const toolsPageDesign = await read('docs/DetailedDesign/frontend-pages/tools.md');
  const projectsPageDesign = await read('docs/DetailedDesign/frontend-pages/projects.md');
  const futureConclusion = await read('docs/RequirementDocument/19_future_conclusion.md');

  assert.match(readme, /no batch bind, batch enable\/disable, or batch upgrade workflows ship in this slice/i);
  assert.match(detailedDesignReadme, /V1 不交付批量绑定、批量启用\/停用、批量升级/);
  assert.match(toolsPageDesign, /工具页不得提供批量绑定、批量启用\/停用或批量升级入口/);
  assert.match(projectsPageDesign, /项目页只支持单项目、单 Skill/);
  assert.match(futureConclusion, /批量 Skill 目标管理/);
});

test('desktop V1 product surface does not expose batch bind, enable, or upgrade actions', async () => {
  const desktopFiles = new Set(await listDesktopSourceFiles());
  for (const file of desktopProductFiles) {
    if (await fileExists(file)) {
      desktopFiles.add(file);
    }
  }

  const violations = [];
  for (const file of [...desktopFiles].sort()) {
    const content = await read(file);
    for (const pattern of forbiddenBatchOperationPatterns) {
      if (pattern.test(content)) {
        violations.push(`${file} matched ${pattern}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
