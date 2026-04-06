import { createAuthController } from './controllers/auth-controller.js';
import { createAuthAdminController } from './controllers/auth-admin-controller.js';
import { createMemoryAuditLogRepository } from '../audit/repositories/memory-audit-log-repository.js';
import { createAuditService } from '../audit/services/audit-service.js';
import { createNotificationCenterRepository } from '../notify/repositories/notification-center-repository.js';
import { createNotifyService } from '../notify/services/notify-service.js';
import { createOrgAdminController } from '../org/controllers/org-admin-controller.js';
import { createMemoryScopeJobRepository } from '../org/repositories/memory-scope-job-repository.js';
import { createOrgGovernanceService } from '../org/services/org-governance-service.js';
import { createMemoryAuthRepository } from './repositories/memory-auth-repository.js';
import { createAuthAdminService } from './services/auth-admin-service.js';
import { createAuthService } from './services/auth-service.js';

export function createLiveAuthGovernanceSlice() {
  const authRepository = createMemoryAuthRepository();
  const auditRepository = createMemoryAuditLogRepository();
  const notificationRepository = createNotificationCenterRepository();
  const scopeJobRepository = createMemoryScopeJobRepository();

  const auditService = createAuditService({ auditRepository });
  const notifyService = createNotifyService({ notificationRepository });
  const authService = createAuthService({ authRepository, auditService });
  const authAdminService = createAuthAdminService({ authRepository, auditService, notifyService });
  const orgGovernanceService = createOrgGovernanceService({
    authRepository,
    scopeJobRepository,
    auditService,
    notifyService,
  });

  const authController = createAuthController({ authService });
  const authAdminController = createAuthAdminController({ authAdminService });
  const orgAdminController = createOrgAdminController({ orgGovernanceService });

  return Object.freeze({
    authController,
    authAdminController,
    orgAdminController,

    /**
     * @param {string} userId
     */
    getUser(userId) {
      const user = authRepository.findUserById(userId);
      if (!user) {
        throw new Error(`Unknown user: ${userId}`);
      }
      return user;
    },

    getAuditTrail() {
      return auditService.list();
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return notifyService.getBadges(userId);
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return notifyService.listNotifications(userId);
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return notifyService.drainEvents(userId);
    },

    /**
     * @param {string} userId
     */
    listSessions(userId) {
      return authRepository.listSessionsByUserId(userId);
    },

    /**
     * @param {string} userId
     */
    listActiveSessions(userId) {
      return authRepository.listActiveSessionsByUserId(userId);
    },
  });
}
