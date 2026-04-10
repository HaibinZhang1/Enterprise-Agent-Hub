import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

async function read(path) {
  return readFile(resolve(repoRoot, path), 'utf8');
}

async function exists(path) {
  try {
    await access(resolve(repoRoot, path), fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

test('desktop refactor ships the planned shell/page/style module layout', async () => {
  const requiredFiles = [
    'apps/desktop/ui/core/router.js',
    'apps/desktop/ui/core/page-registry.js',
    'apps/desktop/ui/core/api.js',
    'apps/desktop/ui/core/data-refresh.js',
    'apps/desktop/ui/core/events.js',
    'apps/desktop/ui/core/page-lifecycle.js',
    'apps/desktop/ui/core/store.js',
    'apps/desktop/ui/components/nav.js',
    'apps/desktop/ui/components/topbar.js',
    'apps/desktop/ui/components/dialogs.js',
    'apps/desktop/ui/components/states.js',
    'apps/desktop/ui/components/preview-panel.js',
    'apps/desktop/ui/features/auth-session.js',
    'apps/desktop/ui/features/market.js',
    'apps/desktop/ui/features/my-skill.js',
    'apps/desktop/ui/features/review.js',
    'apps/desktop/ui/features/management.js',
    'apps/desktop/ui/features/tools.js',
    'apps/desktop/ui/features/projects.js',
    'apps/desktop/ui/features/notifications.js',
    'apps/desktop/ui/features/settings.js',
    'apps/desktop/ui/pages/home.js',
    'apps/desktop/ui/pages/market.js',
    'apps/desktop/ui/pages/my-skill.js',
    'apps/desktop/ui/pages/review.js',
    'apps/desktop/ui/pages/management.js',
    'apps/desktop/ui/pages/tools.js',
    'apps/desktop/ui/pages/projects.js',
    'apps/desktop/ui/pages/notifications.js',
    'apps/desktop/ui/pages/settings.js',
    'apps/desktop/ui/styles/tokens.css',
    'apps/desktop/ui/styles/shell.css',
    'apps/desktop/ui/styles/pages.css',
    'apps/desktop/ui/styles/states.css',
  ];

  const missing = [];
  for (const file of requiredFiles) {
    if (!(await exists(file))) {
      missing.push(file);
    }
  }

  assert.deepEqual(missing, []);
});

test('desktop index.html exposes shell scaffolding instead of stacked workbench sections', async () => {
  const html = await read('apps/desktop/ui/index.html');

  assert.match(html, /data-shell-nav=["']true["']/);
  assert.match(html, /data-shell-topbar=["']true["']/);
  assert.match(html, /data-page-outlet=["']true["']/);
  assert.match(html, /data-dialog-host=["']true["']/);
  assert.match(html, /data-preview-host=["']true["']/);

  assert.doesNotMatch(html, /id=["']tools-output["']/);
  assert.doesNotMatch(html, /id=["']projects-output["']/);
  assert.doesNotMatch(html, /id=["']settings-output["']/);
  assert.doesNotMatch(html, /id=["']market-output["']/);
  assert.doesNotMatch(html, /id=["']my-skills-output["']/);
  assert.doesNotMatch(html, /id=["']review-queue-output["']/);
  assert.doesNotMatch(html, /id=["']management-output["']/);
  assert.doesNotMatch(html, /class=["'][^"']*dashboard-grid[^"']*["']/);
  assert.doesNotMatch(html, /class=["'][^"']*local-control-grid[^"']*["']/);
});

test('desktop app bootstrap delegates domain logic to modules instead of owning endpoints directly', async () => {
  const app = await read('apps/desktop/ui/app.js');

  assert.match(app, /from ['"]\.\/core\//);
  assert.match(app, /from ['"]\.\/components\//);
  assert.match(app, /from ['"]\.\/features\//);
  assert.doesNotMatch(app, /\/api\//);
  assert.ok(app.split(/\r?\n/).length < 350, 'expected bootstrap-oriented app.js with limited orchestration');
});

test('desktop pages and components keep raw api endpoints out of presentation modules', async () => {
  const presentationFiles = [
    'apps/desktop/ui/components/nav.js',
    'apps/desktop/ui/components/topbar.js',
    'apps/desktop/ui/components/dialogs.js',
    'apps/desktop/ui/components/states.js',
    'apps/desktop/ui/components/preview-panel.js',
    'apps/desktop/ui/pages/home.js',
    'apps/desktop/ui/pages/market.js',
    'apps/desktop/ui/pages/my-skill.js',
    'apps/desktop/ui/pages/review.js',
    'apps/desktop/ui/pages/management.js',
    'apps/desktop/ui/pages/tools.js',
    'apps/desktop/ui/pages/projects.js',
    'apps/desktop/ui/pages/notifications.js',
    'apps/desktop/ui/pages/settings.js',
  ];

  for (const file of presentationFiles) {
    const source = await read(file);
    assert.doesNotMatch(source, /\/api\//, `${file} should delegate endpoint access to feature/core modules`);
  }
});

test('desktop feature modules centralize the expected route contracts', async () => {
  const featureFiles = [
    'apps/desktop/ui/features/auth-session.js',
    'apps/desktop/ui/features/market.js',
    'apps/desktop/ui/features/my-skill.js',
    'apps/desktop/ui/features/review.js',
    'apps/desktop/ui/features/management.js',
    'apps/desktop/ui/features/tools.js',
    'apps/desktop/ui/features/projects.js',
    'apps/desktop/ui/features/notifications.js',
    'apps/desktop/ui/features/settings.js',
  ];

  let endpointCount = 0;
  for (const file of featureFiles) {
    const source = await read(file);
    endpointCount += countMatches(source, /\/api\//g);
  }

  assert.ok(endpointCount >= 12, 'expected feature modules to own the desktop api route contracts');
});
