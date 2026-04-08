// @ts-nocheck
import { randomUUID } from 'node:crypto';

import { execSql, queryMany, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapEntry(row) {
  return Object.freeze({
    requestId: row.requestId,
    actorSnapshot: Object.freeze({
      userId: row.actorUserId,
      username: row.actorUsername,
      roleCode: row.actorRoleCode,
      departmentId: row.actorDepartmentId ?? null,
    }),
    targetType: row.targetType,
    targetId: row.targetId,
    action: row.action,
    result: row.result,
    reason: row.reason ?? null,
    occurredAt: row.occurredAt,
    details: Object.freeze({ ...(row.details ?? {}) }),
  });
}

export function createPostgresAuditLogRepository(input) {
  const databaseUrl = input.databaseUrl;

  return Object.freeze({
    append(entry) {
      execSql(
        databaseUrl,
        `
          insert into audit.log_entries (
            id, request_id, actor_user_id, actor_username, actor_role_code, actor_department_id,
            target_type, target_id, action, result, reason, details, occurred_at
          ) values (
            ${sqlUuid(randomUUID())},
            ${sqlLiteral(entry.requestId)},
            ${sqlUuid(entry.actorSnapshot.userId)},
            ${sqlLiteral(entry.actorSnapshot.username)},
            ${sqlLiteral(entry.actorSnapshot.roleCode)},
            ${sqlUuid(entry.actorSnapshot.departmentId)},
            ${sqlLiteral(entry.targetType)},
            ${sqlLiteral(entry.targetId)},
            ${sqlLiteral(entry.action)},
            ${sqlLiteral(entry.result)},
            ${sqlLiteral(entry.reason)},
            ${sqlJson(entry.details ?? {})},
            ${sqlLiteral(entry.occurredAt)}::timestamptz
          )
        `,
      );
      return entry;
    },

    list() {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              request_id as "requestId",
              actor_user_id::text as "actorUserId",
              actor_username as "actorUsername",
              actor_role_code as "actorRoleCode",
              actor_department_id::text as "actorDepartmentId",
              target_type as "targetType",
              target_id as "targetId",
              action,
              result,
              reason,
              details,
              occurred_at::text as "occurredAt"
            from audit.log_entries
            order by occurred_at asc
          `,
        ).map(mapEntry),
      );
    },
  });
}
