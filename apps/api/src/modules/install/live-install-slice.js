import { createMemoryAuditLogRepository } from '../audit/repositories/memory-audit-log-repository.js';
import { createAuditService } from '../audit/services/audit-service.js';
import { createNotificationCenterRepository } from '../notify/repositories/notification-center-repository.js';
import { createNotifyService } from '../notify/services/notify-service.js';
import { createInstallController } from './controllers/install-controller.js';
import { createMemoryInstallRepository } from './repositories/memory-install-repository.js';
import { createInstallService } from './services/install-service.js';

export function createLiveInstallSlice() {
  const auditRepository = createMemoryAuditLogRepository();
  const notificationRepository = createNotificationCenterRepository();
  const installRepository = createMemoryInstallRepository();

  const auditService = createAuditService({ auditRepository });
  const notifyService = createNotifyService({ notificationRepository });
  const installService = createInstallService({
    installRepository,
    auditService,
    notifyService,
  });
  const installController = createInstallController({ installService });

  return Object.freeze({
    installController,

    /**
     * @param {string} installId
     */
    getInstall(installId) {
      return installController.getInstall(installId);
    },

    /**
     * @param {string} userId
     */
    listInstalls(userId) {
      return installController.listInstalls(userId);
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
  });
}
