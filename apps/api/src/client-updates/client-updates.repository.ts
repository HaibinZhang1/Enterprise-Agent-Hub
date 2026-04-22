import { randomBytes, randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClientReleaseStatus,
  ClientUpdateReleaseSummaryDto,
} from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import type {
  ClientUpdateAdminActorRow,
  ClientUpdateDownloadTicketRow,
  ClientUpdateEventInput,
  ClientUpdateReleaseRow,
  CreateClientUpdateReleaseInput,
  RegisterClientUpdateArtifactInput,
} from './client-updates.types';

@Injectable()
export class ClientUpdatesRepository {
  constructor(private readonly database: DatabaseService) {}

  async assertAdminActor(userID: string): Promise<ClientUpdateAdminActorRow> {
    const actor = await this.database.one<ClientUpdateAdminActorRow>(
      `
      SELECT id AS user_id, role, admin_level
      FROM users
      WHERE id = $1
        AND status = 'active'
      `,
      [userID],
    );
    if (!actor || actor.role !== 'admin' || actor.admin_level === null) {
      throw new ForbiddenException('permission_denied');
    }
    return actor;
  }

  async createRelease(input: CreateClientUpdateReleaseInput): Promise<string> {
    const releaseID = randomUUID();
    await this.database.query(
      `
      INSERT INTO client_releases (
        id,
        version,
        build_number,
        platform,
        arch,
        channel,
        status,
        mandatory,
        min_supported_version,
        rollout_percent,
        release_notes,
        created_by,
        published_by,
        published_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, $11, NULL, NULL, now(), now())
      `,
      [
        releaseID,
        input.version,
        input.buildNumber,
        input.platform,
        input.arch,
        input.channel,
        input.mandatory,
        input.minSupportedVersion,
        input.rolloutPercent,
        input.releaseNotes,
        input.createdBy,
      ],
    );
    return releaseID;
  }

  async loadReleaseOrThrow(releaseID: string): Promise<ClientUpdateReleaseRow> {
    const row = await this.database.one<ClientUpdateReleaseRow>(
      releaseSummarySQL(`WHERE r.id = $1`),
      [releaseID],
    );
    if (!row) {
      throw new NotFoundException('resource_not_found');
    }
    return row;
  }

  async listReleases(): Promise<ClientUpdateReleaseRow[]> {
    const result = await this.database.query<ClientUpdateReleaseRow>(
      `${releaseSummarySQL('')}
       ORDER BY r.created_at DESC, r.version DESC`,
    );
    return result.rows;
  }

  async upsertArtifact(input: RegisterClientUpdateArtifactInput): Promise<void> {
    await this.database.query(
      `
      INSERT INTO client_release_artifacts (
        id,
        release_id,
        bucket,
        object_key,
        package_name,
        size_bytes,
        sha256,
        signature_status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      ON CONFLICT (release_id)
      DO UPDATE SET
        bucket = EXCLUDED.bucket,
        object_key = EXCLUDED.object_key,
        package_name = EXCLUDED.package_name,
        size_bytes = EXCLUDED.size_bytes,
        sha256 = EXCLUDED.sha256,
        signature_status = EXCLUDED.signature_status
      `,
      [
        randomUUID(),
        input.releaseID,
        input.bucket,
        input.objectKey,
        input.packageName,
        input.sizeBytes,
        input.sha256,
        input.signatureStatus,
      ],
    );
  }

