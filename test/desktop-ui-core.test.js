import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient, ApiError, classifyResponse } from '../apps/desktop/ui/core/api.js';
import { createEventsController } from '../apps/desktop/ui/core/events.js';
import { getDefaultPage, getSafeFallback, getVisiblePages } from '../apps/desktop/ui/core/page-registry.js';
import { parseHashRoute, resolvePageRoute } from '../apps/desktop/ui/core/router.js';
import { createStore } from '../apps/desktop/ui/core/store.js';
import { createAuthFeature } from '../apps/desktop/ui/features/auth-session.js';
import { createNotificationsFeature } from '../apps/desktop/ui/features/notifications.js';

function makeSession(roleCode) {
  return roleCode
    ? { user: { userId: `${roleCode}-1`, username: roleCode, roleCode } }
    : null;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

test('desktop page registry exposes role-aware navigation and safe fallbacks', () => {
  const guestPages = getVisiblePages(null).map((entry) => entry.id);
  const userPages = getVisiblePages(makeSession('member')).map((entry) => entry.id);
  const adminPages = getVisiblePages(makeSession('system_admin')).map((entry) => entry.id);

  assert.deepEqual(guestPages, ['home', 'market', 'my-skill', 'tools', 'projects', 'notifications', 'settings']);
  assert.deepEqual(userPages, ['home', 'market', 'my-skill', 'tools', 'projects', 'notifications', 'settings']);
  assert.deepEqual(adminPages, ['home', 'market', 'my-skill', 'review', 'management', 'tools', 'projects', 'notifications', 'settings']);

  assert.equal(getDefaultPage(null), 'home');
  assert.equal(getSafeFallback('review', null), 'home');
  assert.equal(getSafeFallback('management', makeSession('member')), 'home');
  assert.equal(getSafeFallback('my-skill', null), 'home');
});

test('desktop router normalizes empty and unauthorized hash routes', () => {
  assert.deepEqual(parseHashRoute(''), { pageId: 'home' });
  assert.deepEqual(parseHashRoute('#review?tab=queue'), { pageId: 'review' });
  assert.equal(resolvePageRoute('', null), 'home');
  assert.equal(resolvePageRoute('#review', makeSession('member')), 'home');
  assert.equal(resolvePageRoute('#management', makeSession('system_admin')), 'management');
});

test('desktop api response classifier distinguishes auth, forbidden, html, and generic failures', async () => {
  await assert.rejects(
    () => classifyResponse(jsonResponse({ ok: false, reason: 'session_required' }, { status: 401 })),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'unauthenticated');
      assert.equal(error.status, 401);
      return true;
    },
  );

  await assert.rejects(
    () => classifyResponse(jsonResponse({ ok: false, reason: 'forbidden' }, { status: 403 })),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'forbidden');
      assert.equal(error.status, 403);
      return true;
    },
  );

  await assert.rejects(
    () =>
      classifyResponse(
        new Response('<!doctype html><html><body>bad upstream</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
      ),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'html_response');
      return true;
    },
  );

  await assert.rejects(
    () => classifyResponse(new Response('boom', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'api_error');
      assert.equal(error.status, 500);
      return true;
    },
  );

  const payload = await classifyResponse(jsonResponse({ ok: true, results: [{ skillId: 'market-skill' }] }));
  assert.deepEqual(payload, { ok: true, results: [{ skillId: 'market-skill' }] });
});

test('desktop api client reports network failures through normalized global errors', async () => {
  const errors = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1');
  };

  try {
    const client = createApiClient({
      onGlobalError(error) {
        errors.push(error);
      },
    });

    await assert.rejects(() => client.request('/api/market'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'network_error');
      return true;
    });

    assert.equal(errors.length, 1);
    assert.equal(errors[0].kind, 'network_error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('desktop auth feature refreshes session state on load, login, and logout fallback', async () => {
  const requested = [];
  const sessions = [];
  let failLogout = false;
  const auth = createAuthFeature({
    api: {
      async request(path, options = {}) {
        requested.push({ path, options });
        if (path === '/api/session') {
          return { ok: true, session: null };
        }
        if (path === '/api/login') {
          return { ok: true, session: makeSession('member') };
        }
        if (path === '/api/logout') {
          if (failLogout) {
            throw new Error('logout upstream failed');
          }
          return { ok: true };
        }
        throw new Error(`Unexpected path: ${path}`);
      },
    },
    setSession(session) {
      sessions.push(session);
    },
  });

  await auth.loadSession();
  await auth.login({ username: 'demo', password: 'demo' });
  failLogout = true;
  await assert.rejects(() => auth.logout(), /logout upstream failed/);

  assert.deepEqual(
    requested.map((entry) => entry.path),
    ['/api/session', '/api/login', '/api/logout'],
  );
  assert.deepEqual(sessions, [null, makeSession('member'), null]);
});

