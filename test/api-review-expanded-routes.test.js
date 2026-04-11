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
  const reviewService = createReviewService({ reviewTicketRepository: createMemoryReviewTicketRepository(), notifyService, auditService });
  const skillCatalogService = createSkillCatalogService({ skillCatalogRepository: createMemorySkillCatalogRepository(), auditService });
  const searchService = createSearchService({ searchDocumentRepository: createMemorySearchDocumentRepository() });

  for (const user of [
    { userId: '00000000-0000-0000-0000-000000000010', username: 'publisher', roleCode: 'employee_lv6', departmentId: '00000000-0000-0000-0000-000000000102', password: 'publisher' },
    { userId: '00000000-0000-0000-0000-000000000011', username: 'reviewer', roleCode: 'review_admin_lv3', departmentId: '00000000-0000-0000-0000-000000000101', password: 'reviewer' },
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

  return Object.freeze({ artifactStorage, authController, authRepository, notificationRepository, notifyService, packageService, reviewService, searchService, skillCatalogService });
}

async function startServer() {
  const packageStorageRoot = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-api-review-'));
  const created = await createApiServer({ port: 0, skipMigrations: true, contextOverride: createTestContext(packageStorageRoot), packageStorageRoot });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  return Object.freeze({ ...created, baseUrl: `http://127.0.0.1:${created.server.address().port}` });
}

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  return payload.sessionId;
}

