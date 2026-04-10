import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createApiServer } from '../apps/api/src/server.js';
import { createAuditService } from '../apps/api/src/modules/audit/services/audit-service.js';
import { createMemoryAuditLogRepository } from '../apps/api/src/modules/audit/repositories/memory-audit-log-repository.js';
import { createAuthController } from '../apps/api/src/modules/auth/controllers/auth-controller.js';
import { createMemoryAuthRepository } from '../apps/api/src/modules/auth/repositories/memory-auth-repository.js';
import { createAuthService } from '../apps/api/src/modules/auth/services/auth-service.js';
import { createNotifyService } from '../apps/api/src/modules/notify/services/notify-service.js';
import { createNotificationCenterRepository } from '../apps/api/src/modules/notify/repositories/notification-center-repository.js';
import { createMemoryPackageReportRepository } from '../apps/api/src/modules/package/repositories/memory-package-report-repository.js';
import { createPackageService } from '../apps/api/src/modules/package/services/package-service.js';
import { createFilesystemPackageArtifactStorage } from '../apps/api/src/modules/package/storage/filesystem-package-artifact-storage.js';
import { createReviewService } from '../apps/api/src/modules/review/services/review-service.js';
import { createMemoryReviewTicketRepository } from '../apps/api/src/modules/review/repositories/memory-review-ticket-repository.js';
import { createSearchService } from '../apps/api/src/modules/search/services/search-service.js';
import { createMemorySearchDocumentRepository } from '../apps/api/src/modules/search/repositories/memory-search-document-repository.js';
import { createSkillCatalogService } from '../apps/api/src/modules/skill/services/skill-catalog-service.js';
import { createMemorySkillCatalogRepository } from '../apps/api/src/modules/skill/repositories/memory-skill-catalog-repository.js';
import { createDesktopServer } from '../apps/desktop/src/server.js';

function createTestContext(packageStorageRoot) {
  const auditService = createAuditService({ auditRepository: createMemoryAuditLogRepository() });
  const authRepository = createMemoryAuthRepository();
  const authService = createAuthService({ authRepository, auditService });
  const authController = createAuthController({ authService });
  const notificationRepository = createNotificationCenterRepository();
  const notifyService = createNotifyService({ notificationRepository });
  const packageReportRepository = createMemoryPackageReportRepository();
  const artifactStorage = createFilesystemPackageArtifactStorage({ rootDir: packageStorageRoot });
  const packageService = createPackageService({ packageReportRepository, auditService, artifactStorage });
  const reviewService = createReviewService({
    reviewTicketRepository: createMemoryReviewTicketRepository(),
    notifyService,
    auditService,
  });
  const skillCatalogService = createSkillCatalogService({
    skillCatalogRepository: createMemorySkillCatalogRepository(),
    auditService,
  });
  const searchService = createSearchService({
    searchDocumentRepository: createMemorySearchDocumentRepository(),
  });

  for (const user of [
    {
      userId: '00000000-0000-0000-0000-000000000010',
      username: 'publisher',
      roleCode: 'employee_lv6',
      departmentId: '00000000-0000-0000-0000-000000000102',
      password: 'publisher',
    },
    {
      userId: '00000000-0000-0000-0000-000000000011',
      username: 'reviewer',
      roleCode: 'review_admin_lv3',
      departmentId: '00000000-0000-0000-0000-000000000101',
      password: 'reviewer',
    },
  ]) {
    authRepository.createUser({
      userId: user.userId,
      username: user.username,
      departmentId: user.departmentId,
      roleCode: user.roleCode,
      status: 'active',
      authzVersion: 1,
      authzRecalcPending: false,
      pendingAuthzVersion: null,
      mustChangePassword: false,
      lastLoginAt: null,
      provider: 'local',
    });
    authRepository.saveCredential({
      userId: user.userId,
      password: user.password,
      passwordHistory: [],
      temporaryCredentialMode: 'permanent',
      failedAttemptCount: 0,
      lockedUntil: null,
      passwordChangedAt: '2026-04-08T00:00:00.000Z',
    });
  }

  return Object.freeze({
    artifactStorage,
    authController,
    authRepository,
    notificationRepository,
    notifyService,
    packageService,
    reviewService,
    searchService,
    skillCatalogService,
  });
}

