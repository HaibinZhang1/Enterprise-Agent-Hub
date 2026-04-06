import { createAuditLogEntry } from '../core/log-entry.js';

/**
 * @param {{ auditRepository: ReturnType<typeof import('../repositories/memory-audit-log-repository.js').createMemoryAuditLogRepository> }} input
 */
export function createAuditService(input) {
  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   targetType: string;
     *   targetId: string;
     *   action: string;
     *   details?: Record<string, unknown>;
     *   occurredAt?: Date;
     * }} entryInput
     */
    record(entryInput) {
      return input.auditRepository.append(createAuditLogEntry(entryInput));
    },

    list() {
      return input.auditRepository.list();
    },
  });
}
