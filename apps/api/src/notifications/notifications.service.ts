import { Injectable } from '@nestjs/common';
import { NotificationDto, PageResponse, pageOf } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';

export interface NotificationsQuery {
  unreadOnly?: string;
  page?: string;
  pageSize?: string;
}

export interface MarkReadRequest {
  notificationIDs?: string[];
  all?: boolean;
}

interface NotificationRow {
  id: string;
  type: NotificationDto['type'];
  title: string;
  summary: string;
  object_type: NotificationDto['objectType'] | null;
  object_id: string | null;
  read_at: Date | null;
  created_at: Date;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userID: string, query: NotificationsQuery): Promise<PageResponse<NotificationDto>> {
    const page = positiveInt(query.page, 1);
    const pageSize = positiveInt(query.pageSize, 20, 100);
    const values: unknown[] = [userID];
    const unreadClause = query.unreadOnly === 'true' ? 'AND read_at IS NULL' : '';
    const result = await this.database.query<NotificationRow>(
      `
      SELECT id, type, title, summary, object_type, object_id, read_at, created_at
      FROM notifications
      WHERE user_id = $1 ${unreadClause}
      ORDER BY created_at DESC
      `,
      values,
    );
    const items = result.rows.map(toNotification);
    const start = (page - 1) * pageSize;
    return pageOf(items.slice(start, start + pageSize), page, pageSize, items.length);
  }

  async markRead(userID: string, request: MarkReadRequest): Promise<{ unreadNotificationCount: number }> {
    if (request.all) {
      await this.database.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userID]);
    } else if ((request.notificationIDs ?? []).length > 0) {
      await this.database.query(
        'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::text[])',
        [userID, request.notificationIDs],
      );
    }

    const count = await this.database.one<{ count: string }>(
      'SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userID],
    );
    return { unreadNotificationCount: Number(count?.count ?? 0) };
  }
}

function toNotification(row: NotificationRow): NotificationDto {
  return {
    notificationID: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    objectType: row.object_type ?? undefined,
    objectID: row.object_id ?? undefined,
    createdAt: row.created_at.toISOString(),
    read: row.read_at !== null,
    action: row.object_type === 'skill' && row.object_id ? `/skills/${row.object_id}` : '/notifications',
  };
}

function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}
