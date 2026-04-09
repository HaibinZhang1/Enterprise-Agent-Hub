// @ts-nocheck
import { randomUUID } from 'node:crypto';
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

function routeSegments(pathname) {
  return pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
}

function sameUserOrAdmin(user, targetUserId) {
  return user.userId === targetUserId || user.roleCode.includes('admin');
}

function reviewerScopeFilter(user) {
  return user.roleCode.startsWith('system_admin') ? {} : { reviewerId: user.userId };
}

function parseRequestedDate(value) {
  return value ? new Date(value) : undefined;
}

export async function createApiServer(config = {}) {
  const host = config.host ?? process.env.HOST ?? process.env.API_HOST ?? '127.0.0.1';
  const port = Number(config.port ?? process.env.PORT ?? 8787);
  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL ?? 'postgresql://enterprise_agent_hub:enterprise_agent_hub@localhost:5432/enterprise_agent_hub';
  const skipMigrations = config.skipMigrations ?? process.env.SKIP_MIGRATIONS === '1';
  const packageStorageRoot =
    config.packageStorageRoot ??
    process.env.PACKAGE_STORAGE_ROOT ??
    resolve(workspaceRoot, '.data', 'package-artifacts');
  if (!skipMigrations && !config.contextOverride) {
    runMigrations(databaseUrl);
  }
  const context = config.contextOverride ?? createMvpContext({ databaseUrl, packageStorageRoot });

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

      const segments = routeSegments(url.pathname);

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
        const tickets = context.reviewService.listTickets(reviewerScopeFilter(authorized.user));
        sendJson(response, 200, { ok: true, queue: groupQueue(tickets) });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/packages/upload') {
        const body = await parseBody(request);
        const packageId = body.packageId ?? `pkg-${randomUUID()}`;
        const report = context.packageService.upload({
          requestId: body.requestId ?? `upload-${packageId}`,
          actor: authorized.user,
          packageId,
          files: body.files ?? [],
          manifest: body.manifest ?? {},
          now: parseRequestedDate(body.now),
        });
        sendJson(response, 201, { ok: true, report });
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'report') {
        const report = context.packageService.getReport(segments[2]);
        if (!sameUserOrAdmin(authorized.user, report.uploadedBy)) {
          sendJson(response, 403, { ok: false, reason: 'package_access_denied' });
          return;
        }
        sendJson(response, 200, { ok: true, report });
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'files' && segments.length >= 5) {
        const packageId = segments[2];
        const artifactPath = segments.slice(4).join('/');
        const report = context.packageService.getReport(packageId);
        if (!sameUserOrAdmin(authorized.user, report.uploadedBy) && !canReview(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'package_access_denied' });
          return;
        }
        const artifact = context.artifactStorage.readArtifact(packageId, artifactPath);
        response.writeHead(200, {
          'content-type': 'application/octet-stream',
          'cache-control': 'no-store',
          'content-length': artifact.byteLength,
          'content-disposition': `attachment; filename="${segments[segments.length - 1]}"`,
        });
        response.end(artifact);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/reviews/submit') {
        const body = await parseBody(request);
        const report = context.packageService.getReport(body.packageId);
        if (!sameUserOrAdmin(authorized.user, report.uploadedBy)) {
          sendJson(response, 403, { ok: false, reason: 'package_submit_denied' });
          return;
        }
        const reviewer =
          body.reviewerId
            ? context.authRepository.findUserById(body.reviewerId)
            : body.reviewerUsername
              ? context.authRepository.findUserByUsername(body.reviewerUsername)
              : null;
        if (!reviewer) {
          sendJson(response, 400, { ok: false, reason: 'reviewer_id_required' });
          return;
        }
        const skillId = body.skillId ?? report.manifest.skillId;
        if (skillId !== report.manifest.skillId) {
          sendJson(response, 400, { ok: false, reason: 'skill_id_mismatch' });
          return;
        }
        const submittedSkill = context.skillCatalogService.submitVersion({
          requestId: body.requestId ?? `submit-${body.packageId}`,
          actor: authorized.user,
          skillId,
          packageReport: report,
          visibility: body.visibility ?? 'private',
          allowedDepartmentIds: body.allowedDepartmentIds ?? [],
          now: parseRequestedDate(body.now),
        });
        const ticket = context.reviewService.createTicket({
          requestId: body.requestId ?? `submit-${body.packageId}`,
          actor: authorized.user,
          ticketId: body.ticketId ?? `review-${randomUUID()}`,
          skillId,
          skillTitle: submittedSkill.title,
          packageId: body.packageId,
          reviewerId: reviewer.userId,
          now: parseRequestedDate(body.now),
        });
        sendJson(response, 201, { ok: true, skill: submittedSkill, ticket });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'claim') {
        if (!canReview(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'review_admin_required' });
          return;
        }
        const body = await parseBody(request);
        const ticket = context.reviewService.claimTicket({
          requestId: body.requestId ?? `claim-${segments[2]}`,
          actor: authorized.user,
          ticketId: segments[2],
          now: parseRequestedDate(body.now),
        });
        sendJson(response, 200, { ok: true, ticket });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'approve') {
        if (!canReview(authorized.user)) {
          sendJson(response, 403, { ok: false, reason: 'review_admin_required' });
          return;
        }
        const body = await parseBody(request);
        const approvedTicket = context.reviewService.approveTicket({
          requestId: body.requestId ?? `approve-${segments[2]}`,
          actor: authorized.user,
          ticketId: segments[2],
          comment: body.comment ?? '',
          now: parseRequestedDate(body.now),
        });
        const publishedSkill = context.skillCatalogService.publishApproved({
          requestId: body.requestId ?? `approve-${segments[2]}`,
          actor: authorized.user,
          skillId: approvedTicket.skillId,
          now: parseRequestedDate(body.now),
        });
        context.searchService.upsertSkill({
          skillId: publishedSkill.skillId,
          title: publishedSkill.title,
          summary: publishedSkill.summary,
          ownerUserId: publishedSkill.ownerUserId,
          publishedVersion: publishedSkill.publishedVersion,
          visibility: publishedSkill.visibility,
          allowedDepartmentIds: publishedSkill.allowedDepartmentIds,
          tags: [],
        });
        context.notifyService.notify({
          userId: publishedSkill.ownerUserId,
          category: 'review',
          title: 'Skill published',
          body: `${publishedSkill.title} passed review and is now searchable.`,
          now: parseRequestedDate(body.now),
          metadata: { ticketId: approvedTicket.ticketId, version: publishedSkill.publishedVersion },
        });
        sendJson(response, 200, { ok: true, ticket: approvedTicket, skill: publishedSkill });
        return;
      }

      sendJson(response, 404, { ok: false, reason: 'not_found' });
    } catch (error) {
      sendJson(response, 500, { ok: false, reason: error instanceof Error ? error.message : 'unknown_error' });
    }
  });

  return Object.freeze({ server, context, config: { host, port, databaseUrl, packageStorageRoot, skipMigrations } });
}

export async function startApiServer(config = {}) {
  const created = await createApiServer(config);
  await new Promise((resolvePromise) => {
    created.server.listen(created.config.port, created.config.host, resolvePromise);
  });
  console.log(JSON.stringify({ ok: true, service: '@enterprise-agent-hub/api', host: created.config.host, port: created.config.port }));
  return created;
}

if (process.argv[1] && resolve(process.argv[1]) === moduleFile) {
  startApiServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
