import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

async function read(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

function visibleText(markup) {
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('desktop release UI exposes modal auth, publish/review workbench, and admin management structure on the routed shell', async () => {
  const [html, app, boot, dialogs, topbar, mySkillPage, reviewPage, managementPage, mySkillFeature, reviewFeature] = await Promise.all([
    read('apps/desktop/ui/index.html'),
    read('apps/desktop/ui/app.js'),
    read('apps/desktop/ui/core/boot.js'),
    read('apps/desktop/ui/components/dialogs.js'),
    read('apps/desktop/ui/components/topbar.js'),
    read('apps/desktop/ui/pages/my-skill.js'),
    read('apps/desktop/ui/pages/review.js'),
    read('apps/desktop/ui/pages/management.js'),
    read('apps/desktop/ui/features/my-skill.js'),
    read('apps/desktop/ui/features/review.js'),
  ]);
  const runtimeEntry = `${app}\n${boot}\n${dialogs}\n${topbar}\n${mySkillPage}\n${reviewPage}\n${managementPage}\n${mySkillFeature}\n${reviewFeature}`;
  const text = visibleText(`${dialogs}\n${mySkillPage}\n${reviewPage}\n${managementPage}`);

  assert.match(html, /id=["']dialog-host["']/);
  assert.doesNotMatch(html, /id=["']login-form["']/);
  assert.match(runtimeEntry, /data-open-auth=/);
  assert.match(runtimeEntry, /data-login-form=/);
  assert.match(runtimeEntry, /Publish Workbench/);
  assert.match(runtimeEntry, /部门管理/);
  assert.match(runtimeEntry, /用户管理/);
  assert.match(runtimeEntry, /Skill 管理/);
  assert.match(text, /publish workbench|upload \+ submit/i);
  assert.match(text, /review/i);
  assert.match(text, /management/i);
  assert.match(runtimeEntry, /\/api\/reviews\/submit/);
  assert.match(runtimeEntry, /\/api\/reviews\/\$\{encodeURIComponent\(ticketId\)\}\/claim/);
  assert.match(runtimeEntry, /\/api\/reviews\/\$\{encodeURIComponent\(ticketId\)\}\/approve/);
  assert.doesNotMatch(runtimeEntry, /focusLoginEntry/);
  assert.doesNotMatch(text, /reject ticket|withdraw submission|reassign reviewer|comment thread|review history|multi-reviewer/i);
});

test('production verifiers encode Windows artifact evidence and intranet runtime modes', async () => {
  const assets = await read('scripts/verify-production-assets.js');
  const runtime = await read('scripts/verify-production-runtime.js');

  assert.match(assets, /windowsArtifact/);
  assert.match(assets, /windowsRuntimeValidated/);
  assert.match(assets, /windowsRuntimeValidationMode/);
  assert.match(assets, /nsis|\.exe/i);
  assert.match(assets, /msi|\.msi/i);
  assert.match(assets, /artifact-only|residual[- ]risk|runtime readiness is not fully proven/i);

  assert.match(runtime, /INTRANET_BASE_URL/);
  assert.match(runtime, /PRODUCTION_BASE_URL/);
  assert.match(runtime, /localhost-fallback/);
  assert.match(runtime, /intranet-url/);
  assert.match(runtime, /\/api\/health/);
  assert.match(runtime, /\/api\/auth\/login/);
  assert.match(runtime, /\/api\/market/);
  assert.match(runtime, /\/api\/skills\/my/);
});

test('desktop shell keeps publish and review proxy routes available for resumed workbench coverage', async () => {
  const server = await read('apps/desktop/src/server.js');

  assert.match(server, /\/api\/packages\/upload/);
  assert.match(server, /\/api\/reviews\/submit/);
  assert.match(server, /segments\[1\] === 'reviews'.*segments\[3\] === 'claim'/s);
  assert.match(server, /segments\[1\] === 'reviews'.*segments\[3\] === 'approve'/s);
  assert.match(server, /proxyRoutes = new Map\(\[/);
  assert.match(server, /'\/api\/reviews'/);
});

test('documentation keeps the Windows-first product/demo path desktop-only', async () => {
  const readme = await read('README.md');
  const runbook = await read('docs/desktop-release-runbook.md');
  const combined = `${readme}\n${runbook}`;

  assert.match(combined, /apps\/desktop[^\n]*(only|primary|maintained).*(product|demo|release)|only[^\n]*(product|demo|release)[^\n]*apps\/desktop/i);
  assert.doesNotMatch(combined, /apps\/web/i);
  assert.match(combined, /Windows/i);
  assert.match(combined, /installer|package artifact/i);
  assert.match(combined, /INTRANET_BASE_URL|PRODUCTION_BASE_URL|LAN URL/i);
  assert.match(combined, /artifact-only|residual risk|windowsRuntimeValidated/i);
});