test('desktop notifications feature derives fallback badge counts and keeps mutation routes explicit', async () => {
  const requested = [];
  const feature = createNotificationsFeature({
    api: {
      async request(path, options = {}) {
        requested.push({ path, options });
        if (path === '/api/notifications') {
          return {
            ok: true,
            items: [
              { id: 'n1', title: 'Unread 1', readAt: null },
              { id: 'n2', title: 'Read', readAt: '2026-04-10T00:00:00.000Z' },
              { id: 'n3', title: 'Unread 2', readAt: null },
            ],
          };
        }
        return { ok: true };
      },
    },
  });

  const loaded = await feature.loadNotifications();
  await feature.markRead('n1');
  await feature.readAll();

  assert.equal(loaded.badges.unreadCount, 2);
  assert.deepEqual(
    requested.map((entry) => entry.path),
    ['/api/notifications', '/api/notifications/n1/read', '/api/notifications/read-all'],
  );
  assert.equal(requested[1].options.method, 'POST');
  assert.equal(requested[2].options.method, 'POST');
});

test('desktop realtime events synchronize notification and review badges through centralized invalidation', async () => {
  const originalEventSource = globalThis.EventSource;
  const createdSources = [];

  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.listeners = new Map();
      this.closed = false;
      this.onopen = null;
      this.onerror = null;
      createdSources.push(this);
    }

    addEventListener(eventName, listener) {
      const listeners = this.listeners.get(eventName) ?? [];
      listeners.push(listener);
      this.listeners.set(eventName, listeners);
    }

    async emit(eventName, payload) {
      const listeners = this.listeners.get(eventName) ?? [];
      for (const listener of listeners) {
        await listener({ data: JSON.stringify(payload) });
      }
    }

    close() {
      this.closed = true;
    }
  }

  globalThis.EventSource = FakeEventSource;

  try {
    const invalidations = [];
    const store = createStore({
      eventFeed: [],
      notificationBadge: 0,
      reviewBadge: 0,
      realtime: { status: 'idle', message: 'Idle' },
    });
    const controller = createEventsController({
      store,
      refresh: {
        async invalidate(pageIds, reason) {
          invalidations.push({ pageIds, reason });
        },
      },
      getSession() {
        return makeSession('system_admin');
      },
    });

    controller.connect();
    assert.equal(createdSources.length, 1);
    assert.equal(createdSources[0].url, '/api/events');

    createdSources[0].onopen?.();
    assert.deepEqual(store.getState().realtime, {
      status: 'online',
      message: 'Realtime notifications connected.',
    });

    await createdSources[0].emit('notify.badge.updated', {
      unreadCount: 3,
      items: [{ id: 'n1', readAt: null }, { id: 'n2', readAt: null }, { id: 'n3', readAt: null }],
    });
    await createdSources[0].emit('review.queue.updated', {
      queue: {
        todo: [{ ticketId: 't1' }, { ticketId: 't2' }],
        inProgress: [],
        done: [],
      },
    });

    assert.equal(store.getState().notificationBadge, 3);
    assert.equal(store.getState().reviewBadge, 2);
    assert.deepEqual(
      invalidations,
      [
        { pageIds: ['home', 'notifications'], reason: 'notify.badge.updated' },
        { pageIds: ['home', 'review'], reason: 'review.queue.updated' },
      ],
    );
    assert.equal(store.getState().eventFeed.length, 2);

    createdSources[0].onerror?.();
    assert.deepEqual(store.getState().realtime, {
      status: 'degraded',
      message: 'Realtime connection interrupted. Waiting for reconnect…',
    });

    controller.close();
    assert.equal(createdSources[0].closed, true);
  } finally {
    globalThis.EventSource = originalEventSource;
  }
});

test('desktop realtime stays idle and disconnected when no session is present', () => {
  const originalEventSource = globalThis.EventSource;
  let constructed = false;
  globalThis.EventSource = class {
    constructor() {
      constructed = true;
    }
  };

  try {
    const store = createStore({
      eventFeed: [],
      notificationBadge: 0,
      reviewBadge: 0,
      realtime: { status: 'connecting', message: 'Connecting…' },
    });
    const controller = createEventsController({
      store,
      refresh: { async invalidate() {} },
      getSession() {
        return null;
      },
    });

    controller.connect();

    assert.equal(constructed, false);
    assert.deepEqual(store.getState().realtime, {
      status: 'idle',
      message: 'Sign in to start realtime desktop updates.',
    });
  } finally {
    globalThis.EventSource = originalEventSource;
  }
});