async function startApi() {
  const packageStorageRoot = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-desktop-api-storage-'));
  const created = await createApiServer({
    port: 0,
    skipMigrations: true,
    contextOverride: createTestContext(packageStorageRoot),
    packageStorageRoot,
  });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  return Object.freeze({
    ...created,
    baseUrl: `http://127.0.0.1:${created.server.address().port}`,
  });
}

async function startDesktop(apiBaseUrl) {
  const sqliteDir = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-desktop-write-'));
  const created = await createDesktopServer({
    port: 0,
    apiBaseUrl,
    sqlitePath: join(sqliteDir, 'desktop.db'),
  });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  return Object.freeze({
    ...created,
    baseUrl: `http://127.0.0.1:${created.server.address().port}`,
  });
}

async function requestDesktop(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = pathname.includes('/files/')
    ? await response.text()
    : await response.json();
  return { response, payload };
}

test('desktop shell proxies upload -> submit -> claim -> approve through the live desktop surface', async (t) => {
  const api = await startApi();
  const publisherDesktop = await startDesktop(api.baseUrl);
  const reviewerDesktop = await startDesktop(api.baseUrl);
  t.after(() => {
    api.server.close();
    publisherDesktop.server.close();
    reviewerDesktop.server.close();
  });

  const publisherLogin = await requestDesktop(publisherDesktop.baseUrl, '/api/login', {
    method: 'POST',
    body: { username: 'publisher', password: 'publisher' },
  });
  assert.equal(publisherLogin.response.status, 200, JSON.stringify(publisherLogin.payload));

  const upload = await requestDesktop(publisherDesktop.baseUrl, '/api/packages/upload', {
    method: 'POST',
    body: {
      packageId: 'pkg-desktop-flow-1',
      manifest: {
        skillId: 'skill-desktop-flow-1',
        version: '3.0.0',
        title: 'Desktop Production Flow',
        summary: 'Exercises the desktop publish and review routes.',
      },
      files: [
        { path: 'README.md', contentText: '# desktop production flow\n' },
        { path: 'SKILL.md', contentText: 'name: desktop-production-flow\n' },
      ],
    },
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));

  const submit = await requestDesktop(publisherDesktop.baseUrl, '/api/reviews/submit', {
    method: 'POST',
    body: {
      packageId: 'pkg-desktop-flow-1',
      reviewerUsername: 'reviewer',
      visibility: 'global_installable',
    },
  });
  assert.equal(submit.response.status, 201, JSON.stringify(submit.payload));
  assert.equal(submit.payload.ticket.status, 'todo');

  const publisherQueue = await requestDesktop(publisherDesktop.baseUrl, '/api/reviews');
  assert.equal(publisherQueue.response.status, 403, JSON.stringify(publisherQueue.payload));
  assert.equal(publisherQueue.payload.reason, 'review_admin_required');

  const reviewerLogin = await requestDesktop(reviewerDesktop.baseUrl, '/api/login', {
    method: 'POST',
    body: { username: 'reviewer', password: 'reviewer' },
  });
  assert.equal(reviewerLogin.response.status, 200, JSON.stringify(reviewerLogin.payload));

  const todoQueue = await requestDesktop(reviewerDesktop.baseUrl, '/api/reviews');
  assert.equal(todoQueue.response.status, 200, JSON.stringify(todoQueue.payload));
  assert.equal(todoQueue.payload.queue.todo.length, 1);
  assert.equal(todoQueue.payload.queue.todo[0].ticketId, submit.payload.ticket.ticketId);

  const claim = await requestDesktop(
    reviewerDesktop.baseUrl,
    `/api/reviews/${submit.payload.ticket.ticketId}/claim`,
    { method: 'POST', body: {} },
  );
  assert.equal(claim.response.status, 200, JSON.stringify(claim.payload));
  assert.equal(claim.payload.ticket.status, 'in_progress');

  const inProgressQueue = await requestDesktop(reviewerDesktop.baseUrl, '/api/reviews');
  assert.equal(inProgressQueue.response.status, 200, JSON.stringify(inProgressQueue.payload));
  assert.equal(inProgressQueue.payload.queue.todo.length, 0);
  assert.equal(inProgressQueue.payload.queue.inProgress.length, 1);
  assert.equal(inProgressQueue.payload.queue.inProgress[0].ticketId, submit.payload.ticket.ticketId);

  const approve = await requestDesktop(
    reviewerDesktop.baseUrl,
    `/api/reviews/${submit.payload.ticket.ticketId}/approve`,
    { method: 'POST', body: { comment: 'Approved through desktop.' } },
  );
  assert.equal(approve.response.status, 200, JSON.stringify(approve.payload));
  assert.equal(approve.payload.skill.status, 'published');

  const doneQueue = await requestDesktop(reviewerDesktop.baseUrl, '/api/reviews');
  assert.equal(doneQueue.response.status, 200, JSON.stringify(doneQueue.payload));
  assert.equal(doneQueue.payload.queue.inProgress.length, 0);
  assert.equal(doneQueue.payload.queue.done.length, 1);
  assert.equal(doneQueue.payload.queue.done[0].ticketId, submit.payload.ticket.ticketId);

  const market = await requestDesktop(publisherDesktop.baseUrl, '/api/market?query=Desktop%20Production');
  assert.equal(market.response.status, 200, JSON.stringify(market.payload));
  assert.equal(market.payload.results.some((entry) => entry.skillId === 'skill-desktop-flow-1'), true);

  const artifact = await requestDesktop(
    publisherDesktop.baseUrl,
    '/api/packages/pkg-desktop-flow-1/files/README.md',
    { headers: {} },
  );
  assert.equal(artifact.response.status, 200);
  assert.equal(artifact.payload, '# desktop production flow\n');

  const notifications = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications');
  assert.equal(notifications.response.status, 200, JSON.stringify(notifications.payload));
  assert.equal(notifications.payload.items.some((entry) => entry.title === 'Skill published'), true);
  assert.equal(publisherDesktop.store.listCaches().length > 0, true);
});

