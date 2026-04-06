/**
 * @typedef {ReturnType<import('../core/log-entry.js').createAuditLogEntry>} AuditLogEntry
 */

export function createMemoryAuditLogRepository() {
  /** @type {AuditLogEntry[]} */
  const entries = [];

  return Object.freeze({
    /**
     * @param {AuditLogEntry} entry
     */
    append(entry) {
      entries.push(entry);
      return entry;
    },

    list() {
      return Object.freeze([...entries]);
    },
  });
}