async function requestJson(baseUrl, pathname, sessionId, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: {
      authorization: `Bearer ${sessionId}`,
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

test('api review detail/history and return flow preserve timeline ordering and badge parity', async (t) => {
  const created = await startServer();
  t.after(() => created.server.close());

  const publisherSessionId = await login(created.baseUrl, 'publisher', 'publisher');
  const reviewerSessionId = await login(created.baseUrl, 'reviewer', 'reviewer');

  const upload = await requestJson(created.baseUrl, '/api/packages/upload', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-review-return-1',
      manifest: { skillId: 'skill-review-return-1', version: '1.0.0', title: 'Review Return Flow', summary: 'Return path coverage.' },
      files: [
        { path: 'README.md', contentText: '# return flow\n' },
        { path: 'SKILL.md', contentText: 'name: review-return-flow\n' },
      ],
    },
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));

  const submit = await requestJson(created.baseUrl, '/api/reviews/submit', publisherSessionId, {
    method: 'POST',
    body: { packageId: 'pkg-review-return-1', reviewerId: '00000000-0000-0000-0000-000000000011', visibility: 'global_installable' },
  });
  assert.equal(submit.response.status, 201, JSON.stringify(submit.payload));

  const claim = await requestJson(created.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/claim`, reviewerSessionId, {
    method: 'POST',
    body: {},
  });
  assert.equal(claim.response.status, 200, JSON.stringify(claim.payload));

  const detail = await requestJson(created.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}`, reviewerSessionId);
  assert.equal(detail.response.status, 200, JSON.stringify(detail.payload));
  assert.equal(detail.payload.ticket.status, 'in_progress');
  assert.equal(detail.payload.skill.skillId, 'skill-review-return-1');

  const preHistory = await requestJson(created.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/history`, reviewerSessionId);
  assert.equal(preHistory.response.status, 200, JSON.stringify(preHistory.payload));
  assert.deepEqual(preHistory.payload.history.map((entry) => entry.action), ['created', 'claim']);

  const returned = await requestJson(created.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/return`, reviewerSessionId, {
    method: 'POST',
    body: { comment: 'Please revise and resubmit.' },
  });
  assert.equal(returned.response.status, 200, JSON.stringify(returned.payload));
  assert.equal(returned.payload.ticket.status, 'returned');
  assert.equal(returned.payload.skill.status, 'changes_requested');
  assert.equal(returned.payload.skill.publishedVersion, null);

  const postHistory = await requestJson(created.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/history`, reviewerSessionId);
  assert.equal(postHistory.response.status, 200, JSON.stringify(postHistory.payload));
  assert.deepEqual(postHistory.payload.history.map((entry) => entry.action), ['created', 'claim', 'return']);
  assert.deepEqual(postHistory.payload.history.map((entry) => entry.toStatus), ['todo', 'in_progress', 'returned']);

  const reviewerNotifications = await requestJson(created.baseUrl, '/api/notifications', reviewerSessionId);
  assert.equal(reviewerNotifications.response.status, 200, JSON.stringify(reviewerNotifications.payload));
  assert.equal(reviewerNotifications.payload.badges.reviewTodoCount, 0);

  const reviewerQueue = await requestJson(created.baseUrl, '/api/reviews', reviewerSessionId);
  assert.equal(reviewerQueue.response.status, 200, JSON.stringify(reviewerQueue.payload));
  assert.equal(reviewerQueue.payload.queue.todo.length, 0);
  assert.equal(reviewerQueue.payload.queue.inProgress.length, 0);
  assert.equal(reviewerQueue.payload.queue.done.length, 1);

  const publisherNotifications = await requestJson(created.baseUrl, '/api/notifications', publisherSessionId);
  assert.equal(publisherNotifications.response.status, 200, JSON.stringify(publisherNotifications.payload));
  assert.equal(publisherNotifications.payload.items.some((entry) => entry.title === 'Skill returned for changes'), true);
});

test('api reject flow updates only the newest non-published version and preserves publishedVersion', async (t) => {
  const created = await startServer();
  t.after(() => created.server.close());

  const publisherSessionId = await login(created.baseUrl, 'publisher', 'publisher');
  const reviewerSessionId = await login(created.baseUrl, 'reviewer', 'reviewer');

  const v1Upload = await requestJson(created.baseUrl, '/api/packages/upload', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-review-reject-v1',
      manifest: { skillId: 'skill-review-reject', version: '1.0.0', title: 'Reject Flow', summary: 'Published baseline.' },
      files: [{ path: 'README.md', contentText: '# v1\n' }, { path: 'SKILL.md', contentText: 'name: reject-flow\n' }],
    },
  });
  assert.equal(v1Upload.response.status, 201, JSON.stringify(v1Upload.payload));
  const v1Submit = await requestJson(created.baseUrl, '/api/reviews/submit', publisherSessionId, { method: 'POST', body: { packageId: 'pkg-review-reject-v1', reviewerId: '00000000-0000-0000-0000-000000000011', visibility: 'global_installable' } });
  const v1Claim = await requestJson(created.baseUrl, `/api/reviews/${v1Submit.payload.ticket.ticketId}/claim`, reviewerSessionId, { method: 'POST', body: {} });
  assert.equal(v1Claim.response.status, 200, JSON.stringify(v1Claim.payload));
  const v1Approve = await requestJson(created.baseUrl, `/api/reviews/${v1Submit.payload.ticket.ticketId}/approve`, reviewerSessionId, { method: 'POST', body: { comment: 'publish v1' } });
  assert.equal(v1Approve.response.status, 200, JSON.stringify(v1Approve.payload));
  assert.equal(v1Approve.payload.skill.publishedVersion, '1.0.0');

  const v2Upload = await requestJson(created.baseUrl, '/api/packages/upload', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-review-reject-v2',
      manifest: { skillId: 'skill-review-reject', version: '2.0.0', title: 'Reject Flow', summary: 'Pending update.' },
      files: [{ path: 'README.md', contentText: '# v2\n' }, { path: 'SKILL.md', contentText: 'name: reject-flow\n' }],
    },
  });
  assert.equal(v2Upload.response.status, 201, JSON.stringify(v2Upload.payload));
  const v2Submit = await requestJson(created.baseUrl, '/api/reviews/submit', publisherSessionId, { method: 'POST', body: { packageId: 'pkg-review-reject-v2', reviewerId: '00000000-0000-0000-0000-000000000011', visibility: 'global_installable' } });
  const v2Claim = await requestJson(created.baseUrl, `/api/reviews/${v2Submit.payload.ticket.ticketId}/claim`, reviewerSessionId, { method: 'POST', body: {} });
  assert.equal(v2Claim.response.status, 200, JSON.stringify(v2Claim.payload));
  const rejected = await requestJson(created.baseUrl, `/api/reviews/${v2Submit.payload.ticket.ticketId}/reject`, reviewerSessionId, { method: 'POST', body: { comment: 'not acceptable' } });
  assert.equal(rejected.response.status, 200, JSON.stringify(rejected.payload));
  assert.equal(rejected.payload.ticket.status, 'rejected');
  assert.equal(rejected.payload.skill.status, 'rejected');
  assert.equal(rejected.payload.skill.publishedVersion, '1.0.0');
  assert.equal(rejected.payload.skill.versions.find((entry) => entry.version === '1.0.0')?.status, 'published');
  assert.equal(rejected.payload.skill.versions.find((entry) => entry.version === '2.0.0')?.status, 'rejected');
});
