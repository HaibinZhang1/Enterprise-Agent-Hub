import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DetailAccess,
  DownloadTicketResponse,
  PageResponse,
  SkillDetail,
  SkillStatus,
  SkillSummary,
  VisibilityLevel,
  pageOf,
} from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';

export interface SkillListQuery {
  q?: string;
  departmentID?: string;
  compatibleTool?: string;
  installed?: string;
  enabled?: string;
  accessScope?: string;
  category?: string;
  riskLevel?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
}

export interface DownloadTicketRequest {
  purpose?: 'install' | 'update';
  targetVersion?: string;
  localVersion?: string | null;
}

interface SkillRow {
  id: string;
  skill_id: string;
  display_name: string;
  description: string;
  status: SkillStatus;
  visibility_level: VisibilityLevel;
  category: string | null;
  updated_at: Date;
  version: string;
  risk_level: string | null;
  risk_description: string | null;
  review_summary: string | null;
  published_at: Date;
  author_name: string | null;
  author_department: string | null;
  tags: string[] | null;
  compatible_tools: string[] | null;
  compatible_systems: string[] | null;
  star_count: string;
  download_count: string;
}

interface PackageRow {
  id: string;
  skill_id: string;
  version: string;
  sha256: string;
  size_bytes: number;
  file_count: number;
  object_key: string;
}