  async setReleasePublished(
    releaseID: string,
    adminUserID: string,
    overrides: {
      mandatory?: boolean;
      minSupportedVersion?: string | null;
      rolloutPercent?: number;
    },
  ): Promise<void> {
    await this.database.query(
      `
      UPDATE client_releases
      SET
        status = 'published',
        mandatory = COALESCE($3, mandatory),
        min_supported_version = COALESCE($4, min_supported_version),
        rollout_percent = COALESCE($5, rollout_percent),
        published_by = $2,
        published_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [releaseID, adminUserID, overrides.mandatory, overrides.minSupportedVersion, overrides.rolloutPercent],
    );
  }

  async updateRolloutPercent(releaseID: string, rolloutPercent: number): Promise<void> {
    await this.database.query(
      `
      UPDATE client_releases
      SET rollout_percent = $2, updated_at = now()
      WHERE id = $1
      `,
      [releaseID, rolloutPercent],
    );
  }

  async setReleaseStatus(releaseID: string, status: Extract<ClientReleaseStatus, 'paused' | 'yanked'>): Promise<void> {
    await this.database.query(
      `
      UPDATE client_releases
      SET status = $2, updated_at = now()
      WHERE id = $1
      `,
      [releaseID, status],
    );
  }

  async listPublishedReleases(input: {
    platform: string;
    arch: string;
    channel: string;
  }): Promise<ClientUpdateReleaseRow[]> {
    const result = await this.database.query<ClientUpdateReleaseRow>(
      `${releaseSummarySQL(`
        WHERE r.platform = $1
          AND r.arch = $2
          AND r.channel = $3
          AND r.status = 'published'
          AND a.release_id IS NOT NULL
      `)}
      ORDER BY r.published_at DESC NULLS LAST, r.created_at DESC`,
      [input.platform, input.arch, input.channel],
    );
    return result.rows;
  }

  async insertDownloadTicket(releaseID: string, userID: string): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.database.query(
      `
      INSERT INTO client_update_download_tickets (ticket, release_id, user_id, expires_at)
      VALUES ($1, $2, $3, $4)
      `,
      [ticket, releaseID, userID, new Date(Date.now() + 10 * 60 * 1000).toISOString()],
    );
    return ticket;
  }

  async findDownloadTicket(releaseID: string, ticket: string): Promise<ClientUpdateDownloadTicketRow | null> {
    return this.database.one<ClientUpdateDownloadTicketRow>(
      `
      SELECT ticket, release_id, user_id, expires_at
      FROM client_update_download_tickets
      WHERE release_id = $1
        AND ticket = $2
        AND expires_at > now()
      `,
      [releaseID, ticket],
    );
  }

  async insertEvent(input: ClientUpdateEventInput): Promise<void> {
    await this.database.query(
      `
      INSERT INTO client_update_events (
        id,
        release_id,
        user_id,
        device_id,
        from_version,
        to_version,
        event_type,
        error_code,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
      `,
      [
        randomUUID(),
        input.releaseID,
        input.userID,
        input.deviceID,
        input.fromVersion,
        input.toVersion,
        input.eventType,
        input.errorCode,
      ],
    );
  }

  async upsertReleaseNotifications(summary: ClientUpdateReleaseSummaryDto): Promise<void> {
    await this.database.query(
      `
      INSERT INTO notifications (id, user_id, type, title, summary, object_type, object_id, created_at)
      SELECT
        'client_update_' || $1 || '_' || u.id,
        u.id,
        'client_update',
        $2,
        $3,
        'client_update',
        $1,
        now()
      FROM users u
      WHERE u.status = 'active'
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        object_type = EXCLUDED.object_type,
        object_id = EXCLUDED.object_id,
        read_at = NULL,
        created_at = now()
      `,
      [summary.releaseID, `客户端更新 ${summary.version}`, summary.releaseNotes],
    );
  }

  async clearReleaseNotifications(releaseID: string): Promise<void> {
    await this.database.query(
      `
      DELETE FROM notifications
      WHERE type = 'client_update'
        AND object_type = 'client_update'
        AND object_id = $1
      `,
      [releaseID],
    );
  }

  async clearUserReleaseNotification(releaseID: string, userID: string): Promise<void> {
    await this.database.query(
      `
      DELETE FROM notifications
      WHERE type = 'client_update'
        AND object_type = 'client_update'
        AND object_id = $1
        AND user_id = $2
      `,
      [releaseID, userID],
    );
  }
}

function releaseSummarySQL(whereClause: string): string {
  return `
    SELECT
      r.id AS release_id,
      r.version,
      r.build_number,
      r.platform,
      r.arch,
      r.channel,
      r.status,
      r.mandatory,
      r.min_supported_version,
      r.rollout_percent,
      r.release_notes,
      r.created_by,
      r.published_by,
      r.published_at,
      r.created_at,
      r.updated_at,
      a.id AS artifact_id,
      a.bucket AS artifact_bucket,
      a.object_key AS artifact_object_key,
      a.package_name AS artifact_package_name,
      a.size_bytes AS artifact_size_bytes,
      a.sha256 AS artifact_sha256,
      a.signature_status AS artifact_signature_status,
      a.created_at AS artifact_created_at,
      MAX(e.created_at) AS latest_event_at,
      COUNT(e.id) AS event_count
    FROM client_releases r
    LEFT JOIN client_release_artifacts a ON a.release_id = r.id
    LEFT JOIN client_update_events e ON e.release_id = r.id
    ${whereClause}
    GROUP BY r.id, a.id
  `;
}
