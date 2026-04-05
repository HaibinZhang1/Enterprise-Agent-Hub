export const BOOTSTRAP_TICKET_TTL_MINUTES = 10;
export const AUTH_BOOTSTRAP_DISABLED = 'AUTH_BOOTSTRAP_DISABLED';
export const AUTH_BOOTSTRAP_TICKET_INVALID = 'AUTH_BOOTSTRAP_TICKET_INVALID';

/**
 * @param {{
 *   now: Date;
 *   ticket: {
 *     issuedAt: Date;
 *     consumedAt?: Date | null;
 *     expiresAt?: Date | null;
 *   };
 *   systemInitialized: boolean;
 * }} input
 */
export function validateBootstrapTicket(input) {
  if (input.systemInitialized) {
    return Object.freeze({
      allowed: false,
      code: AUTH_BOOTSTRAP_DISABLED,
      reason: 'system_initialized',
    });
  }

  if (input.ticket.consumedAt) {
    return Object.freeze({
      allowed: false,
      code: AUTH_BOOTSTRAP_TICKET_INVALID,
      reason: 'ticket_consumed',
    });
  }

  const expiresAt =
    input.ticket.expiresAt ??
    new Date(input.ticket.issuedAt.getTime() + BOOTSTRAP_TICKET_TTL_MINUTES * 60 * 1000);

  if (expiresAt.getTime() <= input.now.getTime()) {
    return Object.freeze({
      allowed: false,
      code: AUTH_BOOTSTRAP_TICKET_INVALID,
      reason: 'ticket_expired',
    });
  }

  return Object.freeze({
    allowed: true,
    expiresAt,
  });
}

/**
 * @param {{
 *   username: string;
 *   displayName: string;
 *   departmentId: string | null;
 * }} input
 */
export function createBootstrapAdminPlan(input) {
  return Object.freeze({
    user: {
      username: input.username,
      displayName: input.displayName,
      departmentId: input.departmentId,
      roleCode: 'system_admin_lv1',
      status: 'active',
      mustChangePassword: true,
      provider: 'local',
    },
    bootstrap: {
      requiresOneTimeTicket: true,
      disableBootstrapAfterSuccess: true,
    },
  });
}
