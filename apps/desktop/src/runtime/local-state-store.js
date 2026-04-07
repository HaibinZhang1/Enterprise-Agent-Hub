/**
 * @typedef {{
 *   installId: string;
 *   skillId: string;
 *   version: string;
 *   localState: string;
 *   reconcileState: string;
 *   activationState: 'active' | 'inactive';
 *   target: { type: 'tool' | 'project'; id: string };
 *   failureReason: string | null;
 *   updatedAt: string;
 * }} DesktopInstallCache
 */

/**
 * @param {DesktopInstallCache} cache
 */
function freezeCache(cache) {
  return Object.freeze({
    ...cache,
    target: Object.freeze({ ...cache.target }),
  });
}

/**
 * @param {{ jobId: string; installId: string; operation: string; state: string; failureReason: string | null; updatedAt: string }} job
 */
function freezeJob(job) {
  return Object.freeze({ ...job });
}

/**
 * @param {{ conflictId: string; installId: string; targetKey: string; decision: string; decidedAt: string }} resolution
 */
function freezeResolution(resolution) {
  return Object.freeze({ ...resolution });
}

export function createLocalStateStore() {
  /** @type {Map<string, DesktopInstallCache>} */
  const installCacheById = new Map();
  /** @type {Map<string, ReturnType<typeof freezeJob>[]>} */
  const jobsByInstallId = new Map();
  /** @type {Map<string, ReturnType<typeof freezeResolution>[]>} */
  const resolutionsByInstallId = new Map();
  /** @type {Map<string, { installId: string; source: 'desktop' | 'external' }>} */
  const occupancyByTarget = new Map();
  let syncJobSequence = 1;
  let conflictSequence = 1;

  return Object.freeze({
    /**
     * @param {DesktopInstallCache} cache
     */
    saveInstallCache(cache) {
      const stored = freezeCache(cache);
      installCacheById.set(stored.installId, stored);
      return stored;
    },

    /**
     * @param {string} installId
     */
    getInstallCache(installId) {
      return installCacheById.get(installId) ?? null;
    },

    /**
     * @param {{ installId: string; operation: string; state: string; failureReason?: string | null; updatedAt: string }} job
     */
    appendSyncJob(job) {
      const stored = freezeJob({
        jobId: `sync-job-${syncJobSequence}`,
        installId: job.installId,
        operation: job.operation,
        state: job.state,
        failureReason: job.failureReason ?? null,
        updatedAt: job.updatedAt,
      });
      syncJobSequence += 1;
      const existing = jobsByInstallId.get(job.installId) ?? [];
      existing.push(stored);
      jobsByInstallId.set(job.installId, existing);
      return stored;
    },

    /**
     * @param {string} installId
     */
    listSyncJobs(installId) {
      return Object.freeze([...(jobsByInstallId.get(installId) ?? [])]);
    },

    /**
     * @param {{ installId: string; targetKey: string; decision: string; decidedAt: string }} resolution
     */
    saveConflictResolution(resolution) {
      const stored = freezeResolution({
        conflictId: `conflict-${conflictSequence}`,
        installId: resolution.installId,
        targetKey: resolution.targetKey,
        decision: resolution.decision,
        decidedAt: resolution.decidedAt,
      });
      conflictSequence += 1;
      const existing = resolutionsByInstallId.get(resolution.installId) ?? [];
      existing.push(stored);
      resolutionsByInstallId.set(resolution.installId, existing);
      return stored;
    },

    /**
     * @param {string} installId
     */
    listConflictResolutions(installId) {
      return Object.freeze([...(resolutionsByInstallId.get(installId) ?? [])]);
    },

    /**
     * @param {{ type: 'tool' | 'project'; id: string }} target
     */
    getOccupant(target) {
      return occupancyByTarget.get(`${target.type}:${target.id}`) ?? null;
    },

    /**
     * @param {{ type: 'tool' | 'project'; id: string }} target
     * @param {{ installId: string; source: 'desktop' | 'external' }} occupant
     */
    occupyTarget(target, occupant) {
      occupancyByTarget.set(`${target.type}:${target.id}`, Object.freeze({ ...occupant }));
      return this.getOccupant(target);
    },

    /**
     * @param {{ type: 'tool' | 'project'; id: string }} target
     */
    releaseTarget(target) {
      occupancyByTarget.delete(`${target.type}:${target.id}`);
    },
  });
}