@Injectable()
export class SkillsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: SkillListQuery): Promise<PageResponse<SkillSummary>> {
    const page = positiveInt(query.page, 1);
    const pageSize = positiveInt(query.pageSize, 20, 100);
    const rows = await this.loadSkillRows();
    const summaries = rows.map((row) => this.toSummary(row)).filter((skill) => this.matches(skill, query));
    const sorted = this.sort(summaries, query.sort ?? 'composite', query.q);
    const start = (page - 1) * pageSize;
    return pageOf(sorted.slice(start, start + pageSize), page, pageSize, sorted.length);
  }

  async detail(skillID: string): Promise<SkillDetail | SkillSummary> {
    const row = await this.find(skillID);
    const skill = this.toDetail(row);
    if (skill.detailAccess === 'none') {
      throw new ForbiddenException('当前用户无权查看该 Skill');
    }

    if (skill.detailAccess === 'summary') {
      return this.toSummary(row);
    }

    return skill;
  }

  async downloadTicket(skillID: string, request: DownloadTicketRequest): Promise<DownloadTicketResponse> {
    const row = await this.find(skillID);
    const skill = this.toSummary(row);
    if (!skill.canInstall && !this.canUpdate(row)) {
      throw new ForbiddenException(skill.cannotInstallReason ?? '当前用户无权安装该 Skill');
    }
    if (skill.status === 'delisted' || skill.status === 'archived') {
      throw new ForbiddenException(skill.status === 'delisted' ? 'skill_delisted' : 'scope_restricted');
    }

    const version = request.targetVersion ?? row.version;
    const packageRow = await this.database.one<PackageRow>(
      `
      SELECT p.id, s.skill_id, v.version, p.sha256, p.size_bytes, p.file_count, p.object_key
      FROM skills s
      JOIN skill_versions v ON v.id = s.current_version_id
      JOIN skill_packages p ON p.skill_version_id = v.id
      WHERE s.skill_id = $1 AND v.version = $2
      `,
      [skillID, version],
    );
    if (!packageRow) {
      throw new ForbiddenException('package_unavailable');
    }

    return {
      skillID: packageRow.skill_id,
      version: packageRow.version,
      packageRef: packageRow.id,
      packageURL: `minio://${packageRow.object_key}?ticket=p1-dev-ticket`,
      packageHash: packageRow.sha256,
      packageSize: Number(packageRow.size_bytes),
      packageFileCount: Number(packageRow.file_count),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async star(userID: string, skillID: string, starred: boolean): Promise<{ skillID: string; starred: boolean; starCount: number }> {
    const row = await this.find(skillID);
    if (starred) {
      await this.database.query(
        'INSERT INTO skill_stars (user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userID, row.id],
      );
    } else {
      await this.database.query('DELETE FROM skill_stars WHERE user_id = $1 AND skill_id = $2', [userID, row.id]);
    }

    const count = await this.database.one<{ count: string }>('SELECT count(*) FROM skill_stars WHERE skill_id = $1', [row.id]);
    return { skillID: row.skill_id, starred, starCount: Number(count?.count ?? 0) };
  }

  private async find(skillID: string): Promise<SkillRow> {
    const row = (await this.loadSkillRows(skillID))[0];
    if (!row) {
      throw new NotFoundException('Skill 不存在或不可见');
    }
    return row;
  }

  private async loadSkillRows(skillID?: string): Promise<SkillRow[]> {
    const values = skillID ? [skillID] : [];
    const result = await this.database.query<SkillRow>(
      `
      SELECT
        s.id,
        s.skill_id,
        s.display_name,
        s.description,
        s.status,
        s.visibility_level,
        s.category,
        s.updated_at,
        v.version,
        v.risk_level,
        v.risk_description,
        v.review_summary,
        v.published_at,
        u.display_name AS author_name,
        d.name AS author_department,
        COALESCE(array_agg(DISTINCT st.tag) FILTER (WHERE st.tag IS NOT NULL), '{}') AS tags,
        COALESCE(array_agg(DISTINCT tc.tool_id) FILTER (WHERE tc.tool_id IS NOT NULL), '{}') AS compatible_tools,
        COALESCE(array_agg(DISTINCT tc.system) FILTER (WHERE tc.system IS NOT NULL), '{}') AS compatible_systems,
        (SELECT count(*) FROM skill_stars stars WHERE stars.skill_id = s.id) AS star_count,
        (SELECT count(*) FROM download_events downloads WHERE downloads.skill_id = s.id) AS download_count
      FROM skills s
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN skill_tags st ON st.skill_id = s.id
      LEFT JOIN skill_tool_compatibilities tc ON tc.skill_id = s.id
      ${skillID ? 'WHERE s.skill_id = $1' : ''}
      GROUP BY s.id, v.id, u.display_name, d.name
      ORDER BY s.updated_at DESC
      `,
      values,
    );
    return result.rows;
  }

  private toSummary(row: SkillRow): SkillSummary {
    const detailAccess = this.detailAccess(row.visibility_level);
    const installable = row.status === 'published' && row.visibility_level === 'public_installable';
    return {
      skillID: row.skill_id,
      displayName: row.display_name,
      description: row.description,
      version: row.version,
      status: row.status,
      visibilityLevel: row.visibility_level,
      detailAccess,
      canInstall: installable,
      cannotInstallReason: installable ? undefined : row.status === 'delisted' ? 'skill_delisted' : 'permission_denied',
      installState: installable ? 'not_installed' : 'blocked',
      authorName: row.author_name ?? undefined,
      authorDepartment: row.author_department ?? undefined,
      currentVersionUpdatedAt: row.updated_at.toISOString(),
      compatibleTools: row.compatible_tools ?? [],
      compatibleSystems: row.compatible_systems ?? [],
      tags: row.tags ?? [],
      category: row.category ?? undefined,
      starCount: Number(row.star_count),
      downloadCount: Number(row.download_count),
      riskLevel: (row.risk_level ?? 'unknown') as SkillSummary['riskLevel'],
    };
  }

  private toDetail(row: SkillRow): SkillDetail {
    return {
      ...this.toSummary(row),
      readme: '安装后通过 Desktop 选择目标工具启用，默认 symlink，失败时 copy 降级。',
      usage: '下载并写入 Central Store 后，可启用到内置工具或项目目录。',
      screenshots: [],
      reviewSummary: row.review_summary ?? undefined,
      riskDescription: row.risk_description ?? undefined,
      versions: [{ version: row.version, publishedAt: row.published_at.toISOString() }],
      enabledTargets: [],
      latestVersion: row.version,
      hasUpdate: false,
      canUpdate: this.canUpdate(row),
    };
  }

  private detailAccess(visibility: VisibilityLevel): DetailAccess {
    switch (visibility) {
      case 'public_installable':
      case 'detail_visible':
        return 'full';
      case 'summary_visible':
        return 'summary';
      case 'private':
      default:
        return 'none';
    }
  }

  private canUpdate(row: SkillRow): boolean {
    return row.status === 'published' && row.visibility_level === 'public_installable';
  }

  private matches(skill: SkillSummary, query: SkillListQuery): boolean {
    if (query.q) {
      const haystack = [
        skill.skillID,
        skill.displayName,
        skill.description,
        skill.authorName,
        skill.authorDepartment,
        ...(skill.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query.q.toLowerCase())) {
        return false;
      }
    }
    if (query.departmentID && query.departmentID !== skill.authorDepartment) {
      return false;
    }
    if (query.compatibleTool && !skill.compatibleTools.includes(query.compatibleTool)) {
      return false;
    }
    if (query.category && query.category !== skill.category) {
      return false;
    }
    if (query.riskLevel && query.riskLevel !== skill.riskLevel) {
      return false;
    }
    if (query.installed === 'true' && skill.installState === 'not_installed') {
      return false;
    }
    if (query.enabled === 'true' && skill.installState !== 'enabled') {
      return false;
    }
    if (query.accessScope === 'authorized_only' && skill.detailAccess === 'none') {
      return false;
    }
    return true;
  }

  private sort(skills: SkillSummary[], sort: string, q?: string): SkillSummary[] {
    const copy = [...skills];
    switch (sort) {
      case 'latest_published':
      case 'recently_updated':
        return copy.sort((a, b) => b.currentVersionUpdatedAt.localeCompare(a.currentVersionUpdatedAt));
      case 'download_count':
        return copy.sort((a, b) => b.downloadCount - a.downloadCount);
      case 'star_count':
        return copy.sort((a, b) => b.starCount - a.starCount);
      case 'relevance':
      case 'composite':
      default:
        return copy.sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q));
    }
  }
}

function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function relevanceScore(skill: SkillSummary, q?: string): number {
  const term = q?.toLowerCase();
  const ftsHit = term && `${skill.skillID} ${skill.displayName}`.toLowerCase().includes(term) ? 100 : 0;
  const statusWeight = skill.status === 'published' ? 10 : 0;
  return ftsHit + statusWeight + skill.starCount + skill.downloadCount / 10;
}
