import { AUTH_PENDING_CODE } from '@enterprise-agent-hub/contracts';

import { evaluateProtectedRequest } from '../core/access-policy.js';
import { evaluateAccountLockState, PASSWORD_POLICY, registerFailedLoginAttempt, validatePasswordCandidate } from '../core/credential-policy.js';
import { buildSessionSchedule } from '../core/session-policy.js';

const LOGIN_SUCCESS_AUDIT_EVENT = 'AUTH_LOGIN_SUCCEEDED';
const PASSWORD_CHANGED_AUDIT_EVENT = 'AUTH_PASSWORD_CHANGED';

/**
 * @param {string} code
 * @param {string} reason
 */
function deny(code, reason) {
  return Object.freeze({ ok: false, code, reason });
}

/**
 * @param {{
 *   user: import('../repositories/memory-auth-repository.js').ManagedUser;
 *   session: import('../repositories/memory-auth-repository.js').AuthSessionRecord;
 *   accessExpiresAt: Date;
 *   issuedAt: Date;
 * }} input
 */
function buildAccessToken(input) {
  return Object.freeze({
    sub: input.user.userId,
    sid: input.session.sessionId,
    authzVersion: input.user.authzVersion,
    provider: input.user.provider,
    jti: `jti-${input.session.sessionId}`,
    iat: input.issuedAt.toISOString(),
    exp: input.accessExpiresAt.toISOString(),
    roleCode: input.user.roleCode,
    departmentId: input.user.departmentId,
  });
}

/**
 * @param {{ authRepository: ReturnType<typeof import('../repositories/memory-auth-repository.js').createMemoryAuthRepository>; auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService> }} input
 */
