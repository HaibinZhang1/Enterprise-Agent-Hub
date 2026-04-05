export const SESSION_POLICY = Object.freeze({
  accessTtlMinutes: 15,
  refreshAbsoluteTtlDays: 30,
  refreshIdleTtlDays: 7,
});

/**
 * @param {Date} issuedAt
 */
export function buildSessionSchedule(issuedAt) {
  const issuedMs = issuedAt.getTime();

  return Object.freeze({
    issuedAt,
    accessExpiresAt: new Date(issuedMs + SESSION_POLICY.accessTtlMinutes * 60 * 1000),
    refreshExpiresAt: new Date(issuedMs + SESSION_POLICY.refreshAbsoluteTtlDays * 24 * 60 * 60 * 1000),
    idleExpiresAt: new Date(issuedMs + SESSION_POLICY.refreshIdleTtlDays * 24 * 60 * 60 * 1000),
  });
}