test('desktop shell proxies notification read and read-all mutations through the desktop surface', async (t) => {
  const api = await startApi();
  const publisherDesktop = await startDesktop(api.baseUrl);
  t.after(() => {
    api.server.close();
    publisherDesktop.server.close();
  });

  const loginResult = await requestDesktop(publisherDesktop.baseUrl, '/api/login', {
    method: 'POST',
    body: { username: 'publisher', password: 'publisher' },
  });
  assert.equal(loginResult.response.status, 200, JSON.stringify(loginResult.payload));

  api.context.notifyService.notify({
    userId: '00000000-0000-0000-0000-000000000010',
    category: 'system',
    title: 'Desktop unread A',
    body: 'First desktop unread notification.',
  });
  api.context.notifyService.notify({
    userId: '00000000-0000-0000-0000-000000000010',
    category: 'system',
    title: 'Desktop unread B',
    body: 'Second desktop unread notification.',
  });

  const before = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications');
  assert.equal(before.response.status, 200, JSON.stringify(before.payload));
  const target = before.payload.items.find((entry) => entry.title === 'Desktop unread A');
  assert.ok(target, 'expected seeded desktop notification');
  assert.equal(before.payload.badges.unreadCount >= 2, true);

  const markRead = await requestDesktop(
    publisherDesktop.baseUrl,
    `/api/notifications/${target.id}/read`,
    {
      method: 'POST',
      body: {},
    },
  );
  assert.equal(markRead.response.status, 200, JSON.stringify(markRead.payload));
  assert.equal(markRead.payload.notificationId, target.id);
  assert.equal(markRead.payload.badges.unreadCount, before.payload.badges.unreadCount - 1);
  assert.equal(typeof markRead.payload.updatedAt, 'string');

  const afterSingleRead = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications');
  assert.equal(afterSingleRead.response.status, 200, JSON.stringify(afterSingleRead.payload));
  assert.equal(afterSingleRead.payload.items.find((entry) => entry.id === target.id)?.readAt !== null, true);

  const readAll = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications/read-all', {
    method: 'POST',
    body: {},
  });
  assert.equal(readAll.response.status, 200, JSON.stringify(readAll.payload));
  assert.equal(readAll.payload.readAll, true);
  assert.equal(readAll.payload.badges.unreadCount, 0);
  assert.equal(typeof readAll.payload.updatedAt, 'string');

  const afterAllRead = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications');
  assert.equal(afterAllRead.response.status, 200, JSON.stringify(afterAllRead.payload));
  assert.equal(afterAllRead.payload.badges.unreadCount, 0);
  assert.equal(afterAllRead.payload.items.every((entry) => entry.readAt !== null), true);
});
