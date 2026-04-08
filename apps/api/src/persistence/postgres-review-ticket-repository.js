// @ts-nocheck
import { execSql, queryMany, queryOne, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function mapTicket(row) {
  return row
    ? Object.freeze({
        ticketId: row.ticketId,
        skillId: row.skillId,
        packageId: row.packageId,
        requestedBy: row.requestedBy,
        reviewerId: row.reviewerId,
        status: row.status,
        createdAt: row.createdAt,
        claimedBy: row.claimedBy ?? null,
        claimedAt: row.claimedAt ?? null,
        claimExpiresAt: row.claimExpiresAt ?? null,
        decision: row.decision ?? null,
        lastEvent: row.lastEvent,
      })
    : null;
}

export function createPostgresReviewTicketRepository(input) {
  const databaseUrl = input.databaseUrl;

  function buildListWhere(filters) {
    const parts = [];
    if (filters.reviewerId) {
      parts.push(`reviewer_id = ${sqlUuid(filters.reviewerId)}`);
    }
    if (filters.status) {
      parts.push(`status = ${sqlLiteral(filters.status)}`);
    }
    return parts.length > 0 ? `where ${parts.join(' and ')}` : '';
  }

  function select(whereSql) {
    return mapTicket(
      queryOne(
        databaseUrl,
        `
          select
            ticket_id as "ticketId",
            skill_id as "skillId",
            package_id as "packageId",
            requested_by::text as "requestedBy",
            reviewer_id::text as "reviewerId",
            status,
            created_at::text as "createdAt",
            (decision->>'approvedBy') as "claimedBy",
            (decision->>'approvedAt') as "claimedAt",
            null::text as "claimExpiresAt",
            decision,
            status as "lastEvent"
          from review.tickets
          ${whereSql}
        `,
      ),
    );
  }

  return Object.freeze({
    save(ticket) {
      execSql(
        databaseUrl,
        `
          insert into review.tickets (
            ticket_id, skill_id, package_id, requested_by, reviewer_id,
            status, comment, created_at, updated_at
          ) values (
            ${sqlLiteral(ticket.ticketId)},
            ${sqlLiteral(ticket.skillId)},
            ${sqlLiteral(ticket.packageId)},
            ${sqlUuid(ticket.requestedBy)},
            ${sqlUuid(ticket.reviewerId)},
            ${sqlLiteral(ticket.status)},
            ${sqlLiteral(ticket.decision?.comment ?? null)},
            ${sqlLiteral(ticket.createdAt)}::timestamptz,
            ${sqlLiteral(ticket.decision?.approvedAt ?? ticket.claimedAt ?? ticket.createdAt)}::timestamptz
          )
          on conflict (ticket_id) do update set
            skill_id = excluded.skill_id,
            package_id = excluded.package_id,
            requested_by = excluded.requested_by,
            reviewer_id = excluded.reviewer_id,
            status = excluded.status,
            comment = excluded.comment,
            updated_at = excluded.updated_at
        `,
      );
      return this.get(ticket.ticketId);
    },

    get(ticketId) {
      return mapTicket(
        queryOne(
          databaseUrl,
          `
            select
              ticket_id as "ticketId",
              skill_id as "skillId",
              package_id as "packageId",
              requested_by::text as "requestedBy",
              reviewer_id::text as "reviewerId",
              status,
              created_at::text as "createdAt",
              null::text as "claimedBy",
              null::text as "claimedAt",
              null::text as "claimExpiresAt",
              case
                when comment is null then null
                else json_build_object(
                  'outcome', case when status = 'approved' then 'approved' else status end,
                  'comment', comment,
                  'approvedAt', updated_at::text,
                  'approvedBy', reviewer_id::text
                )
              end as decision,
              status as "lastEvent"
            from review.tickets
            where ticket_id = ${sqlLiteral(ticketId)}
          `,
        ),
      );
    },

    list(inputValue = {}) {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              ticket_id as "ticketId",
              skill_id as "skillId",
              package_id as "packageId",
              requested_by::text as "requestedBy",
              reviewer_id::text as "reviewerId",
              status,
              created_at::text as "createdAt",
              null::text as "claimedBy",
              null::text as "claimedAt",
              null::text as "claimExpiresAt",
              case
                when comment is null then null
                else json_build_object(
                  'outcome', case when status = 'approved' then 'approved' else status end,
                  'comment', comment,
                  'approvedAt', updated_at::text,
                  'approvedBy', reviewer_id::text
                )
              end as decision,
              status as "lastEvent"
            from review.tickets
            ${buildListWhere(inputValue)}
            order by created_at desc
          `,
        ).map(mapTicket),
      );
    },
  });
}
