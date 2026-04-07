import {
  AUTH_BOOTSTRAP_DISABLED,
  AUTH_BOOTSTRAP_TICKET_INVALID,
  createBootstrapAdminPlan,
  validateBootstrapTicket,
} from '../core/bootstrap-policy.js';

const BOOTSTRAP_AUDIT_EVENT = 'AUTH_BOOTSTRAP_ADMIN';
const BOOTSTRAP_ACTOR = Object.freeze({
  userId: 'bootstrap-system',
  username: 'bootstrap',
  roleCode: 'bootstrap_system',
  departmentId: null,
});

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
 * @param {string} code
 * @param {string} reason
 */
function deny(code, reason) {
  return Object.freeze({ ok: false, code, reason });
}

/**
 * @param {{
 *   authRepository: ReturnType<typeof import('../repositories/memory-auth-repository.js').createMemoryAuthRepository>;
 *   bootstrapTicketRepository: ReturnType<typeof import('../repositories/memory-bootstrap-ticket-repository.js').createMemoryBootstrapTicketRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 *   notifyService: ReturnType<typeof import('../../notify/services/notify-service.js').createNotifyService>;
 * }} input
 */
export function createBootstrapService(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; now?: Date }} issueInput
     */
    issueTicket(issueInput) {
      if (input.bootstrapTicketRepository.isSystemInitialized()) {
        return deny(AUTH_BOOTSTRAP_DISABLED, 'system_initialized');
      }

      const now = issueInput.now ?? new Date();
      const ticket = input.bootstrapTicketRepository.issueTicket({
        issuedAt: now.toISOString(),
        expiresAt: null,
      });

      return Object.freeze({
        ok: true,
        ticket: Object.freeze({
          ticketId: ticket.ticketId,
          value: ticket.secret,
          issuedAt: ticket.issuedAt,
          expiresAt: ticket.expiresAt,
        }),
      });
    },

    /**
     * @param {{
     *   requestId: string;
     *   bootstrapTicket: string;
     *   userId: string;
     *   username: string;
     *   displayName: string;
     *   departmentId?: string | null;
     *   now?: Date;
     * }} bootstrapInput
     */
    bootstrapAdmin(bootstrapInput) {
      const now = bootstrapInput.now ?? new Date();
      const ticket = input.bootstrapTicketRepository.getCurrentTicket();

      if (!ticket || ticket.secret !== bootstrapInput.bootstrapTicket) {
        return deny(AUTH_BOOTSTRAP_TICKET_INVALID, 'ticket_invalid');
      }

      const decision = validateBootstrapTicket({
        now,
        systemInitialized: input.bootstrapTicketRepository.isSystemInitialized(),
        ticket: {
          issuedAt: new Date(ticket.issuedAt),
          consumedAt: ticket.consumedAt ? new Date(ticket.consumedAt) : null,
          expiresAt: ticket.expiresAt ? new Date(ticket.expiresAt) : null,
        },
      });

      if (!decision.allowed) {
        return deny(decision.code, decision.reason);
      }

      const plan = createBootstrapAdminPlan({
        username: bootstrapInput.username,
        displayName: bootstrapInput.displayName,
        departmentId: bootstrapInput.departmentId ?? null,
      });

      const user = input.authRepository.createUser({
        userId: bootstrapInput.userId,
        username: plan.user.username,
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

      const temporaryCredential = createTemporaryCredential('bootstrap', bootstrapInput.userId, now);
      input.authRepository.saveCredential({
        userId: bootstrapInput.userId,
        password: temporaryCredential,
        passwordHistory: [],
        temporaryCredentialMode: 'bootstrap-ticket',
        failedAttemptCount: 0,
        lockedUntil: null,
        passwordChangedAt: now.toISOString(),
      });

      input.bootstrapTicketRepository.consumeCurrentTicket({ consumedAt: now.toISOString() });
      input.bootstrapTicketRepository.markInitialized();

      input.auditService.record({
        requestId: bootstrapInput.requestId,
        actor: BOOTSTRAP_ACTOR,
        targetType: 'user',
        targetId: bootstrapInput.userId,
        action: BOOTSTRAP_AUDIT_EVENT,
        details: {
          ticketId: ticket.ticketId,
          username: bootstrapInput.username,
        },
        occurredAt: now,
      });
      input.notifyService.notify({
        userId: bootstrapInput.userId,
        category: 'auth',
        title: 'Bootstrap admin provisioned',
        body: 'Use the one-time credential to sign in, then change your password immediately.',
        now,
      });

      return Object.freeze({
        ok: true,
        user,
        temporaryCredential,
      });
    },
  });
}
