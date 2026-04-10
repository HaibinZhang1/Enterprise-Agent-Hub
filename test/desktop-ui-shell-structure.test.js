import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';

const pageFiles = [
  'home',
  'market',
  'my-skill',
  'review',
  'management',
  'tools',
  'projects',
  'notifications',
  'settings',
].map((name) => `apps/desktop/ui/pages/${name}.js`);

const styleFiles = ['tokens', 'shell', 'pages', 'states'].map((name) => `apps/desktop/ui/styles/${name}.css`);

test('desktop index exposes shell scaffolding instead of legacy stacked grid markers', async () => {
  const html = await readFile('apps/desktop/ui/index.html', 'utf8');
  assert.match(html, /id="nav-panel"/);
  assert.match(html, /id="topbar"/);
  assert.match(html, /id="page-outlet"/);
  assert.doesNotMatch(html, /local-control-grid/);
  assert.doesNotMatch(html, /dashboard-grid/);
  assert.doesNotMatch(html, /workbench-grid/);
});

test('desktop bootstrap entry delegates to core boot module', async () => {
  const appJs = await readFile('apps/desktop/ui/app.js', 'utf8');
  assert.match(appJs, /core\/boot\.js/);
  assert.doesNotMatch(appJs, /\/api\//);
});

test('desktop refactor ships planned page and style module layout without raw api endpoints in pages', async () => {
  for (const file of [...pageFiles, ...styleFiles]) {
    await access(file);
  }

  for (const file of pageFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\/api\//, file);
  }
});
