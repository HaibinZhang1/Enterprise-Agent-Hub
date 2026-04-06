/**
 * @typedef {{
 *   jobId: string;
 *   userId: string;
 *   requestedBy: string;
 *   requestedAt: string;
 *   targetAuthzVersion: number;
 *   status: 'pending' | 'completed';
 *   reason: string;
 *   completedAt?: string;
 *   event?: Readonly<{ type: string; userId: string; targetAuthzVersion: number; completedAt: string }>;
 * }} ScopeChangeJob
 */

/**
 * @param {ScopeChangeJob} job
 */
function freezeJob(job) {
  return Object.freeze({
    ...job,
    event: job.event ? Object.freeze({ ...job.event }) : undefined,
  });
}

export function createMemoryScopeJobRepository() {
  /** @type {Map<string, ScopeChangeJob>} */
  const jobsById = new Map();

  return Object.freeze({
    /**
     * @param {ScopeChangeJob} job
     */
    save(job) {
      const stored = freezeJob(job);
      jobsById.set(stored.jobId, stored);
      return stored;
    },

    /**
     * @param {string} userId
     */
    findPendingByUserId(userId) {
      for (const job of jobsById.values()) {
        if (job.userId === userId && job.status === 'pending') {
          return job;
        }
      }
      return null;
    },
  });
}
