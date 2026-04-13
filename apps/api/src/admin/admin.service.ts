import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminSkillDto,
  AdminUserDto,
  DepartmentNodeDto,
  ReviewDetailDto,
  ReviewHistoryDto,
  ReviewItemDto,
  RiskLevel,
  SkillStatus,
  VisibilityLevel,
} from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/password';

interface ActorContext {
  userID: string;
  displayName: string;
  role: 'normal_user' | 'admin';
  adminLevel: number;
  departmentID: string;
  departmentName: string;
  departmentPath: string;
}

interface DepartmentRow {
  department_id: string;
  parent_department_id: string | null;
  name: string;
  path: string;
  level: number;
  status: string;
  user_count: string;
  skill_count: string;
}

interface UserRow {
  user_id: string;
  username: string;
  display_name: string;
  department_id: string;
  department_name: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
  status: 'active' | 'frozen' | 'deleted';
  published_skill_count: string;
  star_count: string;
}

interface SkillRow {
  skill_id: string;
  display_name: string;
  publisher_name: string;
  department_id: string;
  department_name: string;
  department_path: string;
  version: string;
  status: SkillStatus;
  visibility_level: VisibilityLevel;
  star_count: string;
  download_count: string;
  updated_at: Date;
}

interface ReviewRow {
  review_id: string;
  skill_id: string;
  skill_display_name: string;
  submitter_name: string;
  submitter_department_name: string;
  submitter_department_path: string;
  review_type: 'publish' | 'update' | 'permission_change';
  review_status: 'pending' | 'in_review' | 'reviewed';
  risk_level: RiskLevel;
  summary: string;
  description: string;
  review_summary: string | null;
  current_reviewer_name: string | null;
  lock_owner_id: string | null;
  submitted_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  async listDepartments(userID: string): Promise<DepartmentNodeDto[]> {
    const actor = await this.loadActor(userID);
    const result = await this.database.query<DepartmentRow>(
      `
      SELECT
        d.id AS department_id,
        d.parent_id AS parent_department_id,
        d.name,
        d.path,
        d.level,
        d.status,
        (
          SELECT count(*)
          FROM users u
          JOIN departments du ON du.id = u.department_id
          WHERE u.status <> 'deleted'
            AND (du.id = d.id OR du.path LIKE d.path || '/%')
        ) AS user_count,
        (
          SELECT count(*)
          FROM skills s
          WHERE s.department_id = d.id
        ) AS skill_count
      FROM departments d
      WHERE d.id = $1 OR d.path LIKE $2
      ORDER BY d.path ASC
      `,
      [actor.departmentID, `${actor.departmentPath}/%`],
    );
    return buildDepartmentTree(result.rows);
  }

