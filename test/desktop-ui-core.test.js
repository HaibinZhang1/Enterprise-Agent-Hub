import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError, classifyResponse } from '../apps/desktop/ui/core/api.js';
import { canAccessPage, getSafeFallback } from '../apps/desktop/ui/core/page-registry.js';
import { parseHashRoute, resolveNavigationTarget, resolvePageRoute } from '../apps/desktop/ui/core/router.js';

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

test('desktop router records a pending protected route intent for guest my-skill access', () => {
  const resolved = resolveNavigationTarget('my-skill', null);
  assert.equal(resolved.pageId, 'home');
  assert.equal(resolved.blocked, true);
  assert.equal(resolved.pendingIntent?.type, 'route');
  assert.equal(resolved.pendingIntent?.pageId, 'my-skill');
});

test('desktop api classifier distinguishes html, auth, forbidden, business, and network-safe payload classes', async () => {
  await assert.rejects(
    classifyResponse(new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } })),
    (error) => error instanceof ApiError && error.kind === 'html_response',
  );

  await assert.rejects(
    classifyResponse(new Response(JSON.stringify({ ok: false, reason: 'expired' }), { status: 401, headers: { 'content-type': 'application/json' } })),
    (error) => error instanceof ApiError && error.kind === 'unauthenticated',
  );

  await assert.rejects(
    classifyResponse(new Response(JSON.stringify({ ok: false, reason: 'denied' }), { status: 403, headers: { 'content-type': 'application/json' } })),
    (error) => error instanceof ApiError && error.kind === 'forbidden',
  );

  await assert.rejects(
    classifyResponse(new Response(JSON.stringify({ ok: false, reason: 'broken' }), { status: 500, headers: { 'content-type': 'application/json' } })),
    (error) => error instanceof ApiError && error.kind === 'business_error',
  );

  const payload = await classifyResponse(
    new Response(JSON.stringify({ ok: true, value: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  assert.equal(payload.value, 1);
});
