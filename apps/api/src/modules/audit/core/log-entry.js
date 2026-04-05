/**
 * @param {{
 *   userId: string;
 *   username: string;
 *   roleCode: string;
 *   departmentId?: string | null;
 * }} actor
 */
export function createActorSnapshot(actor) {
  return Object.freeze({
    userId: actor.userId,
    username: actor.username,
    roleCode: actor.roleCode,
    departmentId: actor.departmentId ?? null,
  });
}

/**
 * @param {{
 *   requestId: string;
 *   action: string;
 *   targetType: string;
 *   targetId: string;
 *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
 *   result?: 'success' | 'blocked' | 'failed';
 *   reason?: string | null;
 *   occurredAt?: Date;
 *   details?: Record<string, unknown>;
 * }} input
 */
export function createAuditLogEntry(input) {
  const occurredAt = input.occurredAt ?? new Date();

  return Object.freeze({
    requestId: input.requestId,
    actorSnapshot: createActorSnapshot(input.actor),
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    result: input.result ?? 'success',
    reason: input.reason ?? null,
    occurredAt: occurredAt.toISOString(),
    details: Object.freeze({ ...(input.details ?? {}) }),
  });
}
