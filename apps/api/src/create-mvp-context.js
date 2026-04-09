// @ts-nocheck
import { resolve } from 'node:path';

import { createAuditService } from './modules/audit/services/audit-service.js';
import { createAuthController } from './modules/auth/controllers/auth-controller.js';
import { createAuthService } from './modules/auth/services/auth-service.js';
import { createPackageService } from './modules/package/services/package-service.js';
import { createFilesystemPackageArtifactStorage } from './modules/package/storage/filesystem-package-artifact-storage.js';
import { createNotifyService } from './modules/notify/services/notify-service.js';
import { createReviewService } from './modules/review/services/review-service.js';
import { createSearchService } from './modules/search/services/search-service.js';
import { createSkillCatalogService } from './modules/skill/services/skill-catalog-service.js';
import { createPostgresAuditLogRepository } from './persistence/postgres-audit-log-repository.js';
import { createPostgresAuthRepository } from './persistence/postgres-auth-repository.js';
import { createPostgresNotificationRepository } from './persistence/postgres-notification-repository.js';
import { createPostgresPackageReportRepository } from './persistence/postgres-package-report-repository.js';
import { createPostgresReviewTicketRepository } from './persistence/postgres-review-ticket-repository.js';
import { createPostgresSearchDocumentRepository } from './persistence/postgres-search-document-repository.js';
import { createPostgresSkillCatalogRepository } from './persistence/postgres-skill-catalog-repository.js';
import { seedMvpData } from './persistence/seed-mvp-data.js';

export function createMvpContext(input) {
  const packageStorageRoot = resolve(input.packageStorageRoot ?? '.data/package-artifacts');
  const authRepository = createPostgresAuthRepository(input);
  const auditRepository = createPostgresAuditLogRepository(input);
  const notificationRepository = createPostgresNotificationRepository(input);
  const packageReportRepository = createPostgresPackageReportRepository(input);
  const reviewTicketRepository = createPostgresReviewTicketRepository(input);
  const skillCatalogRepository = createPostgresSkillCatalogRepository(input);
  const searchDocumentRepository = createPostgresSearchDocumentRepository(input);
  const artifactStorage = createFilesystemPackageArtifactStorage({ rootDir: packageStorageRoot });

  const auditService = createAuditService({ auditRepository });
  const authService = createAuthService({ authRepository, auditService });
  const packageService = createPackageService({ packageReportRepository, auditService, artifactStorage });
  const notifyService = createNotifyService({ notificationRepository });
  const reviewService = createReviewService({ reviewTicketRepository, notifyService, auditService });
  const skillCatalogService = createSkillCatalogService({ skillCatalogRepository, auditService });
  const searchService = createSearchService({ searchDocumentRepository });
  const authController = createAuthController({ authService });

  seedMvpData({
    authRepository,
    notificationRepository,
    reviewTicketRepository,
    skillCatalogRepository,
    searchDocumentRepository,
  });

  return Object.freeze({
    auditService,
    authController,
    authRepository,
    authService,
    artifactStorage,
    notificationRepository,
    notifyService,
    packageReportRepository,
    packageService,
    reviewService,
    skillCatalogService,
    searchService,
  });
}
