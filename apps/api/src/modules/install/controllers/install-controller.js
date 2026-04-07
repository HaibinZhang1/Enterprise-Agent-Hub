/**
 * @param {{ installService: ReturnType<typeof import('../services/install-service.js').createInstallService> }} input
 */
export function createInstallController(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; skillId: string; version: string; target: { type: 'tool' | 'project'; id: string }; now?: Date }} installRequest
     */
    requestInstall(installRequest) {
      return input.installService.requestInstall(installRequest);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; desktopLocalState: string; reconcileState: string; now?: Date }} syncReport
     */
    recordDesktopSync(syncReport) {
      return input.installService.recordDesktopSync(syncReport);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; desktopLocalState: string; reconcileState: string; failureReason: string; now?: Date }} failureReport
     */
    recordDesktopFailure(failureReport) {
      return input.installService.recordDesktopFailure(failureReport);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; now?: Date }} activationRequest
     */
    activateInstall(activationRequest) {
      return input.installService.activateInstall(activationRequest);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; now?: Date }} deactivationRequest
     */
    deactivateInstall(deactivationRequest) {
      return input.installService.deactivateInstall(deactivationRequest);
    },

    /**
     * @param {string} installId
     */
    getInstall(installId) {
      return input.installService.getInstall(installId);
    },

    /**
     * @param {string} userId
     */
    listInstalls(userId) {
      return input.installService.listInstalls(userId);
    },
  });
}
