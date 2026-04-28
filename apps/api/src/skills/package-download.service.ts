import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import type { DownloadTicketResponse } from '../common/p1-contracts';
import { logInfo, logWarn } from '../common/structured-log';
import { SkillAuthorizationService } from './skill-authorization.service';
import { SkillsRepository } from './skills.repository';
import type { DownloadablePackage, DownloadTicketRequest, PackageDownloadTicketRow, PackageRow } from './skills.types';

@Injectable()
export class PackageDownloadService {
  constructor(
    private readonly repository: SkillsRepository,
    private readonly authorization: SkillAuthorizationService,
  ) {}

  async downloadTicket(skillID: string, request: DownloadTicketRequest, userID?: string): Promise<DownloadTicketResponse> {
    const row = await this.repository.findSkill(skillID);
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const authorization = this.authorization.authorizationFor(row, requester);
    const installable = row.status === 'published' && authorization.isAuthorized;
    const cannotInstallReason = installable ? undefined : row.status === 'delisted' ? 'skill_delisted' : 'permission_denied';
    if (!installable && !this.authorization.canUpdate(row, requester)) {
      logWarn({
        event: 'skills.download_ticket.denied',
        domain: 'skills-market',
        action: 'issue_download_ticket',
        actorID: userID ?? null,
        entityID: skillID,
        result: 'failed',
        reason: cannotInstallReason ?? 'permission_denied',
      });
      throw new ForbiddenException(cannotInstallReason ?? '当前用户无权安装该 Skill');
    }
    if (row.status === 'delisted' || row.status === 'archived') {
      throw new ForbiddenException(row.status === 'delisted' ? 'skill_delisted' : 'scope_restricted');
    }

    const version = request.targetVersion ?? row.version;
    const packageRow = await this.repository.loadPublishedPackageForVersion(skillID, version);
    if (!packageRow) {
      throw new ForbiddenException('package_unavailable');
    }

    const ticket = await this.issuePackageDownloadTicket({
      packageRef: packageRow.id,
      userID: userID ?? null,
      purpose: 'published',
      requiresAuth: false,
    });
    if (userID && (request.purpose ?? 'install') === 'install') {
      await this.repository.recordDownloadEvent({
        userID,
        skillRowID: row.id,
        version: packageRow.version,
        purpose: 'install',
      });
    }
    logInfo({
      event: 'skills.download_ticket.issued',
      domain: 'skills-market',
      action: 'issue_download_ticket',
      actorID: userID ?? null,
      entityID: skillID,
      result: 'ok',
      detail: { version, packageRef: packageRow.id },
    });
    return {
      skillID: packageRow.skill_id,
      version: packageRow.version,
      packageRef: packageRow.id,
      packageURL: `/skill-packages/${encodeURIComponent(packageRow.id)}/download?ticket=${encodeURIComponent(ticket)}`,
      packageHash: packageRow.sha256 as DownloadTicketResponse['packageHash'],
      packageSize: Number(packageRow.size_bytes),
      packageFileCount: Number(packageRow.file_count),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async downloadPackage(packageRef: string, ticket?: string, requesterUserID?: string | null): Promise<DownloadablePackage> {
    const ticketRow = await this.validatePackageDownloadTicket(packageRef, ticket, requesterUserID ?? null);
    if (!ticketRow) {
      logWarn({
        event: 'skills.package_download.denied',
        domain: 'skills-market',
        action: 'download_package',
        actorID: requesterUserID ?? null,
        entityID: packageRef,
        result: 'failed',
        reason: 'invalid_or_expired_ticket',
      });
      throw new ForbiddenException('permission_denied');
    }

    const packageRow = await this.repository.loadPackageRow(packageRef);
    if (!packageRow) {
      throw new NotFoundException('package_unavailable');
    }

    const minioStream = await this.tryReadMinioObject(packageRow);
    if (minioStream) {
      logInfo({
        event: 'skills.package_download.served',
        domain: 'skills-market',
        action: 'download_package',
        actorID: requesterUserID ?? null,
        entityID: packageRef,
        result: 'ok',
        detail: { source: 'minio' },
      });
      return this.packageDownload(packageRow, minioStream);
    }

    const fallbackPath = this.seedPackagePath(packageRow.object_key);
    if (fallbackPath && existsSync(fallbackPath)) {
      logInfo({
        event: 'skills.package_download.served',
        domain: 'skills-market',
        action: 'download_package',
        actorID: requesterUserID ?? null,
        entityID: packageRef,
        result: 'ok',
        detail: { source: 'local_fallback' },
      });
      return this.packageDownload(packageRow, createReadStream(fallbackPath));
    }

    throw new NotFoundException('package_unavailable');
  }

  async issuePackageDownloadUrl(packageRef: string, userID: string, requiresAuth: boolean): Promise<string> {
    const ticket = await this.issuePackageDownloadTicket({
      packageRef,
      userID,
      purpose: requiresAuth ? 'staged' : 'published',
      requiresAuth,
    });
    return `/skill-packages/${encodeURIComponent(packageRef)}/download?ticket=${encodeURIComponent(ticket)}`;
  }

  async issuePackageDownloadTicket(input: {
    packageRef: string;
    userID: string | null;
    purpose: 'published' | 'staged';
    requiresAuth: boolean;
  }): Promise<string> {
    const ticket = randomBytes(24).toString('hex');
    await this.repository.insertPackageDownloadTicket({
      ticket,
      packageRef: input.packageRef,
      userID: input.userID,
      purpose: input.purpose,
      requiresAuth: input.requiresAuth,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return ticket;
  }

  async validatePackageDownloadTicket(
    packageRef: string,
    ticket: string | undefined,
    requesterUserID: string | null,
  ): Promise<PackageDownloadTicketRow | null> {
    if (!ticket) {
      return null;
    }
    const row = await this.repository.findPackageDownloadTicket(packageRef, ticket);
    if (!row) {
      return null;
    }
    if (row.requires_auth && (!requesterUserID || requesterUserID !== row.user_id)) {
      return null;
    }
    return row;
  }

  private async tryReadMinioObject(packageRow: PackageRow): Promise<Readable | null> {
    if (!process.env.MINIO_ENDPOINT) {
      return null;
    }

    const client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT,
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'change-me-minio-secret',
    });

    try {
      return await client.getObject(packageRow.bucket, packageRow.object_key);
    } catch {
      return null;
    }
  }

  private seedPackagePath(objectKey: string): string | null {
    const relativeObjectPath = objectKey.replace(/^skills\//, '');
    const candidates = [
      join(__dirname, '..', 'database', 'seeds', 'packages', relativeObjectPath),
      join(__dirname, '..', '..', 'src', 'database', 'seeds', 'packages', relativeObjectPath),
      join(process.env.LOCAL_PACKAGE_STORAGE_DIR ?? join(process.cwd(), '.runtime-package-storage'), objectKey),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  private packageDownload(packageRow: PackageRow, stream: Readable): DownloadablePackage {
    return {
      stream,
      contentType: packageRow.content_type,
      contentLength: Number(packageRow.size_bytes),
      fileName: `${packageRow.skill_id}-${packageRow.version}.zip`,
    };
  }
}
