/**
 * @param {{
 *   actorId: string;
 *   username: string;
 *   roleCode: string;
 *   departmentId: string | null;
 *   ipAddress: string;
 * }} input
 */
export function createActorSnapshot(input) {
  return Object.freeze({
    actorId: input.actorId,
    username: input.username,
    roleCode: input.roleCode,
    departmentId: input.departmentId,
    ipAddress: input.ipAddress,
  });
}

/**
 * @param {{
 *   requestId: string;
 *   actorSnapshot: ReturnType<typeof createActorSnapshot>;
 *   targetType: string;
 *   targetId: string;
 *   action: string;
 *   result: 'success' | 'blocked' | 'failed';
 *   reason?: string;
 *   occurredAt: Date;
 *   metadata?: Record<string, unknown>;
 * }} input
 */
export function createAuditLogEntry(input) {
  return Object.freeze({
    requestId: input.requestId,
    actorSnapshot: input.actorSnapshot,
    targetType: input.targetType,
    targetId: input.targetId,
    action: input.action,
    result: input.result,
    reason: input.reason ?? null,
    occurredAt: input.occurredAt.toISOString(),
    metadata: input.metadata ?? {},
  });
}
