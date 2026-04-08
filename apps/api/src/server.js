// @ts-nocheck
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { SSE_PAYLOAD_FIXTURE } from '@enterprise-agent-hub/contracts';

import { createMvpContext } from './create-mvp-context.js';

const moduleFile = fileURLToPath(import.meta.url);
const packageRoot = dirname(moduleFile);
const workspaceRoot = resolve(packageRoot, '..', '..', '..');

function runMigrations(databaseUrl) {
  const migrationScript = resolve(workspaceRoot, 'packages/migrations/src/run-postgres-migrations.js');
  const result = spawnSync(process.execPath, [migrationScript], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('PostgreSQL migrations failed.');
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function writeSseEvent(response, eventName, payload) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
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

function groupQueue(tickets) {
  return Object.freeze({
    todo: Object.freeze(tickets.filter((ticket) => ticket.status === 'todo')),
    inProgress: Object.freeze(tickets.filter((ticket) => ticket.status === 'in_progress')),
    done: Object.freeze(tickets.filter((ticket) => !['todo', 'in_progress'].includes(ticket.status))),
  });
}

function bearerSessionId(request) {
  const authorization = request.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
}

function createUnauthorized(message = 'session_required') {
  return Object.freeze({ ok: false, code: 'AUTH_SESSION_REQUIRED', reason: message });
}

export async function createApiServer(config = {}) {
  const port = Number(config.port ?? process.env.PORT ?? 8787);
  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL ?? 'postgresql://enterprise_agent_hub:enterprise_agent_hub@localhost:5432/enterprise_agent_hub';
  runMigrations(databaseUrl);
  const context = createMvpContext({ databaseUrl });

  function authorizeRequest(request) {
    const sessionId = bearerSessionId(request);
    if (!sessionId) {
      return createUnauthorized();
    }
    const session = context.authRepository.getSession(sessionId);
    if (!session) {
      return createUnauthorized('session_not_found');
    }
    const decision = context.authController.authorize({
      requestId: `authorize-${sessionId}`,
      userId: session.userId,
      tokenAuthzVersion: session.issuedAuthzVersion,
      sessionId,
    });
    if (!decision.ok) {
      return Object.freeze({ ok: false, code: decision.code, reason: decision.reason });
    }
    return Object.freeze({ ok: true, user: decision.user, session });
  }

  function requireAdmin(user) {
    return user.roleCode.includes('admin');
  }

  function canReview(user) {
    return user.roleCode.startsWith('review_admin') || user.roleCode.startsWith('system_admin');
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, service: '@enterprise-agent-hub/api', port, databaseUrl: 'configured' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await parseBody(request);
        const result = context.authController.login({
          requestId: `login-${Date.now()}`,
          username: body.username ?? '',
          password: body.password ?? '',
          clientType: 'desktop',
          deviceLabel: body.deviceLabel ?? 'Desktop Dev Shell',
        });
        if (!result.ok) {
          sendJson(response, 401, { ok: false, code: result.code, reason: result.reason });
          return;
        }
        context.notificationRepository.notify({
          userId: result.user.userId,
          category: 'auth',
          title: 'Desktop sign-in succeeded',
          body: 'Your desktop client is now connected to the live MVP service.',
        });
        sendJson(response, 200, {
          ok: true,
          user: result.user,
          sessionId: result.session.sessionId,
          session: result.session,
          accessToken: result.accessToken,
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/notifications/stream') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) {
          sendJson(response, 401, createUnauthorized());
          return;
        }
        const session = context.authRepository.getSession(sessionId);
        if (!session) {
          sendJson(response, 401, createUnauthorized('session_not_found'));
          return;
        }
        const decision = context.authController.authorize({
          requestId: `authorize-stream-${sessionId}`,
          userId: session.userId,
          tokenAuthzVersion: session.issuedAuthzVersion,
          sessionId,
        });
        if (!decision.ok) {
          sendJson(response, 401, { ok: false, code: decision.code, reason: decision.reason });
          return;
        }

        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        });
        writeSseEvent(response, SSE_PAYLOAD_FIXTURE.streams.reconnect.event, SSE_PAYLOAD_FIXTURE.streams.reconnect.payload);
        const badgeSnapshot = context.notifyService.getBadges(decision.user.userId);
        writeSseEvent(response, SSE_PAYLOAD_FIXTURE.streams.badge.event, badgeSnapshot);

        const unsubscribe = context.notificationRepository.subscribe(decision.user.userId, (event) => {
          writeSseEvent(response, event.event, event.payload ?? {});
        });

        context.notificationRepository.notify({
          userId: decision.user.userId,
          category: 'system',
          title: 'Realtime stream connected',
          body: 'The desktop client is now receiving live notification events.',
        });

        const heartbeat = setInterval(() => {
          response.write(': heartbeat\n\n');
        }, 15000);

        request.on('close', () => {
          clearInterval(heartbeat);
          unsubscribe();
          response.end();
        });
        return;
      }

      if (!url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { ok: false, reason: 'not_found' });
        return;
      }

      const authorized = authorizeRequest(request);
      if (!authorized.ok) {
        sendJson(response, 401, authorized);
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/users') {
        if (!requireAdmin(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'admin_required' });
          return;
        }
        sendJson(response, 200, { ok: true, users: context.authRepository.listUsers() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/market') {
        const query = url.searchParams.get('query') ?? '';
        const viewer = {
          userId: authorized.user.userId,
          departmentIds: authorized.user.departmentId ? [authorized.user.departmentId] : [],
        };
        sendJson(response, 200, { ok: true, results: context.searchService.search({ viewer, query }) });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/notifications') {
        sendJson(response, 200, {
          ok: true,
          items: context.notifyService.listNotifications(authorized.user.userId),
          badges: context.notifyService.getBadges(authorized.user.userId),
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/skills/my') {
        sendJson(response, 200, { ok: true, skills: context.skillCatalogService.listOwnedSkills(authorized.user.userId) });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/skills/manageable') {
        if (!requireAdmin(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'admin_required' });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          skills: context.skillCatalogService.listManageableSkills({ actor: authorized.user }),
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/reviews') {
        if (!canReview(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'review_admin_required' });
          return;
        }
        const tickets = context.reviewService.listTickets(
          authorized.user.roleCode.startsWith('system_admin') ? {} : { reviewerId: authorized.user.userId },
        );
        sendJson(response, 200, { ok: true, queue: groupQueue(tickets) });
        return;
      }

      sendJson(response, 404, { ok: false, reason: 'not_found' });
    } catch (error) {
      sendJson(response, 500, { ok: false, reason: error instanceof Error ? error.message : 'unknown_error' });
    }
  });

  return Object.freeze({ server, context, config: { port, databaseUrl } });
}

export async function startApiServer(config = {}) {
  const created = await createApiServer(config);
  await new Promise((resolvePromise) => {
    created.server.listen(created.config.port, '127.0.0.1', resolvePromise);
  });
  console.log(JSON.stringify({ ok: true, service: '@enterprise-agent-hub/api', port: created.config.port }));
  return created;
}

if (process.argv[1] && resolve(process.argv[1]) === moduleFile) {
  startApiServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
