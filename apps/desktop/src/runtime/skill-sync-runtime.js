/**
 * @param {'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked'} serverStatus
 */
function deriveActivationState(serverStatus) {
  return serverStatus === 'active' ? 'active' : 'inactive';
}

/**
 * @param {{
 *   installId: string;
 *   skillId: string;
 *   version: string;
 *   target: { type: 'tool' | 'project'; id: string };
 *   status: 'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked';
 *   now: Date;
 *   localState: string;
 *   reconcileState: string;
 *   failureReason?: string | null;
 * }} input
 */
function buildCache(input) {
  return Object.freeze({
    installId: input.installId,
    skillId: input.skillId,
    version: input.version,
    localState: input.localState,
    reconcileState: input.reconcileState,
    activationState: deriveActivationState(input.status),
    target: Object.freeze({ ...input.target }),
    failureReason: input.failureReason ?? null,
    updatedAt: input.now.toISOString(),
  });
}

/**
 * @param {{
 *   localStateStore: ReturnType<typeof import('./local-state-store.js').createLocalStateStore>;
 *   conflictResolver: ReturnType<typeof import('./conflict-resolver-runtime.js').createConflictResolverRuntime>;
 * }} input
 */
export function createSkillSyncRuntime(input) {
  return Object.freeze({
    /**
     * @param {{ installRecord: { installId: string; skillId: string; version: string; target: { type: 'tool' | 'project'; id: string }; status: 'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked' }; online?: boolean; now?: Date }} request
     */
    syncInstall(request) {
      const now = request.now ?? new Date();
      input.localStateStore.appendSyncJob({
        installId: request.installRecord.installId,
        operation: 'download-sync',
        state: 'started',
        updatedAt: now.toISOString(),
      });

      if (request.online === false) {
        input.localStateStore.appendSyncJob({
          installId: request.installRecord.installId,
          operation: 'download-sync',
          state: 'failed',
          failureReason: 'offline_blocked',
          updatedAt: now.toISOString(),
        });
        return Object.freeze({
          ok: false,
          cache: input.localStateStore.saveInstallCache(buildCache({
            ...request.installRecord,
            now,
            localState: 'rollback_required',
            reconcileState: 'offline_blocked',
            failureReason: 'offline_blocked',
          })),
          failureReason: 'offline_blocked',
        });
      }

      const conflict = input.conflictResolver.detectConflict({
        installId: request.installRecord.installId,
        target: request.installRecord.target,
      });
      if (conflict) {
        input.localStateStore.appendSyncJob({
          installId: request.installRecord.installId,
          operation: 'download-sync',
          state: 'failed',
          failureReason: 'target_conflict',
          updatedAt: now.toISOString(),
        });
        return Object.freeze({
          ok: false,
          cache: input.localStateStore.saveInstallCache(buildCache({
            ...request.installRecord,
            now,
            localState: 'rollback_required',
            reconcileState: 'repair_required',
            failureReason: 'target_conflict',
          })),
          failureReason: 'target_conflict',
          conflict,
        });
      }

      for (const operation of ['download', 'extract', 'apply']) {
        input.localStateStore.appendSyncJob({
          installId: request.installRecord.installId,
          operation,
          state: 'completed',
          updatedAt: now.toISOString(),
        });
      }
      input.localStateStore.occupyTarget(request.installRecord.target, {
        installId: request.installRecord.installId,
        source: 'desktop',
      });
      return Object.freeze({
        ok: true,
        cache: input.localStateStore.saveInstallCache(buildCache({
          ...request.installRecord,
          now,
          localState: 'applied',
          reconcileState: 'in_sync',
        })),
      });
    },

    /**
     * @param {{ installRecord: { installId: string; skillId: string; version: string; target: { type: 'tool' | 'project'; id: string }; status: 'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked' }; online?: boolean; now?: Date }} request
     */
    applyServerState(request) {
      const now = request.now ?? new Date();
      const current = input.localStateStore.getInstallCache(request.installRecord.installId);
      if (request.online === false) {
        return Object.freeze({
          ok: false,
          cache: input.localStateStore.saveInstallCache(buildCache({
            ...request.installRecord,
            now,
            localState: current?.localState ?? 'rollback_required',
            reconcileState: 'offline_blocked',
            failureReason: 'offline_blocked',
          })),
          failureReason: 'offline_blocked',
        });
      }

      if (!current) {
        return Object.freeze({
          ok: false,
          cache: input.localStateStore.saveInstallCache(buildCache({
            ...request.installRecord,
            now,
            localState: 'rollback_required',
            reconcileState: 'desktop_drift',
            failureReason: 'desktop_drift',
          })),
          failureReason: 'desktop_drift',
        });
      }

      const operation = request.installRecord.status === 'active' ? 'activate' : 'deactivate';
      input.localStateStore.appendSyncJob({
        installId: request.installRecord.installId,
        operation,
        state: 'completed',
        updatedAt: now.toISOString(),
      });
      return Object.freeze({
        ok: true,
        cache: input.localStateStore.saveInstallCache(buildCache({
          ...request.installRecord,
          now,
          localState: current.localState,
          reconcileState: 'in_sync',
        })),
      });
    },

    /**
     * @param {{ installRecord: { installId: string; skillId: string; version: string; target: { type: 'tool' | 'project'; id: string }; status: 'requested' | 'installed' | 'active' | 'inactive' | 'uninstalled' | 'blocked' }; online?: boolean; now?: Date }} request
     */
    recoverInstall(request) {
      const current = input.localStateStore.getInstallCache(request.installRecord.installId);
      if (current && ['active', 'inactive'].includes(request.installRecord.status)) {
        return this.applyServerState(request);
      }
      return this.syncInstall(request);
    },
  });
}
