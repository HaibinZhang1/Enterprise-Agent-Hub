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

function appsWebPromotionLines(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /apps\/web/i.test(line))
    .filter((line) => /maintained|product|demo|reference UI|reference surface/i.test(line))
    .filter((line) => !/not|do not|historical|non-product|prior|memory-runtime/i.test(line));
}

test('desktop release UI exposes only the required read/use surface', async () => {
  const html = await read('apps/desktop/ui/index.html');
  const app = await read('apps/desktop/ui/app.js');
  const text = visibleText(html);

  assert.match(html, /id=["']login-form["']/);
  assert.match(text, /connection status|api connection|server status|api status/i);
  assert.match(text, /server url|api url|configured server/i);
  assert.match(text, /my skills?/i);
  assert.match(text, /market|browse|search/i);
  assert.match(text, /notifications?|status/i);
  assert.match(html, /href=["']\/style\.css["']|href=["']\/styles\.css["']/);
  assert.doesNotMatch(text, /publish package|upload \+ submit|review queue|claim ticket|approve ticket/i);
  assert.doesNotMatch(app, /publishForm|reviewActionForm|claimTicketButton|approveTicketButton|\/api\/reviews/);
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

test('documentation keeps apps/web out of the Windows-first product/demo path', async () => {
  const readme = await read('README.md');
  const runbook = await read('docs/desktop-release-runbook.md');
  const combined = `${readme}\n${runbook}`;

  assert.match(combined, /apps\/desktop[^\n]*(only|primary|maintained).*(product|demo|release)|only[^\n]*(product|demo|release)[^\n]*apps\/desktop/i);
  assert.deepEqual(appsWebPromotionLines(combined), []);
  assert.doesNotMatch(combined, /pnpm --filter @enterprise-agent-hub\/web dev/i);
  assert.match(combined, /Windows/i);
  assert.match(combined, /installer|package artifact/i);
  assert.match(combined, /INTRANET_BASE_URL|PRODUCTION_BASE_URL|LAN URL/i);
  assert.match(combined, /artifact-only|residual risk|windowsRuntimeValidated/i);
});
