import assert from 'node:assert/strict';
import test from 'node:test';

import { canAccessPage, getSafeFallback } from '../apps/desktop/ui/core/page-registry.js';
import { parseHashRoute, resolvePageRoute } from '../apps/desktop/ui/core/router.js';

const employeeSession = {
  user: {
    username: 'worker',
    roleCode: 'employee_lv6',
  },
};

const adminSession = {
  user: {
    username: 'admin',
    roleCode: 'system_admin_lv1',
  },
};

test('desktop router normalizes empty and unknown hash routes to home', () => {
  assert.deepEqual(parseHashRoute(''), { pageId: 'home' });
  assert.equal(resolvePageRoute('', null), 'home');
  assert.equal(resolvePageRoute('#unknown-page', null), 'home');
});

test('desktop router redirects unauthorized protected routes to a safe fallback', () => {
  assert.equal(canAccessPage('review', null), false);
  assert.equal(canAccessPage('management', employeeSession), false);
  assert.equal(canAccessPage('review', adminSession), true);
  assert.equal(getSafeFallback('review', null), 'home');
  assert.equal(getSafeFallback('management', employeeSession), 'home');
  assert.equal(resolvePageRoute('#review', null), 'home');
  assert.equal(resolvePageRoute('#management', employeeSession), 'home');
  assert.equal(resolvePageRoute('#review', adminSession), 'review');
});
