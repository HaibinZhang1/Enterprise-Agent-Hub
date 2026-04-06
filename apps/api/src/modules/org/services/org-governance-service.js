import { completeScopeChangeJob, planUserAssignmentChange } from '../core/scope-governance.js';

/**
 * @param {ReturnType<typeof import('../../auth/repositories/memory-auth-repository.js').createMemoryAuthRepository>} authRepository
 * @param {string} userId
 */
function requireUser(authRepository, userId) {
  const user = authRepository.findUserById(userId);
  if (!user) {
    throw new Error(`Unknown user: ${userId}`);
  }
  return user;
}

/**
 * @param {{
 *   authRepository: ReturnType<typeof import('../../auth/repositories/memory-auth-repository.js').createMemoryAuthRepository>;
 *   scopeJobRepository: ReturnType<typeof import('../repositories/memory-scope-job-repository.js').createMemoryScopeJobRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 *   notifyService: ReturnType<typeof import('../../notify/services/notify-service.js').createNotifyService>;
 * }} input
 */
export function createOrgGovernanceService(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; departmentId: string | null; roleCode: string; now?: Date }} reassignInput
     */
    reassignUser(reassignInput) {
      const now = reassignInput.now ?? new Date();
      const user = requireUser(input.authRepository, reassignInput.userId);
      const assignmentPlan = planUserAssignmentChange({
        userId: reassignInput.userId,
        currentAuthzVersion: user.authzVersion,
        previousAssignment: {
          departmentId: user.departmentId,
          roleCode: user.roleCode,
        },
        nextAssignment: {
          departmentId: reassignInput.departmentId,
          roleCode: reassignInput.roleCode,
        },
        changedBy: reassignInput.actor.userId,
        requestedAt: now,
      });
      const updatedUser = input.authRepository.updateUser({
        ...user,
        departmentId: reassignInput.departmentId,
        roleCode: reassignInput.roleCode,
        authzRecalcPending: true,
        pendingAuthzVersion: assignmentPlan.scopeChangeJob.targetAuthzVersion,
      });
      const scopeChangeJob = input.scopeJobRepository.save(assignmentPlan.scopeChangeJob);

      input.auditService.record({
        requestId: reassignInput.requestId,
        actor: reassignInput.actor,
        targetType: 'user',
        targetId: reassignInput.userId,
        action: 'org.user.assignment.changed',
        details: {
          roleCode: reassignInput.roleCode,
          departmentId: reassignInput.departmentId,
          targetAuthzVersion: assignmentPlan.scopeChangeJob.targetAuthzVersion,
        },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: reassignInput.userId,
        category: 'org',
        title: 'Permissions are being recalculated',
        body: 'Sign-in is blocked until the new department and role scope converges.',
        now,
      });

      return Object.freeze({ user: updatedUser, scopeChangeJob });
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; now?: Date }} convergenceInput
     */
    completeScopeConvergence(convergenceInput) {
      const now = convergenceInput.now ?? new Date();
      const user = requireUser(input.authRepository, convergenceInput.userId);
      const pendingJob = input.scopeJobRepository.findPendingByUserId(convergenceInput.userId);
      if (!pendingJob) {
        throw new Error(`No pending scope job for user: ${convergenceInput.userId}`);
      }
      const completedJob = input.scopeJobRepository.save(
        /** @type {Parameters<ReturnType<typeof import('../repositories/memory-scope-job-repository.js').createMemoryScopeJobRepository>['save']>[0]} */ (
          completeScopeChangeJob({
            scopeChangeJob: pendingJob,
            completedAt: now,
          })
        ),
      );
      if (!completedJob.event) {
        throw new Error(`Completed scope job missing event: ${completedJob.jobId}`);
      }
      const nextUser = input.authRepository.updateUser({
        ...user,
        authzVersion: completedJob.targetAuthzVersion,
        authzRecalcPending: false,
        pendingAuthzVersion: null,
      });

      input.auditService.record({
        requestId: convergenceInput.requestId,
        actor: convergenceInput.actor,
        targetType: 'user',
        targetId: convergenceInput.userId,
        action: completedJob.event.type,
        details: { authzVersion: completedJob.targetAuthzVersion },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: convergenceInput.userId,
        category: 'org',
        title: 'Permissions updated',
        body: 'Permissions converged. Sign in again to refresh your access scope.',
        now,
      });

      return Object.freeze({ user: nextUser, scopeChangeJob: completedJob });
    },
  });
}
