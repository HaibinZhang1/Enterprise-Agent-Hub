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

async function startApi() {
  const packageStorageRoot = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-desktop-review-api-'));
  const created = await createApiServer({ port: 0, skipMigrations: true, contextOverride: createTestContext(packageStorageRoot), packageStorageRoot });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  return Object.freeze({ ...created, baseUrl: `http://127.0.0.1:${created.server.address().port}` });
}

async function startDesktop(apiBaseUrl) {
  const sqliteDir = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-desktop-review-'));
  const created = await createDesktopServer({ port: 0, apiBaseUrl, sqlitePath: join(sqliteDir, 'desktop.db') });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  return Object.freeze({ ...created, baseUrl: `http://127.0.0.1:${created.server.address().port}` });
}

async function requestDesktop(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  return { response, payload };
}

test('desktop shell proxies review detail/history and return flow through the desktop surface', async (t) => {
  const api = await startApi();
  const publisherDesktop = await startDesktop(api.baseUrl);
  const reviewerDesktop = await startDesktop(api.baseUrl);
  t.after(() => {
    api.server.close();
    publisherDesktop.server.close();
    reviewerDesktop.server.close();
  });

  const publisherLogin = await requestDesktop(publisherDesktop.baseUrl, '/api/login', { method: 'POST', body: { username: 'publisher', password: 'publisher' } });
  assert.equal(publisherLogin.response.status, 200, JSON.stringify(publisherLogin.payload));
  const reviewerLogin = await requestDesktop(reviewerDesktop.baseUrl, '/api/login', { method: 'POST', body: { username: 'reviewer', password: 'reviewer' } });
  assert.equal(reviewerLogin.response.status, 200, JSON.stringify(reviewerLogin.payload));

  const upload = await requestDesktop(publisherDesktop.baseUrl, '/api/packages/upload', {
    method: 'POST',
    body: {
      packageId: 'pkg-desktop-review-return',
      manifest: { skillId: 'skill-desktop-review-return', version: '1.0.0', title: 'Desktop Review Return', summary: 'Desktop expanded review flow.' },
      files: [
        { path: 'README.md', contentText: '# desktop return\n' },
        { path: 'SKILL.md', contentText: 'name: desktop-review-return\n' },
      ],
    },
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));

  const submit = await requestDesktop(publisherDesktop.baseUrl, '/api/reviews/submit', {
    method: 'POST',
    body: { packageId: 'pkg-desktop-review-return', reviewerUsername: 'reviewer', visibility: 'global_installable' },
  });
  assert.equal(submit.response.status, 201, JSON.stringify(submit.payload));

  const claim = await requestDesktop(reviewerDesktop.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/claim`, { method: 'POST', body: {} });
  assert.equal(claim.response.status, 200, JSON.stringify(claim.payload));

  const detail = await requestDesktop(reviewerDesktop.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}`);
  assert.equal(detail.response.status, 200, JSON.stringify(detail.payload));
  assert.equal(detail.payload.ticket.status, 'in_progress');
  assert.equal(detail.payload.skill.skillId, 'skill-desktop-review-return');

  const history = await requestDesktop(reviewerDesktop.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/history`);
  assert.equal(history.response.status, 200, JSON.stringify(history.payload));
  assert.deepEqual(history.payload.history.map((entry) => entry.action), ['created', 'claim']);

  const returned = await requestDesktop(reviewerDesktop.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/return`, {
    method: 'POST',
    body: { comment: 'Please revise and resubmit.' },
  });
  assert.equal(returned.response.status, 200, JSON.stringify(returned.payload));
  assert.equal(returned.payload.ticket.status, 'returned');
  assert.equal(returned.payload.skill.status, 'changes_requested');

  const reloadedHistory = await requestDesktop(reviewerDesktop.baseUrl, `/api/reviews/${submit.payload.ticket.ticketId}/history`);
  assert.equal(reloadedHistory.response.status, 200, JSON.stringify(reloadedHistory.payload));
  assert.deepEqual(reloadedHistory.payload.history.map((entry) => entry.action), ['created', 'claim', 'return']);

  const reviewerNotifications = await requestDesktop(reviewerDesktop.baseUrl, '/api/notifications');
  assert.equal(reviewerNotifications.response.status, 200, JSON.stringify(reviewerNotifications.payload));
  assert.equal(reviewerNotifications.payload.badges.reviewTodoCount, 0);

  const publisherNotifications = await requestDesktop(publisherDesktop.baseUrl, '/api/notifications');
  assert.equal(publisherNotifications.response.status, 200, JSON.stringify(publisherNotifications.payload));
  assert.equal(publisherNotifications.payload.items.some((entry) => entry.title === 'Skill returned for changes'), true);
});
