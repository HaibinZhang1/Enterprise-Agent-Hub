import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { createDesktopServer } from '../apps/desktop/src/server.js';

const repoRoot = resolve(import.meta.dirname, '..');

function listen(server, host = '127.0.0.1') {
  return new Promise((resolvePromise) => {
    server.listen(0, host, () => resolvePromise(server.address()));
  });
}

async function close(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

async function readJson(response) {
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  return response.json();
}

async function readText(response) {
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  return response.text();
}

test('desktop release smoke covers login, My Skill, market, notifications, and configured API URL', async () => {
  const upstreamRequests = [];
  const fakeApi = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    upstreamRequests.push({
      method: request.method,
      path: url.pathname,
      search: url.search,
      authorization: request.headers.authorization ?? null,
    });

    response.setHeader('content-type', 'application/json; charset=utf-8');

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      response.end(
        JSON.stringify({
          ok: true,
          sessionId: 'session-desktop-release-smoke',
          user: { userId: 'admin-1', username: 'admin' },
        }),
      );
      return;
    }

    if (request.headers.authorization !== 'Bearer session-desktop-release-smoke') {
      response.statusCode = 401;
      response.end(JSON.stringify({ ok: false, reason: 'missing_session' }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/skills/my') {
      response.end(JSON.stringify({ ok: true, skills: [{ skillId: 'skill-installed-1', title: 'Installed Skill' }] }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/market') {
      response.end(JSON.stringify({ ok: true, results: [{ skillId: 'skill-market-1', title: 'Market Skill' }] }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/notifications') {
      response.end(JSON.stringify({ ok: true, items: [{ id: 'notice-1', title: 'Ready' }] }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, reason: 'not_found' }));
  });

  const fakeApiAddress = await listen(fakeApi);
  assert.equal(typeof fakeApiAddress, 'object');
  const apiBaseUrl = `http://127.0.0.1:${fakeApiAddress.port}`;

  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-release-read-flow-'));
  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath: join(tempDir, 'desktop.db'),
    apiBaseUrl,
  });

  try {
    const desktopAddress = await listen(desktop.server);
    assert.equal(typeof desktopAddress, 'object');
    const desktopBaseUrl = `http://127.0.0.1:${desktopAddress.port}`;

    const shellHtml = await fetch(`${desktopBaseUrl}/`).then((response) => response.text());
    const health = await readJson(await fetch(`${desktopBaseUrl}/health`));
    assert.equal(health.ok, true);
    assert.equal(health.apiBaseUrl, apiBaseUrl);
    assert.match(shellHtml, /id="nav-panel"/);
    assert.match(shellHtml, /id="topbar"/);
    assert.match(shellHtml, /id="page-outlet"/);
    assert.match(shellHtml, /id="dialog-host"/);
    assert.doesNotMatch(shellHtml, /sqlite path/i);
    assert.doesNotMatch(shellHtml, /DESKTOP_SQLITE_PATH/);
    assert.doesNotMatch(shellHtml, /legacy-shell-source/);

    const beforeLogin = await readJson(await fetch(`${desktopBaseUrl}/api/skills/my`));
    assert.deepEqual(beforeLogin, { ok: false, reason: 'session_required' });

    const login = await readJson(
      await fetch(`${desktopBaseUrl}/api/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin', deviceLabel: 'Desktop Release Smoke' }),
      }),
    );
    assert.equal(login.ok, true);
    assert.equal(login.user.username, 'admin');

    const [mySkills, market, notifications] = await Promise.all([
      fetch(`${desktopBaseUrl}/api/skills/my`).then(readJson),
      fetch(`${desktopBaseUrl}/api/market?query=market`).then(readJson),
      fetch(`${desktopBaseUrl}/api/notifications`).then(readJson),
    ]);

    assert.equal(mySkills.skills[0].skillId, 'skill-installed-1');
    assert.equal(market.results[0].skillId, 'skill-market-1');
    assert.equal(notifications.items[0].id, 'notice-1');
    assert.deepEqual(
      upstreamRequests
        .filter((entry) => ['/api/skills/my', '/api/market', '/api/notifications'].includes(entry.path))
        .map((entry) => entry.authorization),
      [
        'Bearer session-desktop-release-smoke',
        'Bearer session-desktop-release-smoke',
        'Bearer session-desktop-release-smoke',
      ],
    );
  } finally {
    await close(desktop.server);
    await close(fakeApi);
  }
});

test('desktop release shell keeps publish-review boundary modules while hiding SQLite path details from product HTML', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desktop-release-shell-'));
  const desktop = await createDesktopServer({
    port: 0,
    sqlitePath: join(tempDir, 'desktop.db'),
    apiBaseUrl: 'http://127.0.0.1:65530',
  });

  try {
    const desktopAddress = await listen(desktop.server);
    assert.equal(typeof desktopAddress, 'object');
    const desktopBaseUrl = `http://127.0.0.1:${desktopAddress.port}`;

    const [html, mySkillPage, reviewPage, managementPage, dialogs] = await Promise.all([
      readText(await fetch(`${desktopBaseUrl}/`)),
      readFile(resolve(repoRoot, 'apps/desktop/ui/pages/my-skill.js'), 'utf8'),
      readFile(resolve(repoRoot, 'apps/desktop/ui/pages/review.js'), 'utf8'),
      readFile(resolve(repoRoot, 'apps/desktop/ui/pages/management.js'), 'utf8'),
      readFile(resolve(repoRoot, 'apps/desktop/ui/components/dialogs.js'), 'utf8'),
    ]);

    assert.match(html, /id="nav-panel"/);
    assert.match(html, /id="topbar"/);
    assert.match(html, /id="page-outlet"/);
    assert.match(html, /id="dialog-host"/);
    assert.doesNotMatch(html, /DESKTOP_SQLITE_PATH/);
    assert.doesNotMatch(html, /sqlite path/i);
    assert.match(mySkillPage, /Publish Workbench/);
    assert.match(reviewPage, /Review/);
    assert.match(managementPage, /部门管理/);
    assert.match(managementPage, /用户管理/);
    assert.match(managementPage, /Skill 管理/);
    assert.match(dialogs, /data-login-form=/);
  } finally {
    await close(desktop.server);
  }
});
