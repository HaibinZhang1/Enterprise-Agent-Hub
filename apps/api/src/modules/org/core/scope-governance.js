import { AUTH_PENDING_CODE } from '@enterprise-agent-hub/contracts';

export const ORG_EVENTS = Object.freeze({
  assignmentChanged: 'org.user.assignment.changed',
  scopeRecalcRequested: 'org.scope.recalc.requested',
  scopeRecalcCompleted: 'org.scope.recalc.completed',
});

/**
 * @param {{
 *   userId: string;
 *   currentAuthzVersion: number;
 *   previousAssignment: { departmentId: string | null; roleCode: string } | null;
 *   nextAssignment: { departmentId: string | null; roleCode: string };
 *   changedBy: string;
 *   requestedAt?: Date;
 * }} input
 */
export function planUserAssignmentChange(input) {
  const requestedAt = input.requestedAt ?? new Date();
  const targetAuthzVersion = input.currentAuthzVersion + 1;

  return Object.freeze({
    assignment: Object.freeze({
      previous: input.previousAssignment,
      next: Object.freeze({ ...input.nextAssignment }),
    }),
    accessGuard: Object.freeze({
      pendingCode: AUTH_PENDING_CODE,
      currentAuthzVersion: input.currentAuthzVersion,
      targetAuthzVersion,
      authzRecalcPending: true,
    }),
    scopeChangeJob: Object.freeze({
      jobId: `scope-${input.userId}-${targetAuthzVersion}`,
      userId: input.userId,
      requestedBy: input.changedBy,
      requestedAt: requestedAt.toISOString(),
      targetAuthzVersion,
      status: 'pending',
      reason: 'user_assignment_changed',
    }),
    events: Object.freeze([
      Object.freeze({
        type: ORG_EVENTS.assignmentChanged,
        userId: input.userId,
        requestedBy: input.changedBy,
        requestedAt: requestedAt.toISOString(),
      }),
      Object.freeze({
        type: ORG_EVENTS.scopeRecalcRequested,
        userId: input.userId,
        requestedBy: input.changedBy,
        requestedAt: requestedAt.toISOString(),
        targetAuthzVersion,
      }),
    ]),
  });
}

/**
 * @param {{
 *   scopeChangeJob: { jobId: string; userId: string; targetAuthzVersion: number };
 *   completedAt?: Date;
 * }} input
 */
export function completeScopeChangeJob(input) {
  const completedAt = input.completedAt ?? new Date();

  return Object.freeze({
    ...input.scopeChangeJob,
    status: 'completed',
    completedAt: completedAt.toISOString(),
    event: Object.freeze({
      type: ORG_EVENTS.scopeRecalcCompleted,
      userId: input.scopeChangeJob.userId,
      targetAuthzVersion: input.scopeChangeJob.targetAuthzVersion,
      completedAt: completedAt.toISOString(),
    }),
  });
}
