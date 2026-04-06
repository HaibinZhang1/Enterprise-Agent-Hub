import { planFreezeUser, planManagedUserCreation, planPasswordReset, planUnfreezeUser } from '../core/user-lifecycle-policy.js';

/**
 * @param {string} prefix
 * @param {string} userId
 * @param {Date} now
 */
function createTemporaryCredential(prefix, userId, now) {
  const compactTimestamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${prefix}-${userId}-${compactTimestamp}`;
}

/**
 * @param {ReturnType<typeof import('../repositories/memory-auth-repository.js').createMemoryAuthRepository>} authRepository
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
 * @param {ReturnType<typeof import('../repositories/memory-auth-repository.js').createMemoryAuthRepository>} authRepository
 * @param {string} userId
 */
function requireCredential(authRepository, userId) {
  const credential = authRepository.getCredential(userId);
  if (!credential) {
    throw new Error(`Missing credential record for user: ${userId}`);
  }
  return credential;
}

/**
 * @param {{
 *   authRepository: ReturnType<typeof import('../repositories/memory-auth-repository.js').createMemoryAuthRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 *   notifyService: ReturnType<typeof import('../../notify/services/notify-service.js').createNotifyService>;
 * }} input
 */
export function createAuthAdminService(input) {
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
     * }} provisionInput
     */
    provisionUser(provisionInput) {
      const now = provisionInput.now ?? new Date();
      const plan = planManagedUserCreation({
        username: provisionInput.username,
        departmentId: provisionInput.departmentId,
        roleCode: provisionInput.roleCode,
        createdBy: provisionInput.actor.userId,
        temporaryCredentialMode: provisionInput.temporaryCredentialMode,
      });
      const user = input.authRepository.createUser({
        userId: provisionInput.userId,
        username: provisionInput.username,
        departmentId: plan.user.departmentId,
        roleCode: plan.user.roleCode,
        status: 'active',
        authzVersion: 1,
        authzRecalcPending: false,
        pendingAuthzVersion: null,
        mustChangePassword: plan.user.mustChangePassword,
        lastLoginAt: null,
        provider: 'local',
      });
      const temporaryCredential = createTemporaryCredential('temp', provisionInput.userId, now);
      input.authRepository.saveCredential({
        userId: provisionInput.userId,
        password: temporaryCredential,
        passwordHistory: [],
        temporaryCredentialMode: plan.credential.mode,
        failedAttemptCount: 0,
        lockedUntil: null,
        passwordChangedAt: now.toISOString(),
      });

      input.auditService.record({
        requestId: provisionInput.requestId,
        actor: provisionInput.actor,
        targetType: 'user',
        targetId: provisionInput.userId,
        action: plan.auditEvent,
        details: {
          roleCode: provisionInput.roleCode,
          departmentId: provisionInput.departmentId,
        },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: provisionInput.userId,
        category: 'auth',
        title: 'Account provisioned',
        body: 'Your temporary credential requires a password change on first login.',
        now,
      });

      return Object.freeze({ user, temporaryCredential });
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; reason: string; now?: Date }} freezeInput
     */
    freezeUser(freezeInput) {
      const now = freezeInput.now ?? new Date();
      const user = requireUser(input.authRepository, freezeInput.userId);
      const plan = planFreezeUser({ currentAuthzVersion: user.authzVersion, reason: freezeInput.reason });
      const nextUser = input.authRepository.updateUser({
        ...user,
        status: plan.nextStatus,
        authzVersion: plan.nextAuthzVersion,
      });
      input.authRepository.revokeUserSessions({
        userId: freezeInput.userId,
        revokedAt: now.toISOString(),
        revokeReason: 'user_frozen',
      });
      input.auditService.record({
        requestId: freezeInput.requestId,
        actor: freezeInput.actor,
        targetType: 'user',
        targetId: freezeInput.userId,
        action: plan.auditEvent,
        details: plan.auditMetadata,
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: freezeInput.userId,
        category: 'auth',
        title: 'Account frozen',
        body: freezeInput.reason,
        now,
      });
      return nextUser;
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; now?: Date }} unfreezeInput
     */
    unfreezeUser(unfreezeInput) {
      const now = unfreezeInput.now ?? new Date();
      const user = requireUser(input.authRepository, unfreezeInput.userId);
      const plan = planUnfreezeUser({ currentAuthzVersion: user.authzVersion });
      const nextUser = input.authRepository.updateUser({
        ...user,
        status: plan.nextStatus,
        authzVersion: plan.nextAuthzVersion,
      });
      input.auditService.record({
        requestId: unfreezeInput.requestId,
        actor: unfreezeInput.actor,
        targetType: 'user',
        targetId: unfreezeInput.userId,
        action: plan.auditEvent,
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: unfreezeInput.userId,
        category: 'auth',
        title: 'Account restored',
        body: 'Please sign in again to continue.',
        now,
      });
      return nextUser;
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; temporaryCredentialMode: 'temporary-password' | 'reset-ticket'; now?: Date }} resetInput
     */
    resetPassword(resetInput) {
      const now = resetInput.now ?? new Date();
      const user = requireUser(input.authRepository, resetInput.userId);
      const credential = requireCredential(input.authRepository, resetInput.userId);
      const plan = planPasswordReset({
        currentAuthzVersion: user.authzVersion,
        temporaryCredentialMode: resetInput.temporaryCredentialMode,
      });
      const nextUser = input.authRepository.updateUser({
        ...user,
        authzVersion: plan.nextAuthzVersion,
        mustChangePassword: plan.mustChangePassword,
      });
      const temporaryCredential = createTemporaryCredential('reset', resetInput.userId, now);
      input.authRepository.saveCredential({
        ...credential,
        password: temporaryCredential,
        passwordHistory: [credential.password, ...credential.passwordHistory].slice(0, 5),
        temporaryCredentialMode: plan.temporaryCredentialMode,
        failedAttemptCount: 0,
        lockedUntil: null,
        passwordChangedAt: now.toISOString(),
      });
      input.authRepository.revokeUserSessions({
        userId: resetInput.userId,
        revokedAt: now.toISOString(),
        revokeReason: 'password_reset',
      });
      input.auditService.record({
        requestId: resetInput.requestId,
        actor: resetInput.actor,
        targetType: 'user',
        targetId: resetInput.userId,
        action: plan.auditEvent,
        details: { temporaryCredentialMode: plan.temporaryCredentialMode },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: resetInput.userId,
        category: 'auth',
        title: 'Password reset required',
        body: 'A temporary credential was issued and all active sessions were revoked.',
        now,
      });
      return Object.freeze({ user: nextUser, temporaryCredential });
    },
  });
}
