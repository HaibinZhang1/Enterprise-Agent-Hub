import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDesktopServer } from '../apps/desktop/src/server.js';

async function listen(server, host = '127.0.0.1') {
  return new Promise((resolvePromise) => {
    server.listen(0, host, () => resolvePromise(server.address()));
  });
}

async function close(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}


test('desktop shell bootstraps sqlite-backed local environment before api wiring', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-shell-'));
  const sqlitePath = join(dir, 'desktop.db');
  const created = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    assert.equal(created.config.port, 0);
    assert.equal(created.config.sqlitePath, sqlitePath);
    assert.equal(created.store.listCaches().length, 0);

    const address = await listen(created.server);
    assert.equal(typeof address, 'object');

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const healthResponse = await fetch(`${baseUrl}/health`);
    const health = await healthResponse.json();
    const sessionResponse = await fetch(`${baseUrl}/api/session`);
    const session = await sessionResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
    assert.equal(health.sqlitePath, sqlitePath);
    assert.equal(health.apiBaseUrl, 'http://127.0.0.1:65530');

    assert.equal(sessionResponse.status, 200);
    assert.equal(session.ok, true);
    assert.equal(session.session, null);
    assert.equal(session.lastUser, null);
    assert.deepEqual(session.caches, []);
    assert.equal(Object.hasOwn(session, 'sqlitePath'), false);
  } finally {
    await close(created.server);
  }
});

test('desktop shell keeps sqlite path in /health while /api/session stays limited to session and cache state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-shell-session-'));
  const sqlitePath = join(dir, 'desktop.db');
  const created = await createDesktopServer({
    port: 0,
    sqlitePath,
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const address = await new Promise((resolvePromise) => {
      created.server.listen(0, '127.0.0.1', () => resolvePromise(created.server.address()));
    });
    assert.equal(typeof address, 'object');

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const [healthResponse, sessionResponse] = await Promise.all([
      fetch(`${baseUrl}/health`),
      fetch(`${baseUrl}/api/session`),
    ]);
    const health = await healthResponse.json();
    const session = await sessionResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.equal(sessionResponse.status, 200);
    assert.equal(health.sqlitePath, sqlitePath);
    assert.equal(session.ok, true);
    assert.equal(session.session, null);
    assert.deepEqual(session.caches, []);
    assert.equal('sqlitePath' in session, false);
  } finally {
    await close(created.server);
  }
});
