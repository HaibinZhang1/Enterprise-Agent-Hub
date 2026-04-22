import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ClientArtifactSignatureStatus,
  ClientUpdateCheckRequestDto,
  ClientUpdateCheckResponseDto,
  ClientUpdateDownloadTicketResponseDto,
  ClientUpdateReleaseSummaryDto,
  CreateClientUpdateReleaseRequestDto,
  PublishClientUpdateReleaseRequestDto,
  RegisterClientUpdateArtifactRequestDto,
  ReportClientUpdateEventRequestDto,
  ReportClientUpdateEventResponseDto,
  UpdateClientUpdateRolloutRequestDto,
} from '../common/p1-contracts';
import { compareSemver } from '../publishing/publishing.utils';
import { ClientUpdateStorageService } from './client-update-storage.service';
import { ClientUpdatesRepository } from './client-updates.repository';
import type { ClientUpdateReleaseRow } from './client-updates.types';

@Injectable()
export class ClientUpdatesService {
  constructor(
    private readonly repository: ClientUpdatesRepository,
    private readonly storage: ClientUpdateStorageService,
  ) {}

  async listAdminReleases(userID: string): Promise<ClientUpdateReleaseSummaryDto[]> {
    await this.repository.assertAdminActor(userID);
    const releases = await this.repository.listReleases();
    return releases.map((release) => this.toSummary(release));
  }

