import { evaluateProtectedRequest } from '../modules/auth/core/access-policy.js';
import { planManagedUserCreation, planFreezeUser, planPasswordReset, planUnfreezeUser } from '../modules/auth/core/user-lifecycle-policy.js';
import { createAuditLogEntry } from '../modules/audit/core/log-entry.js';
import { createNotificationCenter } from '../modules/notify/core/notification-center.js';
import { completeScopeChangeJob, planUserAssignmentChange } from '../modules/org/core/scope-governance.js';

/**
 * @param {{ userId: string; username: string; roleCode: string; departmentId?: string | null }} actor
 */
function cloneActor(actor) {
  return {
    userId: actor.userId,
    username: actor.username,
    roleCode: actor.roleCode,
    departmentId: actor.departmentId ?? null,
  };
}

export function createAdminGovernanceRuntime() {
  const users = new Map();
  /** @type {ReturnType<typeof createAuditLogEntry>[]} */
  const auditLogs = [];
  /** @type {(ReturnType<typeof planUserAssignmentChange>['scopeChangeJob'] | ReturnType<typeof completeScopeChangeJob>)[]} */
  const scopeJobs = [];
  const notifications = createNotificationCenter();

  /**
   * @param {string} userId
   */
  function requireUser(userId) {
    const user = users.get(userId);
    if (!user) {
      throw new Error(`Unknown user: ${userId}`);
    }
    return user;
  }

  /**
   * @param {ReturnType<typeof createAuditLogEntry>} entry
   */
  function appendAudit(entry) {
    auditLogs.push(entry);
    return entry;
  }

  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   username: string;
     *   departmentId: string | null;
     *   roleCode: string;
     *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
     *   now?: Date;
     * }} input
     */
    provisionUser(input) {
      const plan = planManagedUserCreation({
        username: input.username,
        departmentId: input.departmentId,
        roleCode: input.roleCode,
        createdBy: input.actor.userId,
        temporaryCredentialMode: input.temporaryCredentialMode,
      });

      const user = Object.freeze({
        userId: input.userId,
        username: input.username,
        departmentId: plan.user.departmentId,
        roleCode: plan.user.roleCode,
        status: plan.user.status,
        authzVersion: 1,
        authzRecalcPending: false,
        pendingAuthzVersion: null,
        mustChangePassword: plan.user.mustChangePassword,
      });

      users.set(input.userId, user);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: plan.auditEvent,
          details: { roleCode: input.roleCode, departmentId: input.departmentId },
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'auth',
        title: 'Account provisioned',
        body: 'Your temporary credential requires a password change on first login.',
        now: input.now,
      });

      return user;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   departmentId: string | null;
     *   roleCode: string;
     *   now?: Date;
     * }} input
     */
    reassignUser(input) {
      const user = requireUser(input.userId);
      const assignmentPlan = planUserAssignmentChange({
        userId: input.userId,
        currentAuthzVersion: user.authzVersion,
        previousAssignment: {
          departmentId: user.departmentId,
          roleCode: user.roleCode,
        },
        nextAssignment: {
          departmentId: input.departmentId,
          roleCode: input.roleCode,
        },
        changedBy: input.actor.userId,
        requestedAt: input.now,
      });

      const updatedUser = Object.freeze({
        ...user,
        departmentId: input.departmentId,
        roleCode: input.roleCode,
        authzRecalcPending: true,
        pendingAuthzVersion: assignmentPlan.scopeChangeJob.targetAuthzVersion,
      });

      users.set(input.userId, updatedUser);
      scopeJobs.push(assignmentPlan.scopeChangeJob);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: 'org.user.assignment.changed',
          details: {
            roleCode: input.roleCode,
            departmentId: input.departmentId,
            targetAuthzVersion: assignmentPlan.scopeChangeJob.targetAuthzVersion,
          },
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'org',
        title: 'Permissions are being recalculated',
        body: 'Sign-in is blocked until the new department and role scope converges.',
        now: input.now,
      });

      return Object.freeze({ user: updatedUser, scopeChangeJob: assignmentPlan.scopeChangeJob });
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   now?: Date;
     * }} input
     */
    completeScopeConvergence(input) {
      const user = requireUser(input.userId);
      const pendingJob = scopeJobs.find((job) => job.userId === input.userId && job.status === 'pending');
      if (!pendingJob) {
        throw new Error(`No pending scope job for user: ${input.userId}`);
      }

      const completedJob = completeScopeChangeJob({
        scopeChangeJob: pendingJob,
        completedAt: input.now,
      });
      const nextUser = Object.freeze({
        ...user,
        authzVersion: completedJob.targetAuthzVersion,
        authzRecalcPending: false,
        pendingAuthzVersion: null,
      });
      users.set(input.userId, nextUser);
      scopeJobs.splice(scopeJobs.indexOf(pendingJob), 1, completedJob);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: completedJob.event.type,
          details: { authzVersion: completedJob.targetAuthzVersion },
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'org',
        title: 'Permissions updated',
        body: 'Permissions converged. Sign in again to refresh your access scope.',
        now: input.now,
      });

      return Object.freeze({ user: nextUser, scopeChangeJob: completedJob });
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   reason: string;
     *   now?: Date;
     * }} input
     */
    freezeUser(input) {
      const user = requireUser(input.userId);
      const plan = planFreezeUser({ currentAuthzVersion: user.authzVersion, reason: input.reason });
      const nextUser = Object.freeze({
        ...user,
        status: plan.nextStatus,
        authzVersion: plan.nextAuthzVersion,
      });
      users.set(input.userId, nextUser);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: plan.auditEvent,
          details: plan.auditMetadata,
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'auth',
        title: 'Account frozen',
        body: input.reason,
        now: input.now,
      });
      return nextUser;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   now?: Date;
     * }} input
     */
    unfreezeUser(input) {
      const user = requireUser(input.userId);
      const plan = planUnfreezeUser({ currentAuthzVersion: user.authzVersion });
      const nextUser = Object.freeze({
        ...user,
        status: plan.nextStatus,
        authzVersion: plan.nextAuthzVersion,
      });
      users.set(input.userId, nextUser);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: plan.auditEvent,
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'auth',
        title: 'Account restored',
        body: 'Please sign in again to continue.',
        now: input.now,
      });
      return nextUser;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   userId: string;
     *   temporaryCredentialMode: 'temporary-password' | 'reset-ticket';
     *   now?: Date;
     * }} input
     */
    resetPassword(input) {
      const user = requireUser(input.userId);
      const plan = planPasswordReset({
        currentAuthzVersion: user.authzVersion,
        temporaryCredentialMode: input.temporaryCredentialMode,
      });
      const nextUser = Object.freeze({
        ...user,
        authzVersion: plan.nextAuthzVersion,
        mustChangePassword: plan.mustChangePassword,
      });
      users.set(input.userId, nextUser);
      appendAudit(
        createAuditLogEntry({
          requestId: input.requestId,
          actor: cloneActor(input.actor),
          targetType: 'user',
          targetId: input.userId,
          action: plan.auditEvent,
          details: { temporaryCredentialMode: plan.temporaryCredentialMode },
          occurredAt: input.now,
        }),
      );
      notifications.notify({
        userId: input.userId,
        category: 'auth',
        title: 'Password reset required',
        body: 'A temporary credential was issued and all active sessions were revoked.',
        now: input.now,
      });
      return nextUser;
    },

    /**
     * @param {{ userId: string; tokenAuthzVersion: number }} input
     */
    evaluateAccess(input) {
      const user = requireUser(input.userId);
      return evaluateProtectedRequest({
        userStatus: user.status,
        tokenAuthzVersion: input.tokenAuthzVersion,
        currentAuthzVersion: user.authzVersion,
        authzRecalcPending: user.authzRecalcPending,
      });
    },

    /**
     * @param {string} userId
     */
    getUser(userId) {
      return requireUser(userId);
    },

    getAuditTrail() {
      return Object.freeze([...auditLogs]);
    },

    /**
     * @param {string} userId
     */
    getBadges(userId) {
      return notifications.getBadges({ userId });
    },

    /**
     * @param {string} userId
     */
    listNotifications(userId) {
      return notifications.listNotifications({ userId });
    },

    /**
     * @param {string} userId
     */
    drainEvents(userId) {
      return notifications.drainEvents({ userId, includeReconnect: true });
    },
  });
}
