import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import type { PageResponse, SkillDetail, SkillLeaderboardItem, SkillLeaderboardsResponse, SkillSummary } from '../common/p1-contracts';
import { pageOf } from '../common/p1-contracts';
import { PackageStorageService } from '../publishing/package-storage.service';
import { SkillAuthorizationService } from './skill-authorization.service';
import { SkillsRepository } from './skills.repository';
import { buildSkillLeaderboardQueryPlan, buildSkillListQueryPlan, toIsoString } from './skills.query';
import type { RequesterScope, SkillLeaderboardRow, SkillListQuery, SkillRow } from './skills.types';

const LEADERBOARD_LIMIT = 10;
const LEADERBOARD_WINDOW_DAYS = 7;

@Injectable()
export class SkillQueryService {
  constructor(
    private readonly repository: SkillsRepository,
    private readonly authorization: SkillAuthorizationService,
    @Optional() private readonly packageStorage?: PackageStorageService,
  ) {}

  async list(query: SkillListQuery, userID?: string): Promise<PageResponse<SkillSummary>> {
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const plan = buildSkillListQueryPlan(query, { requester, requirePublished: true });
    const rows = await this.repository.listSkills(plan);
    const total = Number(rows[0]?.total_count ?? 0);
    const items = rows.map((row) => this.toSummary(row, requester));
    return pageOf(items, plan.page, plan.pageSize, total);
  }

  async leaderboards(userID?: string): Promise<SkillLeaderboardsResponse> {
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const rows = await this.repository.listSkillLeaderboards(buildSkillLeaderboardQueryPlan(LEADERBOARD_WINDOW_DAYS, { requester }));
    const items = rows.map((row) => this.toLeaderboardItem(row, requester));

    return {
      generatedAt: new Date().toISOString(),
      windowDays: LEADERBOARD_WINDOW_DAYS,
      hot: items.filter((item) => item.hotScore > 0).sort(compareHotLeaderboard).slice(0, LEADERBOARD_LIMIT),
      stars: [...items].sort(compareStarLeaderboard).slice(0, LEADERBOARD_LIMIT),
      downloads: [...items].sort(compareDownloadLeaderboard).slice(0, LEADERBOARD_LIMIT),
    };
  }

  async detail(skillID: string, userID?: string): Promise<SkillDetail | SkillSummary> {
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const row = await this.repository.findSkill(skillID, requester?.user_id);
    const summary = this.toSummary(row, requester);
    if (summary.detailAccess === 'none') {
      throw new ForbiddenException('permission_denied');
    }

    if (summary.detailAccess === 'summary') {
      return summary;
    }

    return this.toDetail(row, requester);
  }

  toSummary(row: SkillRow, requester?: RequesterScope): SkillSummary {
    const authorization = this.authorization.authorizationFor(row, requester);
    const installable = row.status === 'published' && authorization.isAuthorized;
    return {
      skillID: row.skill_id,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      status: row.status,
      visibilityLevel: row.visibility_level,
      detailAccess: authorization.detailAccess,
      canInstall: installable,
      cannotInstallReason: installable ? undefined : row.status === 'delisted' ? 'skill_delisted' : 'permission_denied',
      installState: installable ? 'not_installed' : 'blocked',
      authorName: row.author_name ?? undefined,
      authorDepartment: row.author_department ?? undefined,
      currentVersionUpdatedAt: toIsoString(row.updated_at),
      compatibleTools: row.compatible_tools ?? [],
      compatibleSystems: row.compatible_systems ?? [],
      tags: row.tags ?? [],
      category: row.category ?? '其他',
      starCount: Number(row.star_count),
      starred: Boolean(row.starred),
      downloadCount: Number(row.download_count),
      riskLevel: (row.risk_level ?? 'unknown') as SkillSummary['riskLevel'],
    };
  }

  toLeaderboardItem(row: SkillLeaderboardRow, requester?: RequesterScope): SkillLeaderboardItem {
    return {
      ...this.toSummary(row, requester),
      recentStarCount: Number(row.recent_star_count),
      recentDownloadCount: Number(row.recent_download_count),
      hotScore: Number(row.hot_score),
    };
  }

  async toDetail(row: SkillRow, requester?: RequesterScope): Promise<SkillDetail> {
    const [versions, readme] = await Promise.all([
      this.repository.listSkillVersions(row.id),
      this.readCurrentVersionReadme(row),
    ]);

    return {
      ...this.toSummary(row, requester),
      readme: readme ?? undefined,
      reviewSummary: row.review_summary ?? undefined,
      riskDescription: row.risk_description ?? undefined,
      versions: versions.length > 0
        ? versions.map((version) => ({
            version: version.version,
            publishedAt: toIsoString(version.published_at),
            changelog: version.changelog ?? undefined,
            riskLevel: version.risk_level ?? undefined,
          }))
        : row.published_at
          ? [{ version: row.version, publishedAt: toIsoString(row.published_at), changelog: row.review_summary ?? undefined, riskLevel: (row.risk_level ?? 'unknown') as SkillSummary['riskLevel'] }]
          : undefined,
      enabledTargets: [],
      latestVersion: row.version,
      canUpdate: this.authorization.canUpdate(row, requester),
    };
  }

  private async readCurrentVersionReadme(row: SkillRow): Promise<string | null> {
    if (!this.packageStorage) return null;
    try {
      const packageRow = await this.repository.loadPublishedPackageForVersion(row.skill_id, row.version);
      if (!packageRow) return null;
      return await this.packageStorage.readPackageMarkdownFile(packageRow.bucket, packageRow.object_key, 'README.md');
    } catch {
      return null;
    }
  }
}

function compareNames(left: SkillSummary, right: SkillSummary): number {
  return left.displayName.localeCompare(right.displayName, 'zh-Hans-CN');
}

function compareDownloadLeaderboard(left: SkillLeaderboardItem, right: SkillLeaderboardItem): number {
  return right.downloadCount - left.downloadCount || right.starCount - left.starCount || compareNames(left, right);
}

function compareStarLeaderboard(left: SkillLeaderboardItem, right: SkillLeaderboardItem): number {
  return right.starCount - left.starCount || right.downloadCount - left.downloadCount || compareNames(left, right);
}

function compareHotLeaderboard(left: SkillLeaderboardItem, right: SkillLeaderboardItem): number {
  return (
    right.hotScore - left.hotScore ||
    right.recentDownloadCount - left.recentDownloadCount ||
    right.recentStarCount - left.recentStarCount ||
    right.downloadCount - left.downloadCount ||
    right.starCount - left.starCount ||
    right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt) ||
    compareNames(left, right)
  );
}
