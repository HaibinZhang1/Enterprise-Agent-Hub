import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Client as MinioClient } from 'minio';
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
  updated_at: Date | string;
  version: string;
  risk_level: string | null;
  risk_description: string | null;
  review_summary: string | null;
  published_at: Date | string;
  author_name: string | null;
  author_department: string | null;
  tags: string[] | null;
  compatible_tools: string[] | null;
  compatible_systems: string[] | null;
  star_count: string;
  download_count: string;
}

interface ListedSkillRow extends SkillRow {
  total_count: string;
}

interface PackageRow {
  id: string;
  skill_id: string;
  version: string;
  bucket: string;
  sha256: string;
  size_bytes: number;
  file_count: number;
  object_key: string;
  content_type: string;
}

export interface DownloadablePackage {
  stream: Readable;
  contentType: string;
  contentLength: number;
  fileName: string;
}

export interface SkillListQueryPlan {
  page: number;
  pageSize: number;
  text: string;
  values: unknown[];
}

@Injectable()
export class SkillsService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: SkillListQuery): Promise<PageResponse<SkillSummary>> {
    const plan = buildSkillListQueryPlan(query);
    const result = await this.database.query<ListedSkillRow>(plan.text, plan.values);
    const rows = result.rows;
    const items = rows.map((row) => this.toSummary(row));
    const total = rows[0] ? Number(rows[0].total_count) : 0;
    return pageOf(items, plan.page, plan.pageSize, total);
  }

  async detail(skillID: string): Promise<SkillDetail | SkillSummary> {
    const row = await this.find(skillID);
    const skill = this.toDetail(row);
    if (skill.detailAccess === 'none') {
      throw new ForbiddenException('permission_denied');
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
      SELECT p.id, s.skill_id, v.version, p.bucket, p.sha256, p.size_bytes, p.file_count, p.object_key, p.content_type
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
      packageURL: `/skill-packages/${encodeURIComponent(packageRow.id)}/download?ticket=p1-dev-ticket`,
      packageHash: packageRow.sha256,
      packageSize: Number(packageRow.size_bytes),
      packageFileCount: Number(packageRow.file_count),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async downloadPackage(packageRef: string, ticket?: string): Promise<DownloadablePackage> {
    if (ticket !== 'p1-dev-ticket') {
      throw new ForbiddenException('permission_denied');
    }

    const packageRow = await this.database.one<PackageRow>(
      `
      SELECT p.id, s.skill_id, v.version, p.bucket, p.sha256, p.size_bytes, p.file_count, p.object_key, p.content_type
      FROM skill_packages p
      JOIN skill_versions v ON v.id = p.skill_version_id
      JOIN skills s ON s.id = v.skill_id
      WHERE p.id = $1
      `,
      [packageRef],
    );
    if (!packageRow) {
      throw new NotFoundException('package_unavailable');
    }

    const minioStream = await this.tryReadMinioObject(packageRow);
    if (minioStream) {
      return this.packageDownload(packageRow, minioStream);
    }

    const fallbackPath = this.seedPackagePath(packageRow.object_key);
    if (fallbackPath && existsSync(fallbackPath)) {
      return this.packageDownload(packageRow, createReadStream(fallbackPath));
    }

    throw new NotFoundException('package_unavailable');
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
      throw new NotFoundException('skill_not_found');
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

  private toDetail(row: SkillRow): SkillDetail {
    return {
      ...this.toSummary(row),
      readme: '安装后通过 Desktop 选择目标工具启用，默认 symlink，失败时 copy 降级。',
      usage: '下载并写入 Central Store 后，可启用到内置工具或项目目录。',
      screenshots: [],
      reviewSummary: row.review_summary ?? undefined,
      riskDescription: row.risk_description ?? undefined,
      versions: [{ version: row.version, publishedAt: toIsoString(row.published_at) }],
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
}

function positiveInt(value: string | undefined, fallback: number, max = 100): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

export function buildSkillListQueryPlan(query: SkillListQuery): SkillListQueryPlan {
  const page = positiveInt(query.page, 1);
  const pageSize = positiveInt(query.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const values: unknown[] = [];
  const conditions: string[] = [];
  const searchTerm = query.q?.trim();

  const push = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  const searchParam = searchTerm ? push(searchTerm) : null;

  if (searchParam) {
    conditions.push(
      `(doc.search_vector @@ websearch_to_tsquery('simple', ${searchParam}) OR POSITION(LOWER(${searchParam}) IN LOWER(doc.document)) > 0)`,
    );
  }

  if (query.departmentID) {
    conditions.push(`d.name = ${push(query.departmentID)}`);
  }

  if (query.compatibleTool) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM skill_tool_compatibilities tc_filter
        WHERE tc_filter.skill_id = s.id AND tc_filter.tool_id = ${push(query.compatibleTool)}
      )`,
    );
  }

  if (query.category) {
    conditions.push(`s.category = ${push(query.category)}`);
  }

  if (query.riskLevel) {
    conditions.push(`v.risk_level = ${push(query.riskLevel)}`);
  }

  if (query.accessScope === 'authorized_only') {
    conditions.push(`s.visibility_level <> 'private'`);
  }

  const whereClause = conditions.length > 0 ? conditions.join('\n        AND ') : 'TRUE';
  const orderByClause = buildSkillOrderClause(query.sort ?? 'composite', searchParam);
  const limitParam = push(pageSize);
  const offsetParam = push(offset);

  return {
    page,
    pageSize,
    values,
    text: `
      WITH star_counts AS (
        SELECT skill_id, count(*)::bigint AS star_count
        FROM skill_stars
        GROUP BY skill_id
      ),
      download_counts AS (
        SELECT skill_id, count(*)::bigint AS download_count
        FROM download_events
        GROUP BY skill_id
      ),
      base AS (
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
          COALESCE(stars.star_count, 0)::text AS star_count,
          COALESCE(downloads.download_count, 0)::text AS download_count,
          doc.document,
          ${searchParam ? `ts_rank_cd(doc.search_vector, websearch_to_tsquery('simple', ${searchParam}))` : '0'} AS search_rank
        FROM skills s
        JOIN skill_versions v ON v.id = s.current_version_id
        LEFT JOIN users u ON u.id = s.author_id
        LEFT JOIN departments d ON d.id = s.department_id
        LEFT JOIN skill_tags st ON st.skill_id = s.id
        LEFT JOIN skill_tool_compatibilities tc ON tc.skill_id = s.id
        LEFT JOIN skill_search_documents doc ON doc.skill_id = s.id
        LEFT JOIN star_counts stars ON stars.skill_id = s.id
        LEFT JOIN download_counts downloads ON downloads.skill_id = s.id
        WHERE ${whereClause}
        GROUP BY
          s.id,
          v.id,
          u.display_name,
          d.name,
          doc.document,
          doc.search_vector,
          stars.star_count,
          downloads.download_count
      )
      SELECT
        base.id,
        base.skill_id,
        base.display_name,
        base.description,
        base.status,
        base.visibility_level,
        base.category,
        base.updated_at,
        base.version,
        base.risk_level,
        base.risk_description,
        base.review_summary,
        base.published_at,
        base.author_name,
        base.author_department,
        base.tags,
        base.compatible_tools,
        base.compatible_systems,
        base.star_count,
        base.download_count,
        count(*) OVER()::text AS total_count
      FROM base
      ORDER BY ${orderByClause}
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
  };
}

function buildSkillOrderClause(sort: string, searchParam: string | null): string {
  const searchBoost = searchParam
    ? `CASE WHEN POSITION(LOWER(${searchParam}) IN LOWER(base.document)) > 0 THEN 100 ELSE 0 END`
    : '0';
  const publishedBoost = `CASE WHEN base.status = 'published' THEN 10 ELSE 0 END`;
  const composite = `(${searchBoost} + ${publishedBoost} + base.star_count::bigint + (base.download_count::bigint / 10.0)) DESC, base.updated_at DESC, base.skill_id ASC`;

  switch (sort) {
    case 'latest_published':
      return `base.published_at DESC, base.updated_at DESC, base.skill_id ASC`;
    case 'recently_updated':
      return `base.updated_at DESC, base.skill_id ASC`;
    case 'download_count':
      return `base.download_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`;
    case 'star_count':
      return `base.star_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`;
    case 'relevance':
      return searchParam
        ? `base.search_rank DESC, ${searchBoost} DESC, ${publishedBoost} DESC, base.star_count::bigint DESC, base.download_count::bigint DESC, base.updated_at DESC, base.skill_id ASC`
        : composite;
    case 'composite':
    default:
      return composite;
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