  async createDepartment(
    userID: string,
    input: { parentDepartmentID?: string; name?: string },
  ): Promise<DepartmentNodeDto[]> {
    const actor = await this.loadActor(userID);
    const name = input.name?.trim();
    if (!name || !input.parentDepartmentID) {
      throw new BadRequestException('validation_failed');
    }

    const parent = await this.loadDepartment(input.parentDepartmentID);
    if (!isWithinScope(parent.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    await this.database.query(
      `
      INSERT INTO departments (id, parent_id, name, path, level, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      `,
      [
        `dept_${randomBytes(6).toString('hex')}`,
        parent.id,
        name,
        `${parent.path}/${name}`,
        parent.level + 1,
      ],
    );
    return this.listDepartments(userID);
  }

  async updateDepartment(
    userID: string,
    departmentID: string,
    input: { name?: string },
  ): Promise<DepartmentNodeDto[]> {
    const actor = await this.loadActor(userID);
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('validation_failed');
    }

    const target = await this.loadDepartment(departmentID);
    if (!isWithinScope(target.path, actor.departmentPath) || target.id === actor.departmentID) {
      throw new ForbiddenException('permission_denied');
    }

    const nextPath = `${target.path.split('/').slice(0, -1).join('/')}/${name}`;
    await this.database.query(
      `
      UPDATE departments
      SET path = $2 || substring(path from char_length($1) + 1)
      WHERE path = $1 OR path LIKE $1 || '/%'
      `,
      [target.path, nextPath],
    );
    await this.database.query('UPDATE departments SET name = $2 WHERE id = $1', [departmentID, name]);
    return this.listDepartments(userID);
  }

  async deleteDepartment(userID: string, departmentID: string): Promise<{ ok: true }> {
    const actor = await this.loadActor(userID);
    const target = await this.loadDepartment(departmentID);
    if (!isWithinScope(target.path, actor.departmentPath) || target.id === actor.departmentID) {
      throw new ForbiddenException('permission_denied');
    }

    const blockers = await this.database.one<{
      child_count: string;
      user_count: string;
      skill_count: string;
    }>(
      `
      SELECT
        (SELECT count(*) FROM departments WHERE parent_id = $1) AS child_count,
        (SELECT count(*) FROM users WHERE department_id = $1 AND status <> 'deleted') AS user_count,
        (SELECT count(*) FROM skills WHERE department_id = $1) AS skill_count
      `,
      [departmentID],
    );
    if (!blockers || Number(blockers.child_count) > 0 || Number(blockers.user_count) > 0 || Number(blockers.skill_count) > 0) {
      throw new BadRequestException('validation_failed');
    }

    await this.database.query('DELETE FROM departments WHERE id = $1', [departmentID]);
    return { ok: true };
  }

  async listUsers(userID: string): Promise<AdminUserDto[]> {
    const actor = await this.loadActor(userID);
    const result = await this.database.query<UserRow>(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.display_name,
        u.department_id,
        d.name AS department_name,
        u.role,
        u.admin_level,
        u.status,
        (SELECT count(*) FROM skills s WHERE s.author_id = u.id) AS published_skill_count,
        (SELECT count(*) FROM skill_stars ss WHERE ss.user_id = u.id) AS star_count
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE (d.id = $1 OR d.path LIKE $2)
        AND u.status <> 'deleted'
      ORDER BY d.path ASC, u.display_name ASC
      `,
      [actor.departmentID, `${actor.departmentPath}/%`],
    );
    return result.rows.map(toAdminUser);
  }

  async createUser(
    userID: string,
    input: {
      username?: string;
      password?: string;
      displayName?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ): Promise<AdminUserDto[]> {
    const actor = await this.loadActor(userID);
    const username = input.username?.trim();
    const password = input.password?.trim();
    const displayName = input.displayName?.trim();
    if (!username || !password || !displayName || !input.departmentID || !input.role) {
      throw new BadRequestException('validation_failed');
    }

    const department = await this.loadDepartment(input.departmentID);
    if (!isWithinScope(department.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    const normalizedRole = input.role;
    const normalizedAdminLevel = normalizedRole === 'admin' ? input.adminLevel ?? null : null;
    this.assertAssignableRole(actor, normalizedRole, normalizedAdminLevel);

    await this.database.query(
      `
      INSERT INTO users (id, username, password_hash, display_name, department_id, role, admin_level, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      `,
      [
        `u_${randomBytes(6).toString('hex')}`,
        username,
        hashPassword(password),
        displayName,
        department.id,
        normalizedRole,
        normalizedAdminLevel,
      ],
    );
    return this.listUsers(userID);
  }

  async updateUser(
    userID: string,
    targetUserID: string,
    input: {
      displayName?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ): Promise<AdminUserDto[]> {
    const actor = await this.loadActor(userID);
    const target = await this.loadManagedUser(targetUserID);
    this.assertManagedUser(actor, target);

    const nextDepartment = input.departmentID ? await this.loadDepartment(input.departmentID) : null;
    if (nextDepartment && !isWithinScope(nextDepartment.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    const nextRole = input.role ?? target.role;
    const nextAdminLevel =
      nextRole === 'admin' ? (input.adminLevel ?? target.admin_level ?? null) : null;
    this.assertAssignableRole(actor, nextRole, nextAdminLevel, target.user_id === actor.userID);

    await this.database.query(
      `
      UPDATE users
      SET display_name = COALESCE($2, display_name),
          department_id = COALESCE($3, department_id),
          role = $4,
          admin_level = $5
      WHERE id = $1
      `,
      [targetUserID, input.displayName?.trim() || null, nextDepartment?.id ?? null, nextRole, nextAdminLevel],
    );
    return this.listUsers(userID);
  }

  async freezeUser(userID: string, targetUserID: string, nextStatus: 'frozen' | 'active'): Promise<AdminUserDto[]> {
    const actor = await this.loadActor(userID);
    const target = await this.loadManagedUser(targetUserID);
    this.assertManagedUser(actor, target);
    if (target.user_id === actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    await this.database.query('UPDATE users SET status = $2 WHERE id = $1', [targetUserID, nextStatus]);
    if (nextStatus === 'frozen') {
      await this.authService.revokeAllSessionsForUser(targetUserID);
    }
    return this.listUsers(userID);
  }

  async deleteUser(userID: string, targetUserID: string): Promise<{ ok: true }> {
    const actor = await this.loadActor(userID);
    const target = await this.loadManagedUser(targetUserID);
    this.assertManagedUser(actor, target);
    if (target.user_id === actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    await this.database.query("UPDATE users SET status = 'deleted' WHERE id = $1", [targetUserID]);
    await this.authService.revokeAllSessionsForUser(targetUserID);
    return { ok: true };
  }

  async listSkills(userID: string): Promise<AdminSkillDto[]> {
    const actor = await this.loadActor(userID);
    const result = await this.database.query<SkillRow>(
      `
      SELECT
        s.skill_id,
        s.display_name,
        COALESCE(u.display_name, '未知发布者') AS publisher_name,
        d.id AS department_id,
        d.name AS department_name,
        d.path AS department_path,
        v.version,
        s.status,
        s.visibility_level,
        (SELECT count(*) FROM skill_stars ss WHERE ss.skill_id = s.id) AS star_count,
        (SELECT count(*) FROM download_events de WHERE de.skill_id = s.id) AS download_count,
        s.updated_at
      FROM skills s
      JOIN departments d ON d.id = s.department_id
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      WHERE d.id = $1 OR d.path LIKE $2
      ORDER BY s.updated_at DESC
      `,
      [actor.departmentID, `${actor.departmentPath}/%`],
    );
    return result.rows.map(toAdminSkill);
  }

  async setSkillStatus(
    userID: string,
    skillID: string,
    nextStatus: 'delisted' | 'published' | 'archived',
  ): Promise<AdminSkillDto[]> {
    const actor = await this.loadActor(userID);
    const target = await this.loadManagedSkill(skillID);
    const withinScope = isWithinScope(target.department_path, actor.departmentPath, true);

    if (!withinScope) {
      const canCrossDepartmentDelist =
        actor.adminLevel === 1 &&
        nextStatus === 'delisted' &&
        target.visibility_level === 'public_installable';
      if (!canCrossDepartmentDelist) {
        throw new ForbiddenException('permission_denied');
      }
    }

    if (nextStatus === 'published' && target.status !== 'delisted') {
      throw new BadRequestException('validation_failed');
    }

    await this.database.query('UPDATE skills SET status = $2, updated_at = now() WHERE skill_id = $1', [skillID, nextStatus]);
    return this.listSkills(userID);
  }

  async listReviews(userID: string): Promise<ReviewItemDto[]> {
    const actor = await this.loadActor(userID);
    const rows = await this.loadReviewRows(actor);
    return rows.map(toReviewSummary);
  }

  async getReview(userID: string, reviewID: string): Promise<ReviewDetailDto> {
    const actor = await this.loadActor(userID);
    const row = (await this.loadReviewRows(actor, reviewID))[0];
    if (!row) {
      throw new NotFoundException('resource_not_found');
    }
    const historyResult = await this.database.query<{
      id: string;
      action: string;
      actor_name: string;
      comment: string | null;
      created_at: Date;
    }>(
      `
      SELECT h.id, h.action, COALESCE(u.display_name, '系统') AS actor_name, h.comment, h.created_at
      FROM review_item_history h
      LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.review_item_id = $1
      ORDER BY h.created_at ASC
      `,
      [reviewID],
    );

    return {
      ...toReviewSummary(row),
      description: row.description,
      reviewSummary: row.review_summary ?? undefined,
      history: historyResult.rows.map(
        (history): ReviewHistoryDto => ({
          historyID: history.id,
          action: history.action,
          actorName: history.actor_name,
          comment: history.comment,
          createdAt: history.created_at.toISOString(),
        }),
      ),
    };
  }

  private async loadActor(userID: string): Promise<ActorContext> {
    const actor = await this.database.one<{
      user_id: string;
      display_name: string;
      role: 'normal_user' | 'admin';
      admin_level: number | null;
      department_id: string;
      department_name: string;
      department_path: string;
      status: string;
    }>(
      `
      SELECT
        u.id AS user_id,
        u.display_name,
        u.role,
        u.admin_level,
        d.id AS department_id,
        d.name AS department_name,
        d.path AS department_path,
        u.status
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
      [userID],
    );
    if (!actor || actor.status !== 'active' || actor.role !== 'admin' || actor.admin_level === null) {
      throw new ForbiddenException('permission_denied');
    }
    return {
      userID: actor.user_id,
      displayName: actor.display_name,
      role: actor.role,
      adminLevel: actor.admin_level,
      departmentID: actor.department_id,
      departmentName: actor.department_name,
      departmentPath: actor.department_path,
    };
  }

  private async loadDepartment(departmentID: string): Promise<{ id: string; path: string; level: number }> {
    const department = await this.database.one<{ id: string; path: string; level: number }>(
      'SELECT id, path, level FROM departments WHERE id = $1',
      [departmentID],
    );
    if (!department) {
      throw new NotFoundException('resource_not_found');
    }
    return department;
  }

  private async loadManagedUser(targetUserID: string): Promise<UserRow & { department_path: string }> {
    const target = await this.database.one<UserRow & { department_path: string }>(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.display_name,
        u.department_id,
        d.name AS department_name,
        d.path AS department_path,
        u.role,
        u.admin_level,
        u.status,
        (SELECT count(*) FROM skills s WHERE s.author_id = u.id) AS published_skill_count,
        (SELECT count(*) FROM skill_stars ss WHERE ss.user_id = u.id) AS star_count
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.id = $1
      `,
      [targetUserID],
    );
    if (!target || target.status === 'deleted') {
      throw new NotFoundException('resource_not_found');
    }
    return target;
  }

  private async loadManagedSkill(skillID: string): Promise<SkillRow> {
    const target = await this.database.one<SkillRow>(
      `
      SELECT
        s.skill_id,
        s.display_name,
        COALESCE(u.display_name, '未知发布者') AS publisher_name,
        d.id AS department_id,
        d.name AS department_name,
        d.path AS department_path,
        v.version,
        s.status,
        s.visibility_level,
        (SELECT count(*) FROM skill_stars ss WHERE ss.skill_id = s.id) AS star_count,
        (SELECT count(*) FROM download_events de WHERE de.skill_id = s.id) AS download_count,
        s.updated_at
      FROM skills s
      JOIN departments d ON d.id = s.department_id
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      WHERE s.skill_id = $1
      `,
      [skillID],
    );
    if (!target) {
      throw new NotFoundException('skill_not_found');
    }
    return target;
  }

  private async loadReviewRows(actor: ActorContext, reviewID?: string): Promise<ReviewRow[]> {
    const result = await this.database.query<ReviewRow>(
      `
      SELECT
        r.id AS review_id,
        r.skill_id,
        r.skill_display_name,
        r.submitter_name,
        r.submitter_department_name,
        d.path AS submitter_department_path,
        r.review_type,
        r.review_status,
        r.risk_level,
        r.summary,
        r.description,
        r.review_summary,
        reviewer.display_name AS current_reviewer_name,
        r.lock_owner_id,
        r.submitted_at,
        r.updated_at
      FROM review_items r
      JOIN departments d ON d.id = r.submitter_department_id
      LEFT JOIN users reviewer ON reviewer.id = r.lock_owner_id
      WHERE (d.id = $1 OR d.path LIKE $2)
        ${reviewID ? 'AND r.id = $3' : ''}
      ORDER BY r.updated_at DESC
      `,
      reviewID
        ? [actor.departmentID, `${actor.departmentPath}/%`, reviewID]
        : [actor.departmentID, `${actor.departmentPath}/%`],
    );
    return result.rows;
  }

  private assertAssignableRole(
    actor: ActorContext,
    nextRole: 'normal_user' | 'admin',
    nextAdminLevel: number | null,
    updatingSelf = false,
  ): void {
    if (nextRole === 'normal_user') {
      return;
    }
    if (nextAdminLevel === null || nextAdminLevel <= actor.adminLevel) {
      throw new ForbiddenException('permission_denied');
    }
    if (updatingSelf) {
      throw new ForbiddenException('permission_denied');
    }
  }

  private assertManagedUser(actor: ActorContext, target: UserRow & { department_path: string }): void {
    if (!isWithinScope(target.department_path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }
    if (target.role === 'admin' && target.admin_level !== null && target.admin_level <= actor.adminLevel) {
      throw new ForbiddenException('permission_denied');
    }
  }
}

function buildDepartmentTree(rows: DepartmentRow[]): DepartmentNodeDto[] {
  const nodes = new Map<string, DepartmentNodeDto>();
  for (const row of rows) {
    nodes.set(row.department_id, {
      departmentID: row.department_id,
      parentDepartmentID: row.parent_department_id,
      name: row.name,
      path: row.path,
      level: row.level,
      status: row.status,
      userCount: Number(row.user_count),
      skillCount: Number(row.skill_count),
      children: [],
    });
  }

  const roots: DepartmentNodeDto[] = [];
  for (const node of nodes.values()) {
    if (node.parentDepartmentID && nodes.has(node.parentDepartmentID)) {
      nodes.get(node.parentDepartmentID)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function toAdminUser(row: UserRow): AdminUserDto {
  return {
    userID: row.user_id,
    username: row.username,
    displayName: row.display_name,
    departmentID: row.department_id,
    departmentName: row.department_name,
    role: row.role,
    adminLevel: row.admin_level,
    status: row.status,
    publishedSkillCount: Number(row.published_skill_count),
    starCount: Number(row.star_count),
  };
}

function toAdminSkill(row: SkillRow): AdminSkillDto {
  return {
    skillID: row.skill_id,
    displayName: row.display_name,
    publisherName: row.publisher_name,
    departmentID: row.department_id,
    departmentName: row.department_name,
    version: row.version,
    status: row.status,
    visibilityLevel: row.visibility_level,
    starCount: Number(row.star_count),
    downloadCount: Number(row.download_count),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toReviewSummary(row: ReviewRow): ReviewItemDto {
  return {
    reviewID: row.review_id,
    skillID: row.skill_id,
    skillDisplayName: row.skill_display_name,
    submitterName: row.submitter_name,
    submitterDepartmentName: row.submitter_department_name,
    reviewType: row.review_type,
    reviewStatus: row.review_status,
    riskLevel: row.risk_level,
    summary: row.summary,
    lockState: row.lock_owner_id ? 'locked' : 'unlocked',
    currentReviewerName: row.current_reviewer_name ?? undefined,
    submittedAt: row.submitted_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isWithinScope(targetPath: string, actorPath: string, includeSelf = false): boolean {
  return includeSelf ? targetPath === actorPath || targetPath.startsWith(`${actorPath}/`) : targetPath.startsWith(`${actorPath}/`);
}
