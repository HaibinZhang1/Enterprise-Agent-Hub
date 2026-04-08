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

async function startServer() {
  const packageStorageRoot = await mkdtemp(join(tmpdir(), 'enterprise-agent-hub-api-storage-'));
  const created = await createApiServer({
    port: 0,
    skipMigrations: true,
    contextOverride: createTestContext(packageStorageRoot),
    packageStorageRoot,
  });
  await new Promise((resolvePromise) => created.server.listen(0, '127.0.0.1', resolvePromise));
  const address = created.server.address();
  return Object.freeze({
    ...created,
    baseUrl: `http://127.0.0.1:${address.port}`,
  });
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

test('api server stores uploaded artifacts and serves report/file retrieval', async (t) => {
  const created = await startServer();
  t.after(() => created.server.close());

  const publisherSessionId = await login(created.baseUrl, 'publisher', 'publisher');

  const upload = await requestJson(created.baseUrl, '/api/packages/upload', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-api-upload-1',
      manifest: {
        skillId: 'skill-api-upload-1',
        version: '1.0.0',
        title: 'API Upload Route',
        summary: 'Verifies the real upload route.',
      },
      files: [
        { path: 'README.md', contentText: '# upload route\n' },
        { path: 'SKILL.md', contentText: 'name: api-upload-route\n' },
      ],
    },
  });

  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));
  assert.equal(upload.payload.report.storage.kind, 'filesystem');
  assert.equal(upload.payload.report.files.length, 2);

  const report = await requestJson(created.baseUrl, '/api/packages/pkg-api-upload-1/report', publisherSessionId);
  assert.equal(report.response.status, 200, JSON.stringify(report.payload));
  assert.equal(report.payload.report.manifest.skillId, 'skill-api-upload-1');

  const artifact = await fetch(`${created.baseUrl}/api/packages/pkg-api-upload-1/files/README.md`, {
    headers: { authorization: `Bearer ${publisherSessionId}` },
  });
  assert.equal(artifact.status, 200);
  assert.equal(await artifact.text(), '# upload route\n');
});

test('api server exposes real submit/claim/approve write routes over the live server surface', async (t) => {
  const created = await startServer();
  t.after(() => created.server.close());

  const publisherSessionId = await login(created.baseUrl, 'publisher', 'publisher');
  const reviewerSessionId = await login(created.baseUrl, 'reviewer', 'reviewer');

  const upload = await requestJson(created.baseUrl, '/api/packages/upload', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-api-flow-1',
      manifest: {
        skillId: 'skill-api-flow-1',
        version: '2.0.0',
        title: 'Production Upload Flow',
        summary: 'Exercises submit, claim, and approve routes.',
        tags: ['production'],
      },
      files: [
        { path: 'README.md', contentText: '# production upload\n' },
        { path: 'SKILL.md', contentText: 'name: production-upload-flow\n' },
      ],
    },
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.payload));

  const submit = await requestJson(created.baseUrl, '/api/reviews/submit', publisherSessionId, {
    method: 'POST',
    body: {
      packageId: 'pkg-api-flow-1',
      reviewerId: '00000000-0000-0000-0000-000000000011',
      visibility: 'global_installable',
    },
  });
  assert.equal(submit.response.status, 201, JSON.stringify(submit.payload));
  assert.equal(submit.payload.ticket.status, 'todo');

  const claim = await requestJson(
    created.baseUrl,
    `/api/reviews/${submit.payload.ticket.ticketId}/claim`,
    reviewerSessionId,
    { method: 'POST', body: {} },
  );
  assert.equal(claim.response.status, 200, JSON.stringify(claim.payload));
  assert.equal(claim.payload.ticket.status, 'in_progress');
  assert.equal(claim.payload.ticket.claimedBy, '00000000-0000-0000-0000-000000000011');

  const approve = await requestJson(
    created.baseUrl,
    `/api/reviews/${submit.payload.ticket.ticketId}/approve`,
    reviewerSessionId,
    { method: 'POST', body: { comment: 'Looks production-ready.' } },
  );
  assert.equal(approve.response.status, 200, JSON.stringify(approve.payload));
  assert.equal(approve.payload.ticket.status, 'approved');
  assert.equal(approve.payload.skill.status, 'published');

  const market = await requestJson(created.baseUrl, '/api/market?query=Production%20Upload', publisherSessionId);
  assert.equal(market.response.status, 200, JSON.stringify(market.payload));
  assert.equal(market.payload.results.some((entry) => entry.skillId === 'skill-api-flow-1'), true);

  const notifications = await requestJson(created.baseUrl, '/api/notifications', publisherSessionId);
  assert.equal(notifications.response.status, 200, JSON.stringify(notifications.payload));
  assert.equal(notifications.payload.items.some((entry) => entry.title === 'Skill published'), true);
});
