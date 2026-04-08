// @ts-nocheck
import { createAuditService } from './modules/audit/services/audit-service.js';
import { createAuthController } from './modules/auth/controllers/auth-controller.js';
import { createAuthService } from './modules/auth/services/auth-service.js';
import { createNotifyService } from './modules/notify/services/notify-service.js';
import { createReviewService } from './modules/review/services/review-service.js';
import { createSearchService } from './modules/search/services/search-service.js';
import { createSkillCatalogService } from './modules/skill/services/skill-catalog-service.js';
import { createPostgresAuditLogRepository } from './persistence/postgres-audit-log-repository.js';
import { createPostgresAuthRepository } from './persistence/postgres-auth-repository.js';
import { createPostgresNotificationRepository } from './persistence/postgres-notification-repository.js';
import { createPostgresReviewTicketRepository } from './persistence/postgres-review-ticket-repository.js';
import { createPostgresSearchDocumentRepository } from './persistence/postgres-search-document-repository.js';
import { createPostgresSkillCatalogRepository } from './persistence/postgres-skill-catalog-repository.js';
import { seedMvpData } from './persistence/seed-mvp-data.js';

export function createMvpContext(input) {
  const authRepository = createPostgresAuthRepository(input);
  const auditRepository = createPostgresAuditLogRepository(input);
  const notificationRepository = createPostgresNotificationRepository(input);
  const reviewTicketRepository = createPostgresReviewTicketRepository(input);
  const skillCatalogRepository = createPostgresSkillCatalogRepository(input);
  const searchDocumentRepository = createPostgresSearchDocumentRepository(input);

  const auditService = createAuditService({ auditRepository });
  const authService = createAuthService({ authRepository, auditService });
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
    notificationRepository,
    notifyService,
    reviewService,
    skillCatalogService,
    searchService,
  });
}
