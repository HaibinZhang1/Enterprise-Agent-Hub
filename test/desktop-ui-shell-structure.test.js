import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';

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

test('desktop index exposes shell scaffolding without legacy-shell-source or home-form auth dependency', async () => {
  const [html, boot] = await Promise.all([
    readFile('apps/desktop/ui/index.html', 'utf8'),
    readFile('apps/desktop/ui/core/boot.js', 'utf8'),
  ]);
  assert.match(html, /id="nav-panel"/);
  assert.match(html, /id="topbar"/);
  assert.match(html, /id="page-outlet"/);
  assert.match(html, /id="dialog-host"/);
  assert.doesNotMatch(html, /legacy-shell-source/);
  assert.doesNotMatch(html, /id="login-form"/);
  assert.doesNotMatch(boot, /focusLoginEntry/);
  assert.doesNotMatch(boot, /legacy-shell-source/);
});

test('desktop bootstrap entry delegates to core boot module', async () => {
  const appJs = await readFile('apps/desktop/ui/app.js', 'utf8');
  assert.match(appJs, /core\/boot\.js/);
  assert.doesNotMatch(appJs, /\/api\//);
});

test('desktop continuation ships page, style, and protected-intent modules without raw api endpoints in pages', async () => {
  await access('apps/desktop/ui/core/protected-intent.js');

  for (const file of [...pageFiles, ...styleFiles]) {
    await access(file);
  }

  for (const file of pageFiles) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\/api\//, file);
  }
});
