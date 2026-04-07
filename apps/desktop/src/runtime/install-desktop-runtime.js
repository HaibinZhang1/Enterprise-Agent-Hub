import { createConflictResolverRuntime } from './conflict-resolver-runtime.js';
import { createLocalStateStore } from './local-state-store.js';
import { createSkillSyncRuntime } from './skill-sync-runtime.js';

/**
 * @param {{ installController: ReturnType<typeof import('../../../api/src/modules/install/controllers/install-controller.js').createInstallController> }} input
 */
export function createInstallDesktopRuntime(input) {
  const localStateStore = createLocalStateStore();
  const conflictResolver = createConflictResolverRuntime({ localStateStore });
  const skillSyncRuntime = createSkillSyncRuntime({ localStateStore, conflictResolver });

  return Object.freeze({
    /**
     * @param {{ type: 'tool' | 'project'; id: string; installId?: string }} target
     */
    seedOccupiedTarget(target) {
      return localStateStore.occupyTarget(target, {
        installId: target.installId ?? 'external-install',
        source: target.installId ? 'desktop' : 'external',
      });
    },

    /**
     * @param {{ installId: string; target: { type: 'tool' | 'project'; id: string }; decision: 'overwrite' | 'cancel'; now?: Date }} request
     */
    resolveConflict(request) {
      return conflictResolver.resolveConflict(request);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; online?: boolean; now?: Date }} request
     */
    syncInstall(request) {
      const installRecord = input.installController.getInstall(request.installId);
      const result = skillSyncRuntime.syncInstall({
        installRecord,
        online: request.online,
        now: request.now,
      });
      if (result.ok) {
        const serverInstall = input.installController.recordDesktopSync({
          requestId: request.requestId,
          actor: request.actor,
          installId: request.installId,
          desktopLocalState: result.cache.localState,
          reconcileState: result.cache.reconcileState,
          now: request.now,
        });
        return Object.freeze({ ok: true, serverInstall, localInstall: result.cache });
      }
      const serverInstall = input.installController.recordDesktopFailure({
        requestId: request.requestId,
        actor: request.actor,
        installId: request.installId,
        desktopLocalState: result.cache.localState,
        reconcileState: result.cache.reconcileState,
        failureReason: result.failureReason,
        now: request.now,
      });
      return Object.freeze({
        ok: false,
        serverInstall,
        localInstall: result.cache,
        failureReason: result.failureReason,
        conflict: 'conflict' in result ? result.conflict ?? null : null,
      });
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; online?: boolean; now?: Date }} request
     */
    activateInstall(request) {
      const serverInstall = input.installController.activateInstall(request);
      const result = skillSyncRuntime.applyServerState({
        installRecord: serverInstall,
        online: request.online,
        now: request.now,
      });
      if (result.ok) {
        const syncedInstall = input.installController.recordDesktopSync({
          requestId: `${request.requestId}-desktop`,
          actor: request.actor,
          installId: request.installId,
          desktopLocalState: result.cache.localState,
          reconcileState: result.cache.reconcileState,
          now: request.now,
        });
        return Object.freeze({ ok: true, serverInstall: syncedInstall, localInstall: result.cache });
      }
      const blockedInstall = input.installController.recordDesktopFailure({
        requestId: `${request.requestId}-desktop`,
        actor: request.actor,
        installId: request.installId,
        desktopLocalState: result.cache.localState,
        reconcileState: result.cache.reconcileState,
        failureReason: result.failureReason,
        now: request.now,
      });
      return Object.freeze({ ok: false, serverInstall: blockedInstall, localInstall: result.cache, failureReason: result.failureReason });
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; online?: boolean; now?: Date }} request
     */
    deactivateInstall(request) {
      const serverInstall = input.installController.deactivateInstall(request);
      const result = skillSyncRuntime.applyServerState({
        installRecord: serverInstall,
        online: request.online,
        now: request.now,
      });
      if (result.ok) {
        const syncedInstall = input.installController.recordDesktopSync({
          requestId: `${request.requestId}-desktop`,
          actor: request.actor,
          installId: request.installId,
          desktopLocalState: result.cache.localState,
          reconcileState: result.cache.reconcileState,
          now: request.now,
        });
        return Object.freeze({ ok: true, serverInstall: syncedInstall, localInstall: result.cache });
      }
      const blockedInstall = input.installController.recordDesktopFailure({
        requestId: `${request.requestId}-desktop`,
        actor: request.actor,
        installId: request.installId,
        desktopLocalState: result.cache.localState,
        reconcileState: result.cache.reconcileState,
        failureReason: result.failureReason,
        now: request.now,
      });
      return Object.freeze({ ok: false, serverInstall: blockedInstall, localInstall: result.cache, failureReason: result.failureReason });
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; installId: string; online?: boolean; now?: Date }} request
     */
    recoverInstall(request) {
      const installRecord = input.installController.getInstall(request.installId);
      const result = skillSyncRuntime.recoverInstall({
        installRecord,
        online: request.online,
        now: request.now,
      });
      if (result.ok) {
        const serverInstall = input.installController.recordDesktopSync({
          requestId: request.requestId,
          actor: request.actor,
          installId: request.installId,
          desktopLocalState: result.cache.localState,
          reconcileState: result.cache.reconcileState,
          now: request.now,
        });
        return Object.freeze({ ok: true, serverInstall, localInstall: result.cache });
      }
      const serverInstall = input.installController.recordDesktopFailure({
        requestId: request.requestId,
        actor: request.actor,
        installId: request.installId,
        desktopLocalState: result.cache.localState,
        reconcileState: result.cache.reconcileState,
        failureReason: result.failureReason,
        now: request.now,
      });
      return Object.freeze({ ok: false, serverInstall, localInstall: result.cache, failureReason: result.failureReason });
    },

    /**
     * @param {string} installId
     */
    getLocalInstall(installId) {
      return localStateStore.getInstallCache(installId);
    },

    /**
     * @param {string} installId
     */
    listSyncJobs(installId) {
      return localStateStore.listSyncJobs(installId);
    },

    /**
     * @param {string} installId
     */
    listConflictResolutions(installId) {
      return localStateStore.listConflictResolutions(installId);
    },
  });
}