export function createAuthService(input) {
  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   username: string;
     *   password: string;
     *   clientType: 'desktop' | 'web' | 'api';
     *   deviceLabel: string;
     *   now?: Date;
     * }} loginInput
     */
    login(loginInput) {
      const now = loginInput.now ?? new Date();
      const user = input.authRepository.findUserByUsername(loginInput.username);
      if (!user) {
        return deny('AUTH_INVALID_CREDENTIALS', 'invalid_credentials');
      }

      const credential = input.authRepository.getCredential(user.userId);
      if (!credential) {
        return deny('AUTH_INVALID_CREDENTIALS', 'invalid_credentials');
      }

      const lockState = evaluateAccountLockState({
        now,
        lockedUntil: credential.lockedUntil ? new Date(credential.lockedUntil) : null,
      });
      if (lockState.locked) {
        return deny('AUTH_ACCOUNT_LOCKED', 'account_locked');
      }

      if (credential.password !== loginInput.password) {
        const nextFailure = registerFailedLoginAttempt({
          failedAttemptCount: credential.failedAttemptCount,
          now,
        });
        input.authRepository.saveCredential({
          ...credential,
          failedAttemptCount: nextFailure.nextFailedAttemptCount,
          lockedUntil: nextFailure.lockedUntil ? nextFailure.lockedUntil.toISOString() : null,
        });
        return deny(
          nextFailure.lockedUntil ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_INVALID_CREDENTIALS',
          nextFailure.lockedUntil ? 'account_locked' : 'invalid_credentials',
        );
      }

      if (user.status === 'frozen') {
        return deny('AUTH_ACCOUNT_FROZEN', 'user_frozen');
      }

      if (user.authzRecalcPending) {
        return deny(AUTH_PENDING_CODE, 'authz_recalc_pending');
      }

      input.authRepository.saveCredential({
        ...credential,
        failedAttemptCount: 0,
        lockedUntil: null,
      });

      const updatedUser = input.authRepository.updateUser({
        ...user,
        lastLoginAt: now.toISOString(),
      });
      const sessionId = input.authRepository.nextSessionId(updatedUser.userId);
      const refreshTokenValue = `refresh-${sessionId}`;
      const schedule = buildSessionSchedule(now);
      const session = input.authRepository.saveSession({
        sessionId,
        userId: updatedUser.userId,
        sessionFamilyId: sessionId,
        parentSessionId: null,
        clientType: loginInput.clientType,
        deviceLabel: loginInput.deviceLabel,
        refreshTokenHash: `hash:${refreshTokenValue}`,
        issuedAuthzVersion: updatedUser.authzVersion,
        issuedAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        expiresAt: schedule.refreshExpiresAt.toISOString(),
        idleExpiresAt: schedule.idleExpiresAt.toISOString(),
        revokedAt: null,
        revokeReason: null,
      });

      input.auditService.record({
        requestId: loginInput.requestId,
        actor: {
          userId: updatedUser.userId,
          username: updatedUser.username,
          roleCode: updatedUser.roleCode,
          departmentId: updatedUser.departmentId,
        },
        targetType: 'user',
        targetId: updatedUser.userId,
        action: LOGIN_SUCCESS_AUDIT_EVENT,
        details: {
          sessionId: session.sessionId,
          clientType: session.clientType,
        },
        occurredAt: now,
      });

      return Object.freeze({
        ok: true,
        user: updatedUser,
        accessToken: buildAccessToken({
          user: updatedUser,
          session,
          accessExpiresAt: schedule.accessExpiresAt,
          issuedAt: now,
        }),
        refreshToken: Object.freeze({
          value: refreshTokenValue,
          sessionFamilyId: session.sessionFamilyId,
          expiresAt: session.expiresAt,
          idleExpiresAt: session.idleExpiresAt,
        }),
        session,
      });
    },

    /**
     * @param {{ requestId: string; userId: string; tokenAuthzVersion: number; sessionId?: string }} authorizeInput
     */
    authorize(authorizeInput) {
      const user = input.authRepository.findUserById(authorizeInput.userId);
      if (!user) {
        throw new Error(`Unknown user: ${authorizeInput.userId}`);
      }

      if (authorizeInput.sessionId) {
        const session = input.authRepository.getSession(authorizeInput.sessionId);
        if (!session || session.userId !== authorizeInput.userId || session.revokedAt !== null) {
          return deny('AUTH_SESSION_REVOKED', 'session_revoked');
        }
      }

      const decision = evaluateProtectedRequest({
        userStatus: user.status,
        tokenAuthzVersion: authorizeInput.tokenAuthzVersion,
        currentAuthzVersion: user.authzVersion,
        authzRecalcPending: user.authzRecalcPending,
      });

      return decision.allowed ? Object.freeze({ ok: true, user }) : deny(decision.code, decision.reason);
    },

    /**
     * @param {{
     *   requestId: string;
     *   userId: string;
     *   currentPassword: string;
     *   nextPassword: string;
     *   now?: Date;
     * }} changePasswordInput
     */
    changePassword(changePasswordInput) {
      const now = changePasswordInput.now ?? new Date();
      const user = input.authRepository.findUserById(changePasswordInput.userId);
      if (!user) {
        throw new Error(`Unknown user: ${changePasswordInput.userId}`);
      }

      const credential = input.authRepository.getCredential(changePasswordInput.userId);
      if (!credential) {
        throw new Error(`Missing credential record for user: ${changePasswordInput.userId}`);
      }

      const lockState = evaluateAccountLockState({
        now,
        lockedUntil: credential.lockedUntil ? new Date(credential.lockedUntil) : null,
      });
      if (lockState.locked) {
        return deny('AUTH_ACCOUNT_LOCKED', 'account_locked');
      }

      if (credential.password !== changePasswordInput.currentPassword) {
        const nextFailure = registerFailedLoginAttempt({
          failedAttemptCount: credential.failedAttemptCount,
          now,
        });
        input.authRepository.saveCredential({
          ...credential,
          failedAttemptCount: nextFailure.nextFailedAttemptCount,
          lockedUntil: nextFailure.lockedUntil ? nextFailure.lockedUntil.toISOString() : null,
        });
        return deny(
          nextFailure.lockedUntil ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_INVALID_CREDENTIALS',
          nextFailure.lockedUntil ? 'account_locked' : 'invalid_credentials',
        );
      }

      const nextPasswordPolicy = validatePasswordCandidate({
        password: changePasswordInput.nextPassword,
        recentPasswords: [credential.password, ...credential.passwordHistory],
      });
      if (!nextPasswordPolicy.valid) {
        throw new Error(`Password policy rejected: ${nextPasswordPolicy.errors.join(', ')}`);
      }

      input.authRepository.saveCredential({
        ...credential,
        password: changePasswordInput.nextPassword,
        passwordHistory: [credential.password, ...credential.passwordHistory].slice(0, PASSWORD_POLICY.historyWindowSize),
        temporaryCredentialMode: 'permanent',
        failedAttemptCount: 0,
        lockedUntil: null,
        passwordChangedAt: now.toISOString(),
      });
      input.authRepository.revokeUserSessions({
        userId: changePasswordInput.userId,
        revokedAt: now.toISOString(),
        revokeReason: 'password_changed',
      });

      const nextUser = input.authRepository.updateUser({
        ...user,
        mustChangePassword: false,
      });
      input.auditService.record({
        requestId: changePasswordInput.requestId,
        actor: {
          userId: nextUser.userId,
          username: nextUser.username,
          roleCode: nextUser.roleCode,
          departmentId: nextUser.departmentId,
        },
        targetType: 'user',
        targetId: nextUser.userId,
        action: PASSWORD_CHANGED_AUDIT_EVENT,
        occurredAt: now,
      });

      return Object.freeze({
        ok: true,
        user: nextUser,
      });
    },
  });
}
