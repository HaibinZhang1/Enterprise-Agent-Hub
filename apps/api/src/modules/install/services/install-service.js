const INSTALL_REQUESTED_EVENT = 'install.requested';
const INSTALL_SYNCED_EVENT = 'install.desktop_synced';
const INSTALL_BLOCKED_EVENT = 'install.desktop_blocked';
const INSTALL_ACTIVATED_EVENT = 'install.activated';
const INSTALL_DEACTIVATED_EVENT = 'install.deactivated';

/**
 * @param {ReturnType<typeof import('../repositories/memory-install-repository.js').createMemoryInstallRepository>['getInstall']} getInstall
 * @param {string} installId
 */
function requireInstall(getInstall, installId) {
  const install = getInstall(installId);
  if (!install) {
    throw new Error(`Unknown install: ${installId}`);
  }
  return install;
}

/**
 * @param {{
 *   installRepository: ReturnType<typeof import('../repositories/memory-install-repository.js').createMemoryInstallRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 *   notifyService: ReturnType<typeof import('../../notify/services/notify-service.js').createNotifyService>;
 * }} input
 */
export function createInstallService(input) {
  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   skillId: string;
     *   version: string;
     *   target: { type: 'tool' | 'project'; id: string };
     *   now?: Date;
     * }} request
     */
    requestInstall(request) {
      const now = request.now ?? new Date();
      const install = input.installRepository.saveInstall({
        installId: input.installRepository.nextInstallId(request.actor.userId),
        userId: request.actor.userId,
        skillId: request.skillId,
        version: request.version,
        status: 'requested',
        target: request.target,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        lastDesktopSyncAt: null,
        lastDesktopLocalState: null,
        lastDesktopReconcileState: null,
        lastFailureReason: null,
      });

      input.auditService.record({
        requestId: request.requestId,
        actor: request.actor,
        targetType: 'install',
        targetId: install.installId,
        action: INSTALL_REQUESTED_EVENT,
        details: {
          skillId: install.skillId,
          version: install.version,
          target: install.target,
        },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: request.actor.userId,
        category: 'install',
        title: 'Install queued',
        body: `${install.skillId}@${install.version} is queued for desktop sync.`,
        now,
        metadata: {
          installId: install.installId,
          skillId: install.skillId,
        },
      });
      return install;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   installId: string;
     *   desktopLocalState: string;
     *   reconcileState: string;
     *   now?: Date;
     * }} report
     */
    recordDesktopSync(report) {
      const now = report.now ?? new Date();
      const install = requireInstall(input.installRepository.getInstall, report.installId);
      const nextStatus =
        install.status === 'requested' && report.reconcileState === 'in_sync' && report.desktopLocalState === 'applied'
          ? 'installed'
          : install.status;
      const updated = input.installRepository.saveInstall({
        ...install,
        status: nextStatus,
        updatedAt: now.toISOString(),
        lastDesktopSyncAt: now.toISOString(),
        lastDesktopLocalState: report.desktopLocalState,
        lastDesktopReconcileState: report.reconcileState,
        lastFailureReason: null,
      });

      input.auditService.record({
        requestId: report.requestId,
        actor: report.actor,
        targetType: 'install',
        targetId: updated.installId,
        action: INSTALL_SYNCED_EVENT,
        details: {
          status: updated.status,
          desktopLocalState: updated.lastDesktopLocalState,
          reconcileState: updated.lastDesktopReconcileState,
        },
        occurredAt: now,
      });
      if (nextStatus === 'installed') {
        input.notifyService.notify({
          userId: updated.userId,
          category: 'install',
          title: 'Install ready',
          body: `${updated.skillId}@${updated.version} is now available locally.`,
          now,
          metadata: {
            installId: updated.installId,
            reconcileState: updated.lastDesktopReconcileState,
          },
        });
      }
      return updated;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   installId: string;
     *   desktopLocalState: string;
     *   reconcileState: string;
     *   failureReason: string;
     *   now?: Date;
     * }} report
     */
    recordDesktopFailure(report) {
      const now = report.now ?? new Date();
      const install = requireInstall(input.installRepository.getInstall, report.installId);
      const updated = input.installRepository.saveInstall({
        ...install,
        updatedAt: now.toISOString(),
        lastDesktopSyncAt: now.toISOString(),
        lastDesktopLocalState: report.desktopLocalState,
        lastDesktopReconcileState: report.reconcileState,
        lastFailureReason: report.failureReason,
      });

      input.auditService.record({
        requestId: report.requestId,
        actor: report.actor,
        targetType: 'install',
        targetId: updated.installId,
        action: INSTALL_BLOCKED_EVENT,
        details: {
          desktopLocalState: updated.lastDesktopLocalState,
          reconcileState: updated.lastDesktopReconcileState,
          failureReason: updated.lastFailureReason,
        },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: updated.userId,
        category: 'install',
        title: 'Install requires attention',
        body: `${updated.skillId}@${updated.version} is blocked: ${report.failureReason}.`,
        now,
        metadata: {
          installId: updated.installId,
          reconcileState: updated.lastDesktopReconcileState,
        },
      });
      return updated;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   installId: string;
     *   now?: Date;
     * }} request
     */
    activateInstall(request) {
      const now = request.now ?? new Date();
      const install = requireInstall(input.installRepository.getInstall, request.installId);
      if (!['installed', 'inactive', 'active'].includes(install.status)) {
        throw new Error(`Install cannot be activated from state: ${install.status}`);
      }
      const updated = input.installRepository.saveInstall({
        ...install,
        status: 'active',
        updatedAt: now.toISOString(),
      });
      input.auditService.record({
        requestId: request.requestId,
        actor: request.actor,
        targetType: 'install',
        targetId: updated.installId,
        action: INSTALL_ACTIVATED_EVENT,
        details: {
          target: updated.target,
        },
        occurredAt: now,
      });
      return updated;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   installId: string;
     *   now?: Date;
     * }} request
     */
    deactivateInstall(request) {
      const now = request.now ?? new Date();
      const install = requireInstall(input.installRepository.getInstall, request.installId);
      if (!['installed', 'inactive', 'active'].includes(install.status)) {
        throw new Error(`Install cannot be deactivated from state: ${install.status}`);
      }
      const updated = input.installRepository.saveInstall({
        ...install,
        status: 'inactive',
        updatedAt: now.toISOString(),
      });
      input.auditService.record({
        requestId: request.requestId,
        actor: request.actor,
        targetType: 'install',
        targetId: updated.installId,
        action: INSTALL_DEACTIVATED_EVENT,
        details: {
          target: updated.target,
        },
        occurredAt: now,
      });
      return updated;
    },

    /**
     * @param {string} installId
     */
    getInstall(installId) {
      return requireInstall(input.installRepository.getInstall, installId);
    },

    /**
     * @param {string} userId
     */
    listInstalls(userId) {
      return input.installRepository.listInstallsByUserId(userId);
    },
  });
}
