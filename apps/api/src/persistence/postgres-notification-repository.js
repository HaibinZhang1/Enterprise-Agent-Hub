// @ts-nocheck
import { randomUUID } from 'node:crypto';

import { SSE_PAYLOAD_FIXTURE } from '@enterprise-agent-hub/contracts';

import { execSql, queryMany, sqlJson, sqlLiteral, sqlUuid } from '../lib/postgres-cli.js';

function createBadgeProjection(input) {
  return Object.freeze({
    unreadCount: input.unreadCount,
    reviewTodoCount: input.reviewTodoCount,
    updateAvailableCount: input.updateAvailableCount,
    generatedAt: input.generatedAt,
  });
}

function mapNotification(row) {
  return Object.freeze({
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
    metadata: Object.freeze({ ...(row.metadata ?? {}) }),
  });
}

export function createPostgresNotificationRepository(input) {
  const databaseUrl = input.databaseUrl;
  const listenersByUser = new Map();
  const queuedEventsByUser = new Map();

  function emit(userId, event) {
    const queued = queuedEventsByUser.get(userId) ?? [];
    queued.push(event);
    queuedEventsByUser.set(userId, queued);
    const listeners = listenersByUser.get(userId) ?? [];
    for (const listener of listeners) {
      listener(event);
    }
  }

  function getBadgesNow(userId, now = new Date()) {
    const counts = queryMany(
      databaseUrl,
      `
        select
          (select count(*)::int from notify.notifications where user_id = ${sqlUuid(userId)} and read_at is null) as "unreadCount",
          (select count(*)::int from review.tickets where reviewer_id = ${sqlUuid(userId)} and status = 'todo') as "reviewTodoCount",
          0 as "updateAvailableCount"
      `,
    )[0] ?? { unreadCount: 0, reviewTodoCount: 0, updateAvailableCount: 0 };
    return createBadgeProjection({
      unreadCount: Number(counts.unreadCount ?? 0),
      reviewTodoCount: Number(counts.reviewTodoCount ?? 0),
      updateAvailableCount: Number(counts.updateAvailableCount ?? 0),
      generatedAt: now.toISOString(),
    });
  }

  function emitBadge(userId, now = new Date()) {
    const badges = getBadgesNow(userId, now);
    emit(userId, Object.freeze({ event: SSE_PAYLOAD_FIXTURE.streams.badge.event, payload: badges }));
    return badges;
  }

  return Object.freeze({
    notify(inputValue) {
      const now = inputValue.now ?? new Date();
      const id = randomUUID();
      execSql(
        databaseUrl,
        `
          insert into notify.notifications (id, user_id, category, title, body, metadata, read_at, created_at)
          values (
            ${sqlUuid(id)},
            ${sqlUuid(inputValue.userId)},
            ${sqlLiteral(inputValue.category)},
            ${sqlLiteral(inputValue.title)},
            ${sqlLiteral(inputValue.body)},
            ${sqlJson(inputValue.metadata ?? {})},
            null,
            ${sqlLiteral(now.toISOString())}::timestamptz
          )
        `,
      );
      const notification = this.listNotifications({ userId: inputValue.userId })[0];
      emit(inputValue.userId, Object.freeze({ event: 'notification.created', payload: notification }));
      emitBadge(inputValue.userId, now);
      return notification;
    },

    setReviewTodoCount(inputValue) {
      const now = inputValue.now ?? new Date();
      emit(
        inputValue.userId,
        Object.freeze({
          event: SSE_PAYLOAD_FIXTURE.streams.reviewQueue.event,
          payload: Object.freeze({
            openTickets: inputValue.reviewTodoCount,
            overdueTickets: inputValue.overdueTickets ?? 0,
            generatedAt: now.toISOString(),
          }),
        }),
      );
      return emitBadge(inputValue.userId, now);
    },

    setUpdateAvailableCount(inputValue) {
      const now = inputValue.now ?? new Date();
      return emitBadge(inputValue.userId, now);
    },

    getBadges(inputValue) {
      return getBadgesNow(inputValue.userId, inputValue.now ?? new Date());
    },

    listNotifications(inputValue) {
      return Object.freeze(
        queryMany(
          databaseUrl,
          `
            select
              id::text as id,
              category,
              title,
              body,
              metadata,
              read_at::text as "readAt",
              created_at::text as "createdAt"
            from notify.notifications
            where user_id = ${sqlUuid(inputValue.userId)}
            order by created_at desc
          `,
        ).map(mapNotification),
      );
    },

    drainEvents(inputValue) {
      const queued = queuedEventsByUser.get(inputValue.userId) ?? [];
      queuedEventsByUser.set(inputValue.userId, []);
      const drained = [...queued];
      if (inputValue.includeReconnect) {
        drained.push(
          Object.freeze({
            event: SSE_PAYLOAD_FIXTURE.streams.reconnect.event,
            payload: Object.freeze({ ...SSE_PAYLOAD_FIXTURE.streams.reconnect.payload }),
          }),
        );
      }
      return Object.freeze(drained);
    },

    markRead(inputValue) {
      const now = inputValue.now ?? new Date();
      execSql(
        databaseUrl,
        `
          update notify.notifications
          set read_at = ${sqlLiteral(now.toISOString())}::timestamptz
          where id = ${sqlUuid(inputValue.notificationId)}
            and user_id = ${sqlUuid(inputValue.userId)}
            and read_at is null
        `,
      );
      return emitBadge(inputValue.userId, now);
    },

    readAll(inputValue) {
      const now = inputValue.now ?? new Date();
      execSql(
        databaseUrl,
        `
          update notify.notifications
          set read_at = ${sqlLiteral(now.toISOString())}::timestamptz
          where user_id = ${sqlUuid(inputValue.userId)}
            and read_at is null
        `,
      );
      return emitBadge(inputValue.userId, now);
    },

    subscribe(userId, listener) {
      const listeners = listenersByUser.get(userId) ?? [];
      listeners.push(listener);
      listenersByUser.set(userId, listeners);
      return () => {
        const next = (listenersByUser.get(userId) ?? []).filter((entry) => entry !== listener);
        listenersByUser.set(userId, next);
      };
    },
  });
}
