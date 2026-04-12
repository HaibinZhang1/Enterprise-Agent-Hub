import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionStatus, LocalEventDto, NotificationType, UserSummary } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';

export interface BootstrapResponse {
  user: UserSummary;
  connection: {
    status: ConnectionStatus;
    serverTime: string;
    apiVersion: string;
  };
  features: {
    p1Desktop: true;
    publishSkill: false;
    reviewWorkbench: false;
    adminManage: false;
    mcpManage: false;
    pluginManage: false;
  };
  counts: {
    installedCount: number;
    updateAvailableCount: number;
    unreadNotificationCount: number;
  };
  navigation: string[];
}

export interface LocalEventsRequest {
  deviceID?: string;
  events?: LocalEventDto[];
}

export interface LocalEventsResponse {
  acceptedEventIDs: string[];
  rejectedEvents: Array<{ eventID?: string; code: string; message: string }>;
  serverStateChanged: boolean;
  remoteNotices: Array<{ skillID?: string; noticeType: NotificationType; message: string }>;
}

@Injectable()
export class DesktopService {
  constructor(private readonly database: DatabaseService) {}

  async bootstrap(userID: string): Promise<BootstrapResponse> {
    const user = await this.loadUser(userID);
    const counts = await this.database.one<{
      unread_count: string;
      update_available_count: string;
    }>(
      `
      SELECT
        (SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS unread_count,
        (SELECT count(*) FROM skills WHERE status = 'published' AND visibility_level = 'public_installable') AS update_available_count
      `,
      [userID],
    );

    return {
      user,
      connection: {
        status: 'connected',
        serverTime: new Date().toISOString(),
        apiVersion: 'p1.0',
      },
      features: {
        p1Desktop: true,
        publishSkill: false,
        reviewWorkbench: false,
        adminManage: false,
        mcpManage: false,
        pluginManage: false,
      },
      counts: {
        installedCount: 0,
        updateAvailableCount: Number(counts?.update_available_count ?? 0),
        unreadNotificationCount: Number(counts?.unread_count ?? 0),
      },
      navigation: ['home', 'market', 'my_installed', 'tools', 'projects', 'notifications', 'settings'],
    };
  }

  async acceptLocalEvents(userID: string, request: LocalEventsRequest): Promise<LocalEventsResponse> {
    const rejectedEvents: LocalEventsResponse['rejectedEvents'] = [];
    const acceptedEventIDs: string[] = [];

    if (!request.deviceID) {
      rejectedEvents.push({ code: 'device_required', message: 'deviceID is required' });
      return { acceptedEventIDs, rejectedEvents, serverStateChanged: false, remoteNotices: [] };
    }

    for (const event of request.events ?? []) {
      if (!event.eventID || !event.occurredAt || !event.result) {
        rejectedEvents.push({ eventID: event.eventID, code: 'invalid_event', message: 'eventID, occurredAt and result are required' });
        continue;
      }

      await this.database.query(
        `
        INSERT INTO desktop_devices (id, user_id, last_seen_at)
        VALUES ($1, $2, now())
        ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
        `,
        [request.deviceID, userID],
      );

      await this.database.query(
        `
        INSERT INTO desktop_local_events (
          device_id, event_id, event_type, skill_id, version, target_type, target_id,
          target_path, requested_mode, resolved_mode, fallback_reason, result, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (device_id, event_id) DO NOTHING
        `,
        [
          request.deviceID,
          event.eventID,
          event.eventType,
          event.skillID ?? null,
          event.version ?? null,
          event.targetType ?? null,
          event.targetID ?? null,
          event.targetPath ?? null,
          event.requestedMode ?? null,
          event.resolvedMode ?? null,
          event.fallbackReason ?? null,
          event.result,
          event.occurredAt,
        ],
      );
      acceptedEventIDs.push(event.eventID);
    }

    return {
      acceptedEventIDs,
      rejectedEvents,
      serverStateChanged: acceptedEventIDs.length > 0,
      remoteNotices: acceptedEventIDs.length
        ? [
            {
              skillID: 'codex-review-helper',
              noticeType: 'skill_update_available',
              message: '该 Skill 有新版本可更新',
            },
          ]
        : [],
    };
  }

  private async loadUser(userID: string): Promise<UserSummary> {
    const user = await this.database.one<{
      id: string;
      display_name: string;
      role: 'normal_user' | 'admin';
      department_id: string;
      department_name: string;
    }>(
      `
      SELECT u.id, u.display_name, u.role, u.department_id, d.name AS department_name
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1 AND u.status = 'active'
      `,
      [userID],
    );
    if (!user) {
      throw new NotFoundException('用户不存在或不可用');
    }
    return {
      userID: user.id,
      displayName: user.display_name,
      role: user.role,
      departmentID: user.department_id,
      departmentName: user.department_name,
      locale: 'zh-CN',
    };
  }
}
