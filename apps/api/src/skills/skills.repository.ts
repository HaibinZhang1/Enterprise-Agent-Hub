import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  ListedSkillRow,
  PackageDownloadTicketRow,
  PackageRow,
  RequesterScope,
  SkillLeaderboardQueryPlan,
  SkillLeaderboardRow,
  SkillListQueryPlan,
  SkillRow,
  SkillVersionRow,
} from './skills.types';

@Injectable()
export class SkillsRepository {
  constructor(private readonly database: DatabaseService) {}

  async listSkills(plan: SkillListQueryPlan): Promise<ListedSkillRow[]> {
    const result = await this.database.query<ListedSkillRow>(plan.text, plan.values);
    return result.rows;
  }

  async listSkillLeaderboards(plan: SkillLeaderboardQueryPlan): Promise<SkillLeaderboardRow[]> {
    const result = await this.database.query<SkillLeaderboardRow>(plan.text, plan.values);
    return result.rows;
  }

  async findSkill(skillID: string, requesterUserID?: string): Promise<SkillRow> {
    const row = (await this.loadSkillRows(skillID, requesterUserID))[0];
    if (!row) {
      throw new NotFoundException('skill_not_found');
    }
    return row;
  }

  async loadRequesterScope(userID: string): Promise<RequesterScope | null> {
    return this.database.one<RequesterScope>(
      `
      SELECT u.id AS user_id, u.department_id, d.path AS department_path
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
      [userID],
    );
  }

  async loadPublishedPackageForVersion(skillID: string, version: string): Promise<PackageRow | null> {
    return this.database.one<PackageRow>(
      `
      SELECT p.id, s.skill_id, v.version, p.bucket, p.sha256, p.size_bytes, p.file_count, p.object_key, p.content_type
      FROM skills s
      JOIN skill_versions v ON v.id = s.current_version_id
      JOIN skill_packages p ON p.skill_version_id = v.id
      WHERE s.skill_id = $1 AND v.version = $2
      `,
      [skillID, version],
    );
  }

  async listSkillVersions(skillRowID: string): Promise<SkillVersionRow[]> {
    const result = await this.database.query<SkillVersionRow>(
      `
      SELECT version, changelog, risk_level, published_at
      FROM skill_versions
      WHERE skill_id = $1
      ORDER BY published_at DESC, version DESC
      `,
      [skillRowID],
    );
    return result.rows;
  }

  async loadPackageRow(packageRef: string): Promise<PackageRow | null> {
    const publishedPackage = await this.database.one<PackageRow>(
      `
      SELECT p.id, s.skill_id, v.version, p.bucket, p.sha256, p.size_bytes, p.file_count, p.object_key, p.content_type
      FROM skill_packages p
      JOIN skill_versions v ON v.id = p.skill_version_id
      JOIN skills s ON s.id = v.skill_id
      WHERE p.id = $1
      `,
      [packageRef],
    );
    if (publishedPackage) {
      return publishedPackage;
    }

    return this.database.one<PackageRow>(
      `
      SELECT
        r.id,
        r.skill_id,
        COALESCE(r.requested_version, current_version.version, '0.0.0') AS version,
        r.staged_package_bucket AS bucket,
        r.staged_package_sha256 AS sha256,
        COALESCE(r.staged_package_size_bytes, 0) AS size_bytes,
        COALESCE(r.staged_package_file_count, 0) AS file_count,
        r.staged_package_object_key AS object_key,
        'application/zip' AS content_type
      FROM review_items r
      LEFT JOIN skills s ON s.skill_id = r.skill_id
      LEFT JOIN skill_versions current_version ON current_version.id = s.current_version_id
      WHERE r.id = $1
        AND r.staged_package_bucket IS NOT NULL
        AND r.staged_package_object_key IS NOT NULL
      `,
      [packageRef],
    );
  }

  async insertPackageDownloadTicket(input: {
    ticket: string;
    packageRef: string;
    userID: string | null;
    purpose: 'published' | 'staged';
    requiresAuth: boolean;
    expiresAt: string;
  }): Promise<void> {
    await this.database.query(
      `
      INSERT INTO package_download_tickets (ticket, package_ref, user_id, purpose, requires_auth, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [input.ticket, input.packageRef, input.userID, input.purpose, input.requiresAuth, input.expiresAt],
    );
  }

  async recordDownloadEvent(input: {
    userID: string;
    skillRowID: string;
    version: string;
    purpose: 'install' | 'update';
  }): Promise<void> {
    await this.database.query(
      `
      INSERT INTO download_events (user_id, skill_id, version, purpose)
      SELECT $1, $2, $3, $4
      WHERE NOT EXISTS (
        SELECT 1
        FROM download_events
        WHERE user_id = $1
          AND skill_id = $2
          AND purpose = $4
      )
      `,
      [input.userID, input.skillRowID, input.version, input.purpose],
    );
  }

  async findPackageDownloadTicket(packageRef: string, ticket: string): Promise<PackageDownloadTicketRow | null> {
    return this.database.one<PackageDownloadTicketRow>(
      `
      SELECT ticket, package_ref, user_id, purpose, requires_auth, expires_at
      FROM package_download_tickets
      WHERE ticket = $1
        AND package_ref = $2
        AND expires_at > now()
      `,
      [ticket, packageRef],
    );
  }

  async setStar(userID: string, rowID: string, starred: boolean): Promise<void> {
    if (starred) {
      await this.database.query(
        'INSERT INTO skill_stars (user_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userID, rowID],
      );
      return;
    }
    await this.database.query('DELETE FROM skill_stars WHERE user_id = $1 AND skill_id = $2', [userID, rowID]);
  }

  async countStars(rowID: string): Promise<number> {
    const count = await this.database.one<{ count: string }>('SELECT count(*) FROM skill_stars WHERE skill_id = $1', [rowID]);
    return Number(count?.count ?? 0);
  }

  private async loadSkillRows(skillID?: string, requesterUserID?: string): Promise<SkillRow[]> {
    const values = skillID ? [skillID] : [];
    const requesterStarParam = requesterUserID ? `$${values.push(requesterUserID)}` : null;
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
        u.username AS author_name,
        d.name AS author_department,
        COALESCE(array_agg(DISTINCT st.tag) FILTER (WHERE st.tag IS NOT NULL), '{}') AS tags,
        COALESCE(array_agg(DISTINCT tc.tool_id) FILTER (WHERE tc.tool_id IS NOT NULL), '{}') AS compatible_tools,
        COALESCE(array_agg(DISTINCT tc.system) FILTER (WHERE tc.system IS NOT NULL), '{}') AS compatible_systems,
        auth.scope_type,
        auth.scope_department_ids,
        auth.scope_department_paths,
        (SELECT count(*) FROM skill_stars stars WHERE stars.skill_id = s.id) AS star_count,
        ${requesterStarParam ? `(requester_star.user_id IS NOT NULL)` : 'false'} AS starred,
        (SELECT count(*) FROM download_events downloads WHERE downloads.skill_id = s.id) AS download_count
      FROM skills s
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      LEFT JOIN departments d ON d.id = s.department_id
      LEFT JOIN skill_tags st ON st.skill_id = s.id
      LEFT JOIN skill_tool_compatibilities tc ON tc.skill_id = s.id
      ${requesterStarParam ? `LEFT JOIN skill_stars requester_star ON requester_star.skill_id = s.id AND requester_star.user_id = ${requesterStarParam}` : ''}
      LEFT JOIN LATERAL (
        SELECT
          sa.scope_type,
          array_remove(array_agg(sa.department_id ORDER BY sa.department_id), NULL) AS scope_department_ids,
          array_remove(array_agg(scope_department.path ORDER BY scope_department.path), NULL) AS scope_department_paths
        FROM skill_authorizations sa
        LEFT JOIN departments scope_department ON scope_department.id = sa.department_id
        WHERE sa.skill_id = s.id
        GROUP BY sa.scope_type
        ORDER BY count(*) DESC, sa.scope_type ASC
        LIMIT 1
      ) auth ON true
      ${skillID ? 'WHERE s.skill_id = $1' : ''}
      GROUP BY s.id, v.id, u.username, d.name, auth.scope_type, auth.scope_department_ids, auth.scope_department_paths${requesterStarParam ? ', requester_star.user_id' : ''}
      ORDER BY s.updated_at DESC
      `,
      values,
    );
    return result.rows;
  }
}
