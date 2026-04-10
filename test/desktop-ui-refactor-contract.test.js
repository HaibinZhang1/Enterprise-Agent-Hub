import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

async function read(relativePath) {
  return readFile(resolve(repoRoot, relativePath), 'utf8');
}

async function assertFileExists(relativePath) {
  await access(resolve(repoRoot, relativePath));
}

const requiredRefactorModules = [
  'apps/desktop/ui/core/api.js',
  'apps/desktop/ui/core/data-refresh.js',
  'apps/desktop/ui/core/events.js',
  'apps/desktop/ui/core/page-lifecycle.js',
  'apps/desktop/ui/core/page-registry.js',
  'apps/desktop/ui/core/router.js',
  'apps/desktop/ui/core/store.js',
  'apps/desktop/ui/components/dialogs.js',
  'apps/desktop/ui/components/nav.js',
  'apps/desktop/ui/components/preview-panel.js',
  'apps/desktop/ui/components/states.js',
  'apps/desktop/ui/components/topbar.js',
  'apps/desktop/ui/features/auth-session.js',
  'apps/desktop/ui/features/management.js',
  'apps/desktop/ui/features/market.js',
  'apps/desktop/ui/features/my-skill.js',
  'apps/desktop/ui/features/notifications.js',
  'apps/desktop/ui/features/projects.js',
  'apps/desktop/ui/features/review.js',
  'apps/desktop/ui/features/settings.js',
  'apps/desktop/ui/features/tools.js',
];

test('desktop refactor scaffolding keeps dedicated core, component, and feature modules on disk', async () => {
  await Promise.all(requiredRefactorModules.map((relativePath) => assertFileExists(relativePath)));
});

test('desktop router, registry, and shell component modules keep central page and shell contracts explicit', async () => {
  const [router, pageRegistry, nav, topbar, api] = await Promise.all([
    read('apps/desktop/ui/core/router.js'),
    read('apps/desktop/ui/core/page-registry.js'),
    read('apps/desktop/ui/components/nav.js'),
    read('apps/desktop/ui/components/topbar.js'),
    read('apps/desktop/ui/core/api.js'),
  ]);

  assert.match(router, /window\.location\.hash/);
  assert.match(router, /hashchange/);
  assert.match(router, /resolvePageRoute/);

  assert.match(pageRegistry, /badgeKey/);
  assert.match(pageRegistry, /searchTarget/);
  assert.match(pageRegistry, /section:\s*'footer'/);
  assert.match(pageRegistry, /requiresAuth:\s*true/);

  assert.match(nav, /getVisiblePages/);
  assert.match(nav, /data-route=/);
  assert.match(nav, /nav-item__badge/);

  assert.match(topbar, /data-search-form=/);
  assert.match(topbar, /data-open-auth=/);
  assert.match(topbar, /data-route="notifications"/);

  assert.match(api, /classifyResponse/);
  assert.match(api, /html_response/);
  assert.match(api, /unauthenticated/);
  assert.match(api, /forbidden/);
});

test('desktop feature modules keep remote calls inside app api helpers instead of raw fetch in page code', async () => {
  const featureFiles = requiredRefactorModules.filter((relativePath) => relativePath.includes('/features/'));
  for (const relativePath of featureFiles) {
    const source = await read(relativePath);
    assert.doesNotMatch(source, /\bfetch\s*\(/, relativePath);
    assert.match(source, /app\.api\.request\(/, relativePath);
  }
});

test('desktop notification and realtime helpers retain explicit read/read-all and event invalidation hooks', async () => {
  const [notifications, events, refresh] = await Promise.all([
    read('apps/desktop/ui/features/notifications.js'),
    read('apps/desktop/ui/core/events.js'),
    read('apps/desktop/ui/core/data-refresh.js'),
  ]);

  assert.match(notifications, /\/api\/notifications\/\$\{encodeURIComponent\(notificationId\)\}\/read/);
  assert.match(notifications, /\/api\/notifications\/read-all/);
  assert.match(events, /notify\.badge\.updated/);
  assert.match(events, /review\.queue\.updated/);
  assert.match(events, /refresh\.invalidate\(\['home', 'notifications'\]/);
  assert.match(events, /refresh\.invalidate\(\['home', 'review'\]/);
  assert.match(refresh, /dirtyPages/);
  assert.match(refresh, /deferred-refresh/);
});
