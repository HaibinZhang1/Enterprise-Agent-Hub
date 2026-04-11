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
        resolution: row.resolution ?? null,
        lastEvent: row.lastEvent,
      })
    : null;
}

function mapHistory(row) {
  return row
    ? Object.freeze({
        ticketId: row.ticketId,
        sequence: row.sequence,
        action: row.action,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        actorId: row.actorId,
        comment: row.comment ?? '',
        createdAt: row.createdAt,
        metadata: row.metadata ?? {},
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

  function lastEventSql() {
    return `
      case
        when resolution is not null and status = 'returned' then 'review.ticket.returned'
        when resolution is not null and status = 'rejected' then 'review.ticket.rejected'
        when decision is not null and status = 'approved' then 'review.ticket.approved'
        when claimed_by is not null and status = 'in_progress' then 'review.ticket.claimed'
        else 'review.ticket.created'
      end
    `;
  }

  return Object.freeze({
    save(ticket) {
      execSql(
        databaseUrl,
        `
          insert into review.tickets (
            ticket_id, skill_id, package_id, requested_by, reviewer_id,
            status, comment, claimed_by, claimed_at, claim_expires_at, decision, resolution, created_at, updated_at
          ) values (
            ${sqlLiteral(ticket.ticketId)},
            ${sqlLiteral(ticket.skillId)},
            ${sqlLiteral(ticket.packageId)},
            ${sqlUuid(ticket.requestedBy)},
            ${sqlUuid(ticket.reviewerId)},
            ${sqlLiteral(ticket.status)},
            ${sqlLiteral(ticket.decision?.comment ?? ticket.resolution?.comment ?? null)},
            ${sqlUuid(ticket.claimedBy)},
            ${ticket.claimedAt ? `${sqlLiteral(ticket.claimedAt)}::timestamptz` : 'null'},
            ${ticket.claimExpiresAt ? `${sqlLiteral(ticket.claimExpiresAt)}::timestamptz` : 'null'},
            ${sqlJson(ticket.decision)},
            ${sqlJson(ticket.resolution)},
            ${sqlLiteral(ticket.createdAt)}::timestamptz,
            ${sqlLiteral(ticket.resolution?.resolvedAt ?? ticket.decision?.approvedAt ?? ticket.claimedAt ?? ticket.createdAt)}::timestamptz
          )
          on conflict (ticket_id) do update set
            skill_id = excluded.skill_id,
            package_id = excluded.package_id,
            requested_by = excluded.requested_by,
            reviewer_id = excluded.reviewer_id,
            status = excluded.status,
            comment = excluded.comment,
            claimed_by = excluded.claimed_by,
            claimed_at = excluded.claimed_at,
            claim_expires_at = excluded.claim_expires_at,
            decision = excluded.decision,
            resolution = excluded.resolution,
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
              claimed_by::text as "claimedBy",
              claimed_at::text as "claimedAt",
              claim_expires_at::text as "claimExpiresAt",
              decision,
              resolution,
              ${lastEventSql()} as "lastEvent"
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
              claimed_by::text as "claimedBy",
              claimed_at::text as "claimedAt",
              claim_expires_at::text as "claimExpiresAt",
              decision,
              resolution,
              ${lastEventSql()} as "lastEvent"
            from review.tickets
            ${buildListWhere(inputValue)}
            order by created_at desc
          `,
        ).map(mapTicket),
      );
    },

    appendHistory(entry) {
      execSql(
        databaseUrl,
        `
          insert into review.ticket_history (
            ticket_id,
            sequence_no,
            action,
            from_status,
            to_status,
            actor_id,
            comment,
            metadata,
            created_at
          ) values (
            ${sqlLiteral(entry.ticketId)},
            coalesce((select max(sequence_no) + 1 from review.ticket_history where ticket_id = ${sqlLiteral(entry.ticketId)}), 1),
            ${sqlLiteral(entry.action)},
            ${sqlLiteral(entry.fromStatus)},
            ${sqlLiteral(entry.toStatus)},
            ${sqlUuid(entry.actorId)},
            ${sqlLiteral(entry.comment ?? '')},
            ${sqlJson(entry.metadata ?? {})},
            ${sqlLiteral(entry.createdAt)}::timestamptz
          )
        `,
      );
      const history = this.listHistory(entry.ticketId);
      return history[history.length - 1] ?? null;
    },

    listHistory(ticketId) {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              ticket_id as "ticketId",
              sequence_no as "sequence",
              action,
              from_status as "fromStatus",
              to_status as "toStatus",
              actor_id::text as "actorId",
              comment,
              metadata,
              created_at::text as "createdAt"
            from review.ticket_history
            where ticket_id = ${sqlLiteral(ticketId)}
            order by created_at asc, sequence_no asc
          `,
        ).map(mapHistory),
      );
    },
  });
}
