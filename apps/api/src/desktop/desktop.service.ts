import { Injectable } from '@nestjs/common';
import { BootstrapContextDto, LocalEventDto, NotificationType, UserSummary } from '../common/p1-contracts';
import { logInfo, logWarn } from '../common/structured-log';
import { DatabaseService } from '../database/database.service';
import { PermissionResolverService } from '../auth/permission-resolver.service';

export type BootstrapResponse = BootstrapContextDto;

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
  constructor(
    private readonly database: DatabaseService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async bootstrap(user: UserSummary): Promise<BootstrapResponse> {
    const counts = await this.database.one<{
      unread_count: string;
      update_available_count: string;
    }>(
      `
      SELECT
        (SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL) AS unread_count,
        (SELECT count(*) FROM skills WHERE status = 'published' AND visibility_level = 'public_installable') AS update_available_count
      `,
      [user.userID],
    );

    return {
      user,
      connection: {
        status: 'connected',
        serverTime: new Date().toISOString(),
        apiVersion: 'p1.0',
      },
      features: this.permissionResolver.featureFlagsFor(user),
      counts: {
        installedCount: 0,
        enabledCount: 0,
        updateAvailableCount: Number(counts?.update_available_count ?? 0),
        unreadNotificationCount: Number(counts?.unread_count ?? 0),
      },
      navigation: this.permissionResolver.navigationFor(user),
      menuPermissions: this.permissionResolver.menuPermissionsFor(user),
    };
  }

  async acceptLocalEvents(userID: string, request: LocalEventsRequest): Promise<LocalEventsResponse> {
    const rejectedEvents: LocalEventsResponse['rejectedEvents'] = [];
    const acceptedEventIDs: string[] = [];

    if (!request.deviceID) {
      logWarn({
        event: 'desktop.local_events.rejected',
        domain: 'desktop-local-runtime',
        action: 'accept_local_events',
        actorID: userID,
        result: 'failed',
        reason: 'missing_device_id'
      });
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

    logInfo({
      event: 'desktop.local_events.accepted',
      domain: 'desktop-local-runtime',
      action: 'accept_local_events',
      actorID: userID,
      entityID: request.deviceID,
      result: 'ok',
      detail: {
        acceptedEventCount: acceptedEventIDs.length,
        rejectedEventCount: rejectedEvents.length
      }
    });

    return {
      acceptedEventIDs,
      rejectedEvents,
      serverStateChanged: acceptedEventIDs.length > 0,
      remoteNotices: [],
    };
  }
}
