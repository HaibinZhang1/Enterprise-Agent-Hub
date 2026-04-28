import { Injectable } from '@nestjs/common';
import type { DownloadTicketResponse, PageResponse, SkillDetail, SkillLeaderboardsResponse, SkillSummary } from '../common/p1-contracts';
import { PackageDownloadService } from './package-download.service';
import { SkillQueryService } from './skill-query.service';
import { SkillsRepository } from './skills.repository';
import type { DownloadablePackage, DownloadTicketRequest, SkillListQuery } from './skills.types';

export { buildSkillLeaderboardQueryPlan, buildSkillListQueryPlan } from './skills.query';
export type { DownloadablePackage, DownloadTicketRequest, SkillListQuery, SkillListQueryPlan } from './skills.types';

@Injectable()
export class SkillsService {
  constructor(
    private readonly queryService: SkillQueryService,
    private readonly packageDownloads: PackageDownloadService,
    private readonly repository: SkillsRepository,
  ) {}

  async list(query: SkillListQuery, userID?: string): Promise<PageResponse<SkillSummary>> {
    return this.queryService.list(query, userID);
  }

  async leaderboards(userID?: string): Promise<SkillLeaderboardsResponse> {
    return this.queryService.leaderboards(userID);
  }

  async detail(skillID: string, userID?: string): Promise<SkillDetail | SkillSummary> {
    return this.queryService.detail(skillID, userID);
  }

  async downloadTicket(skillID: string, request: DownloadTicketRequest, userID?: string): Promise<DownloadTicketResponse> {
    return this.packageDownloads.downloadTicket(skillID, request, userID);
  }

  async downloadPackage(packageRef: string, ticket?: string, requesterUserID?: string | null): Promise<DownloadablePackage> {
    return this.packageDownloads.downloadPackage(packageRef, ticket, requesterUserID);
  }

  async star(userID: string, skillID: string, starred: boolean): Promise<{ skillID: string; starred: boolean; starCount: number }> {
    const row = await this.repository.findSkill(skillID);
    await this.repository.setStar(userID, row.id, starred);
    const starCount = await this.repository.countStars(row.id);
    return { skillID: row.skill_id, starred, starCount };
  }

  async issuePackageDownloadUrl(packageRef: string, userID: string, requiresAuth: boolean): Promise<string> {
    return this.packageDownloads.issuePackageDownloadUrl(packageRef, userID, requiresAuth);
  }
}