  async getAdminRelease(userID: string, releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async createAdminRelease(
    userID: string,
    request: CreateClientUpdateReleaseRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    this.assertWindowsX64(request.platform, request.arch);
    const releaseID = await this.repository.createRelease({
      version: this.requireSemver(request.version, 'version'),
      buildNumber: normalizeText(request.buildNumber),
      platform: request.platform,
      arch: request.arch,
      channel: request.channel,
      mandatory: request.mandatory ?? false,
      minSupportedVersion: request.minSupportedVersion ? this.requireSemver(request.minSupportedVersion, 'minSupportedVersion') : null,
      rolloutPercent: this.normalizeRolloutPercent(request.rolloutPercent),
      releaseNotes: requireNonEmptyText(request.releaseNotes, 'releaseNotes'),
      createdBy: userID,
    });
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async registerAdminArtifact(
    userID: string,
    releaseID: string,
    request: RegisterClientUpdateArtifactRequestDto,
    file?: { originalname: string; buffer: Buffer; size: number },
  ): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    const release = await this.repository.loadReleaseOrThrow(releaseID);
    let bucket = this.storage.bucket();
    let objectKey = normalizeText(request.objectKey) ?? undefined;
    let packageName = requireNonEmptyText(request.packageName || file?.originalname, 'packageName');
    let sizeBytes = normalizeNumber(request.sizeBytes ?? file?.size, 'sizeBytes');
    let sha256 = this.normalizeSha256(request.sha256);
    const signatureStatus = this.normalizeSignatureStatus(request.signatureStatus);

    if (file) {
      const computedHash = sha256Buffer(file.buffer);
      if (sha256 && sha256 !== computedHash) {
        throw new BadRequestException('hash_mismatch');
      }
      sha256 = computedHash;
      sizeBytes = file.size;
      const stored = await this.storage.uploadArtifact({
        releaseID,
        version: release.version,
        platform: release.platform,
        arch: release.arch,
        channel: release.channel,
        packageName,
        buffer: file.buffer,
      });
      bucket = stored.bucket;
      objectKey = stored.objectKey;
      sizeBytes = stored.sizeBytes;
    } else {
      if (!objectKey) {
        throw new BadRequestException('validation_failed');
      }
      await this.storage.assertObjectExists(bucket, objectKey);
    }

    await this.repository.upsertArtifact({
      releaseID,
      bucket,
      objectKey: objectKey ?? '',
      packageName,
      sizeBytes,
      sha256: sha256 ?? (() => { throw new BadRequestException('validation_failed'); })(),
      signatureStatus,
    });
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async publishAdminRelease(
    userID: string,
    releaseID: string,
    request: PublishClientUpdateReleaseRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    const release = await this.repository.loadReleaseOrThrow(releaseID);
    if (!release.artifact_id) {
      throw new BadRequestException('package_unavailable');
    }
    await this.repository.setReleasePublished(releaseID, userID, {
      mandatory: request.mandatory,
      minSupportedVersion: request.minSupportedVersion ? this.requireSemver(request.minSupportedVersion, 'minSupportedVersion') : undefined,
      rolloutPercent: request.rolloutPercent === undefined ? undefined : this.normalizeRolloutPercent(request.rolloutPercent),
    });
    const published = this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
    await this.repository.upsertReleaseNotifications(published);
    return published;
  }

  async updateAdminRollout(
    userID: string,
    releaseID: string,
    request: UpdateClientUpdateRolloutRequestDto,
  ): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    await this.repository.loadReleaseOrThrow(releaseID);
    await this.repository.updateRolloutPercent(releaseID, this.normalizeRolloutPercent(request.rolloutPercent));
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async pauseAdminRelease(userID: string, releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    await this.repository.loadReleaseOrThrow(releaseID);
    await this.repository.setReleaseStatus(releaseID, 'paused');
    await this.repository.clearReleaseNotifications(releaseID);
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async yankAdminRelease(userID: string, releaseID: string): Promise<ClientUpdateReleaseSummaryDto> {
    await this.repository.assertAdminActor(userID);
    await this.repository.loadReleaseOrThrow(releaseID);
    await this.repository.setReleaseStatus(releaseID, 'yanked');
    await this.repository.clearReleaseNotifications(releaseID);
    return this.toSummary(await this.repository.loadReleaseOrThrow(releaseID));
  }

  async check(userID: string, request: ClientUpdateCheckRequestDto): Promise<ClientUpdateCheckResponseDto> {
    this.assertWindowsX64(request.platform, request.arch);
    const currentVersion = this.requireSemver(request.currentVersion, 'currentVersion');
    const releases = (await this.repository.listPublishedReleases({
      platform: request.platform,
      arch: request.arch,
      channel: request.channel,
    })).sort((left, right) => compareSemver(right.version, left.version));

    const unsupported = releases.find(
      (release) =>
        release.min_supported_version !== null &&
        compareSemver(currentVersion, release.min_supported_version) < 0,
    );
    if (unsupported) {
      return this.toCheckResponse(unsupported, 'unsupported_version', currentVersion);
    }

    const eligible = releases.find((release) => this.matchesRollout(release, userID, request.deviceID));
    if (!eligible || compareSemver(eligible.version, currentVersion) <= 0) {
      return {
        status: 'up_to_date',
        updateType: 'none',
        currentVersion,
        latestVersion: eligible?.version ?? currentVersion,
        channel: request.channel,
        mandatory: false,
        downloadTicketRequired: false,
      };
    }
    return this.toCheckResponse(eligible, eligible.mandatory ? 'mandatory_update' : 'update_available', currentVersion);
  }

  async issueDownloadTicket(userID: string, releaseID: string): Promise<ClientUpdateDownloadTicketResponseDto> {
    const release = await this.repository.loadReleaseOrThrow(releaseID);
    if (release.status !== 'published' || !release.artifact_id || !release.artifact_package_name || !release.artifact_sha256) {
      throw new NotFoundException('package_unavailable');
    }
    const ticket = await this.repository.insertDownloadTicket(releaseID, userID);
    return {
      releaseID,
      version: release.version,
      downloadURL: `/client-updates/releases/${encodeURIComponent(releaseID)}/download?ticket=${encodeURIComponent(ticket)}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      packageName: release.artifact_package_name,
      sizeBytes: Number(release.artifact_size_bytes ?? 0),
      sha256: release.artifact_sha256 as `sha256:${string}`,
      signatureStatus: (release.artifact_signature_status ?? 'unknown') as ClientArtifactSignatureStatus,
    };
  }

  async reportEvent(userID: string, request: ReportClientUpdateEventRequestDto): Promise<ReportClientUpdateEventResponseDto> {
    if (request.releaseID) {
      await this.repository.loadReleaseOrThrow(request.releaseID);
    }
    await this.repository.insertEvent({
      releaseID: request.releaseID ?? null,
      userID,
      deviceID: requireNonEmptyText(request.deviceID, 'deviceID'),
      fromVersion: this.requireSemver(request.fromVersion, 'fromVersion'),
      toVersion: request.toVersion ? this.requireSemver(request.toVersion, 'toVersion') : null,
      eventType: request.eventType,
      errorCode: normalizeText(request.errorCode) ?? null,
    });
    if (request.eventType === 'installed' && request.releaseID) {
      await this.repository.clearUserReleaseNotification(request.releaseID, userID);
    }
    return { accepted: true };
  }

  async downloadRelease(
    releaseID: string,
    ticket: string | undefined,
    requesterUserID: string | null,
  ): Promise<{ stream: NodeJS.ReadableStream; fileName: string; contentLength: number }> {
    if (!ticket || !requesterUserID) {
      throw new ForbiddenException('permission_denied');
    }
    const ticketRow = await this.repository.findDownloadTicket(releaseID, ticket);
    if (!ticketRow || ticketRow.user_id !== requesterUserID) {
      throw new ForbiddenException('permission_denied');
    }
    const release = await this.repository.loadReleaseOrThrow(releaseID);
    if (!release.artifact_bucket || !release.artifact_object_key || !release.artifact_package_name) {
      throw new NotFoundException('package_unavailable');
    }
    const file = await this.storage.openArtifactStream(release.artifact_bucket, release.artifact_object_key);
    return {
      stream: file.stream,
      fileName: release.artifact_package_name,
      contentLength: file.contentLength,
    };
  }

  private toCheckResponse(
    release: ClientUpdateReleaseRow,
    status: 'update_available' | 'mandatory_update' | 'unsupported_version',
    currentVersion: string,
  ): ClientUpdateCheckResponseDto {
    return {
      status,
      updateType: status === 'update_available' ? 'optional' : status === 'mandatory_update' ? 'mandatory' : 'unsupported',
      currentVersion,
      latestVersion: release.version,
      releaseID: release.release_id,
      channel: release.channel,
      packageName: release.artifact_package_name ?? undefined,
      sizeBytes: release.artifact_size_bytes === null ? undefined : Number(release.artifact_size_bytes),
      sha256: (release.artifact_sha256 ?? undefined) as `sha256:${string}` | undefined,
      publishedAt: release.published_at?.toISOString(),
      releaseNotes: release.release_notes,
      mandatory: status !== 'update_available' || release.mandatory,
      minSupportedVersion: release.min_supported_version,
      downloadTicketRequired: true,
    };
  }

  private toSummary(release: ClientUpdateReleaseRow): ClientUpdateReleaseSummaryDto {
    return {
      releaseID: release.release_id,
      version: release.version,
      buildNumber: release.build_number,
      platform: release.platform,
      arch: release.arch,
      channel: release.channel,
      status: release.status,
      mandatory: release.mandatory,
      minSupportedVersion: release.min_supported_version,
      rolloutPercent: Number(release.rollout_percent),
      releaseNotes: release.release_notes,
      publishedAt: release.published_at?.toISOString() ?? null,
      createdAt: release.created_at.toISOString(),
      updatedAt: release.updated_at.toISOString(),
      publishedBy: release.published_by,
      createdBy: release.created_by,
      latestEventAt: release.latest_event_at?.toISOString() ?? null,
      eventCount: Number(release.event_count ?? 0),
      artifact: release.artifact_id
        ? {
            artifactID: release.artifact_id,
            bucket: release.artifact_bucket ?? this.storage.bucket(),
            objectKey: release.artifact_object_key ?? '',
            packageName: release.artifact_package_name ?? '',
            sizeBytes: Number(release.artifact_size_bytes ?? 0),
            sha256: (release.artifact_sha256 ?? sha256Buffer(Buffer.from(release.artifact_object_key ?? release.release_id))) as `sha256:${string}`,
            signatureStatus: (release.artifact_signature_status ?? 'unknown') as ClientArtifactSignatureStatus,
            createdAt: release.artifact_created_at?.toISOString() ?? release.created_at.toISOString(),
          }
        : undefined,
    };
  }

  private assertWindowsX64(platform: string, arch: string): void {
    if (platform !== 'windows' || arch !== 'x64') {
      throw new BadRequestException('validation_failed');
    }
  }

  private normalizeRolloutPercent(value: number | undefined): number {
    const rolloutPercent = value ?? 100;
    if (!Number.isInteger(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100) {
      throw new BadRequestException('validation_failed');
    }
    return rolloutPercent;
  }

  private normalizeSha256(value: string | undefined): `sha256:${string}` | undefined {
    if (!value) {
      return undefined;
    }
    if (!/^sha256:[a-f0-9]{64}$/i.test(value)) {
      throw new BadRequestException('validation_failed');
    }
    return value.toLowerCase() as `sha256:${string}`;
  }

  private normalizeSignatureStatus(value: string | undefined): ClientArtifactSignatureStatus {
    if (!value) {
      return 'unknown';
    }
    if (value !== 'signed' && value !== 'unsigned' && value !== 'unknown') {
      throw new BadRequestException('validation_failed');
    }
    return value;
  }

  private matchesRollout(release: ClientUpdateReleaseRow, userID: string, deviceID: string): boolean {
    const rolloutPercent = Number(release.rollout_percent);
    if (rolloutPercent >= 100) {
      return true;
    }
    if (rolloutPercent <= 0) {
      return false;
    }
    const hash = createHash('sha256')
      .update(`${release.release_id}:${userID}:${deviceID}`)
      .digest();
    const bucket = hash.readUInt16BE(0) % 100;
    return bucket < rolloutPercent;
  }

  private requireSemver(value: string, field: string): string {
    if (!/^\d+\.\d+\.\d+$/.test(value)) {
      throw new BadRequestException(`${field} must be a semver string`);
    }
    return value;
  }
}

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNumber(value: number | string | undefined, field: string): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return parsed;
}

function requireNonEmptyText(value: string | null | undefined, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required`);
  }
  return trimmed;
}

function sha256Buffer(buffer: Buffer): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
}
