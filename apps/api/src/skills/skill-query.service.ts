import { ForbiddenException, Injectable } from '@nestjs/common';
import type { PageResponse, SkillDetail, SkillSummary } from '../common/p1-contracts';
import { pageOf } from '../common/p1-contracts';
import { SkillAuthorizationService } from './skill-authorization.service';
import { SkillsRepository } from './skills.repository';
import { buildSkillListQueryPlan, toIsoString } from './skills.query';
import type { RequesterScope, SkillListQuery, SkillRow } from './skills.types';

@Injectable()
export class SkillQueryService {
  constructor(
    private readonly repository: SkillsRepository,
    private readonly authorization: SkillAuthorizationService,
  ) {}

  async list(query: SkillListQuery, userID?: string): Promise<PageResponse<SkillSummary>> {
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const plan = buildSkillListQueryPlan(query, { requester, requirePublished: true });
    const rows = await this.repository.listSkills(plan);
    const total = Number(rows[0]?.total_count ?? 0);
    const items = rows.map((row) => this.toSummary(row, requester));
    return pageOf(items, plan.page, plan.pageSize, total);
  }

  async detail(skillID: string, userID?: string): Promise<SkillDetail | SkillSummary> {
    const row = await this.repository.findSkill(skillID);
    const requester = userID ? await this.authorization.loadRequesterScope(userID) : undefined;
    const skill = this.toDetail(row, requester);
    if (skill.detailAccess === 'none') {
      throw new ForbiddenException('permission_denied');
    }

    if (skill.detailAccess === 'summary') {
      return this.toSummary(row, requester);
    }

    return skill;
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
      category: row.category ?? undefined,
      starCount: Number(row.star_count),
      downloadCount: Number(row.download_count),
      riskLevel: (row.risk_level ?? 'unknown') as SkillSummary['riskLevel'],
    };
  }

  toDetail(row: SkillRow, requester?: RequesterScope): SkillDetail {
    return {
      ...this.toSummary(row, requester),
      reviewSummary: row.review_summary ?? undefined,
      riskDescription: row.risk_description ?? undefined,
      versions: row.published_at
        ? [{ version: row.version, publishedAt: toIsoString(row.published_at) }]
        : undefined,
      enabledTargets: [],
      latestVersion: row.version,
      canUpdate: this.authorization.canUpdate(row, requester),
    };
  }
}
