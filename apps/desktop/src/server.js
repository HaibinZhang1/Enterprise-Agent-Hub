// @ts-nocheck
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLocalSqliteStore } from './local-sqlite-store.js';

const moduleFile = fileURLToPath(import.meta.url);
const packageRoot = dirname(moduleFile);
const uiRoot = resolve(packageRoot, '..', 'ui');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on('error', rejectBody);
  });
}

function routeSegments(pathname) {
  return pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
}

export async function createDesktopServer(config = {}) {
  const port = Number(config.port ?? process.env.DESKTOP_PORT ?? 4174);
  const apiBaseUrl =
    config.apiBaseUrl ??
    process.env.DESKTOP_API_BASE_URL ??
    process.env.API_BASE_URL ??
    'http://127.0.0.1:8787';
  const sqlitePath = config.sqlitePath ?? process.env.DESKTOP_SQLITE_PATH ?? resolve(packageRoot, '..', '.local', 'desktop.db');
  const store = createLocalSqliteStore({ sqlitePath });
  let sessionState = null;

  async function proxyJson(pathname, options = {}) {
    const headers = {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    };
    if (sessionState?.sessionId) {
      headers.authorization = `Bearer ${sessionState.sessionId}`;
    }
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  async function proxyBinary(pathname, options = {}) {
    const headers = {
      ...(options.headers ?? {}),
    };
    if (sessionState?.sessionId) {
      headers.authorization = `Bearer ${sessionState.sessionId}`;
    }
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      method: options.method ?? 'GET',
      headers,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  const staticFiles = new Map([
    ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
    ['/app.js', { file: 'app.js', type: 'application/javascript; charset=utf-8' }],
    ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
    ['/style.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
  ]);
  const proxyRoutes = new Map([
    ['/api/market', '/api/market'],
    ['/api/notifications', '/api/notifications'],
    ['/api/users', '/api/users'],
    ['/api/skills/my', '/api/skills/my'],
    ['/api/skills/manageable', '/api/skills/manageable'],
    ['/api/reviews', '/api/reviews'],
  ]);

  await store.init();
  sessionState = store.getState('session')?.payload ?? null;

  function requireSession(response) {
    if (!sessionState?.sessionId) {
      sendJson(response, 401, { ok: false, reason: 'session_required' });
      return false;
    }
    return true;
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);

    try {
      const staticAsset = staticFiles.get(url.pathname);
      if (request.method === 'GET' && staticAsset) {
        const body = await readFile(resolve(uiRoot, staticAsset.file), 'utf8');
        response.writeHead(200, { 'content-type': staticAsset.type, 'cache-control': 'no-store' });
        response.end(body);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          service: '@enterprise-agent-hub/desktop',
          port,
          apiBaseUrl,
          sqlitePath,
          cacheEntries: store.listCaches().length,
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/session') {
        sendJson(response, 200, {
          ok: true,
          session: sessionState,
          lastUser: store.getState('last-user')?.payload ?? null,
          caches: store.listCaches(),
        });
        return;
      }

      const segments = routeSegments(url.pathname);

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await parseBody(request);
        const result = await proxyJson('/api/auth/login', {
          method: 'POST',
          body: {
            username: body.username,
            password: body.password,
            deviceLabel: body.deviceLabel ?? 'Desktop Dev Shell',
          },
          headers: {},
        });
        if (!result.data.ok) {
          sendJson(response, result.status, result.data);
          return;
        }
        sessionState = {
          sessionId: result.data.sessionId,
          user: result.data.user,
        };
        store.saveState('session', sessionState);
        store.saveState('last-user', result.data.user);
        sendJson(response, 200, { ok: true, session: sessionState, user: result.data.user });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/packages/upload') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson('/api/packages/upload', {
          method: 'POST',
          body,
        });
        if (result.data.ok) {
          store.saveCache(`/api/packages/${result.data.report.packageId}/report`, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'report') {
        if (!requireSession(response)) {
          return;
        }
        const result = await proxyJson(url.pathname);
        if (result.data.ok) {
          store.saveCache(url.pathname, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'files' && segments.length >= 5) {
        if (!requireSession(response)) {
          return;
        }
        const result = await proxyBinary(url.pathname);
        response.writeHead(result.status, {
          'content-type': result.contentType,
          'cache-control': 'no-store',
          ...(result.contentDisposition ? { 'content-disposition': result.contentDisposition } : {}),
        });
        response.end(result.body);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/reviews/submit') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson('/api/reviews/submit', {
          method: 'POST',
          body,
        });
        if (result.data.ok) {
          store.saveCache('/api/reviews', result.data.ticket);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'claim') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'approve') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        sessionState = null;
        store.deleteState('session');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/events') {
        if (!requireSession(response)) {
          return;
        }
        const upstream = await fetch(`${apiBaseUrl}/api/notifications/stream?sessionId=${encodeURIComponent(sessionState.sessionId)}`);
        if (!upstream.ok || !upstream.body) {
          sendJson(response, upstream.status, { ok: false, reason: 'sse_proxy_failed' });
          return;
        }
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        });
        const reader = upstream.body.getReader();
        const abort = async () => {
          await reader.cancel();
          response.end();
        };
        request.on('close', abort);
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          response.write(Buffer.from(value));
        }
        response.end();
        return;
      }

      if (request.method === 'GET' && proxyRoutes.has(url.pathname)) {
        if (!requireSession(response)) {
          return;
        }
        const upstreamPath = proxyRoutes.get(url.pathname);
        const query = url.search ? url.search : '';
        const result = await proxyJson(`${upstreamPath}${query}`);
        if (result.data.ok) {
          store.saveCache(url.pathname + query, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      sendJson(response, 404, { ok: false, reason: 'not_found' });
    } catch (error) {
      sendJson(response, 500, { ok: false, reason: error instanceof Error ? error.message : 'unknown_error' });
    }
  });

  return Object.freeze({ server, store, config: { port, apiBaseUrl, sqlitePath } });
}

export async function startDesktopServer(config = {}) {
  const created = await createDesktopServer(config);
  await new Promise((resolvePromise) => {
    created.server.listen(created.config.port, '127.0.0.1', resolvePromise);
  });
  console.log(JSON.stringify({ ok: true, service: '@enterprise-agent-hub/desktop', port: created.config.port, sqlitePath: created.config.sqlitePath }));
  return created;
}

if (process.argv[1] && resolve(process.argv[1]) === moduleFile) {
  startDesktopServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
