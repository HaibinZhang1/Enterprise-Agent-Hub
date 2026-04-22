import { Injectable, NotFoundException } from '@nestjs/common';
import { RiskLevel, SkillStatus, VisibilityLevel } from '../common/p1-contracts';
import { DatabaseService } from '../database/database.service';

export interface ActorRow {
  user_id: string;
  display_name: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
  department_id: string;
  department_name: string;
  department_path: string;
  status: string;
}

export interface DepartmentRow {
  department_id: string;
  parent_department_id: string | null;
  name: string;
  path: string;
  level: number;
  status: string;
  user_count: string;
  skill_count: string;
  admin_count: string;
}

export interface UserRow {
  user_id: string;
  username: string;
  phone_number: string;
  display_name: string;
  department_id: string;
  department_name: string;
  department_path: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
  status: 'active' | 'frozen' | 'deleted';
  last_login_at: Date | null;
  published_skill_count: string;
  star_count: string;
}

export type ManagedUserRow = UserRow;

export interface SkillRow {
  skill_id: string;
  display_name: string;
  description: string;
  publisher_name: string;
  department_id: string;
  department_name: string;
  department_path: string;
  category: string | null;
  version: string;
  current_version_risk_level: RiskLevel;
  current_version_review_summary: string | null;
  status: SkillStatus;
  visibility_level: VisibilityLevel;
  star_count: string;
  download_count: string;
  updated_at: Date;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly database: DatabaseService) {}

  loadActor(userID: string): Promise<ActorRow | null> {
    return this.database.one<ActorRow>(
      `
      SELECT
        u.id AS user_id,
        u.username AS display_name,
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
  }

  async loadDepartment(departmentID: string): Promise<{ id: string; path: string; level: number }> {
    const department = await this.database.one<{ id: string; path: string; level: number }>(
      'SELECT id, path, level FROM departments WHERE id = $1',
      [departmentID],
    );
    if (!department) {
      throw new NotFoundException('resource_not_found');
    }
    return department;
  }

  listDepartments(scope: { departmentID: string; departmentPath: string }): Promise<DepartmentRow[]> {
    return this.database.query<DepartmentRow>(
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
        ) AS skill_count,
        (
          SELECT count(*)
          FROM users u
          JOIN departments du ON du.id = u.department_id
          WHERE u.role = 'admin'
            AND u.status = 'active'
            AND (du.id = d.id OR du.path LIKE d.path || '/%')
        ) AS admin_count
      FROM departments d
      WHERE d.id = $1 OR d.path LIKE $2
      ORDER BY d.path ASC
      `,
      [scope.departmentID, `${scope.departmentPath}/%`],
    ).then((result) => result.rows);
  }

  createDepartment(input: {
    departmentID: string;
    parentDepartmentID: string;
    name: string;
    path: string;
    level: number;
  }): Promise<void> {
    return this.database.query(
      `
      INSERT INTO departments (id, parent_id, name, path, level, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      `,
      [input.departmentID, input.parentDepartmentID, input.name, input.path, input.level],
    ).then(() => undefined);
  }

  renameDepartmentTree(currentPath: string, nextPath: string): Promise<void> {
    return this.database.query(
      `
      UPDATE departments
      SET path = $2 || substring(path from char_length($1) + 1)
      WHERE path = $1 OR path LIKE $1 || '/%'
      `,
      [currentPath, nextPath],
    ).then(() => undefined);
  }

  renameDepartmentLabel(departmentID: string, name: string): Promise<void> {
    return this.database.query('UPDATE departments SET name = $2 WHERE id = $1', [departmentID, name]).then(() => undefined);
  }

  async loadDepartmentBlockers(departmentID: string): Promise<{ childCount: number; userCount: number; skillCount: number }> {
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
    return {
      childCount: Number(blockers?.child_count ?? 0),
      userCount: Number(blockers?.user_count ?? 0),
      skillCount: Number(blockers?.skill_count ?? 0),
    };
  }

  deleteDepartment(departmentID: string): Promise<void> {
    return this.database.query('DELETE FROM departments WHERE id = $1', [departmentID]).then(() => undefined);
  }

  listUsers(scope: { departmentID: string; departmentPath: string }): Promise<UserRow[]> {
    return this.database.query<UserRow>(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.phone_number,
        u.username AS display_name,
        u.department_id,
        d.name AS department_name,
        d.path AS department_path,
        u.role,
        u.admin_level,
        u.status,
        (SELECT MAX(session.created_at) FROM auth_sessions session WHERE session.user_id = u.id) AS last_login_at,
        (SELECT count(*) FROM skills s WHERE s.author_id = u.id) AS published_skill_count,
        (SELECT count(*) FROM skill_stars ss WHERE ss.user_id = u.id) AS star_count
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE (d.id = $1 OR d.path LIKE $2)
        AND u.status <> 'deleted'
      ORDER BY d.path ASC, u.username ASC, u.phone_number ASC
      `,
      [scope.departmentID, `${scope.departmentPath}/%`],
    ).then((result) => result.rows);
  }

  createUser(input: {
    userID: string;
    username: string;
    phoneNumber: string;
    passwordHash: string;
    departmentID: string;
    role: 'normal_user' | 'admin';
    adminLevel: number | null;
  }): Promise<void> {
    return this.database.query(
      `
      INSERT INTO users (id, username, phone_number, password_hash, display_name, department_id, role, admin_level, status)
      VALUES ($1, $2, $3, $4, $2, $5, $6, $7, 'active')
      `,
      [
        input.userID,
        input.username,
        input.phoneNumber,
        input.passwordHash,
        input.departmentID,
        input.role,
        input.adminLevel,
      ],
    ).then(() => undefined);
  }

  async loadManagedUserByPhoneNumber(phoneNumber: string): Promise<ManagedUserRow> {
    const target = await this.database.one<ManagedUserRow>(
      `
      SELECT
        u.id AS user_id,
        u.username,
        u.phone_number,
        u.username AS display_name,
        u.department_id,
        d.name AS department_name,
        d.path AS department_path,
        u.role,
        u.admin_level,
        u.status,
        (SELECT MAX(session.created_at) FROM auth_sessions session WHERE session.user_id = u.id) AS last_login_at,
        (SELECT count(*) FROM skills s WHERE s.author_id = u.id) AS published_skill_count,
        (SELECT count(*) FROM skill_stars ss WHERE ss.user_id = u.id) AS star_count
      FROM users u
      JOIN departments d ON d.id = u.department_id
      WHERE u.phone_number = $1
      `,
      [phoneNumber],
    );
    if (!target || target.status === 'deleted') {
      throw new NotFoundException('resource_not_found');
    }
    return target;
  }

  updateUser(input: {
    targetUserID: string;
    username: string | null;
    phoneNumber: string | null;
    departmentID: string | null;
    role: 'normal_user' | 'admin';
    adminLevel: number | null;
  }): Promise<void> {
    return this.database.query(
      `
      UPDATE users
      SET username = COALESCE($2, username),
          phone_number = COALESCE($3, phone_number),
          display_name = COALESCE($2, display_name),
          department_id = COALESCE($4, department_id),
          role = $5,
          admin_level = $6
      WHERE id = $1
      `,
      [
        input.targetUserID,
        input.username,
        input.phoneNumber,
        input.departmentID,
        input.role,
        input.adminLevel,
      ],
    ).then(() => undefined);
  }

  updateUserPassword(input: { targetUserID: string; passwordHash: string }): Promise<void> {
    return this.database.query(
      `
      UPDATE users
      SET password_hash = $2
      WHERE id = $1
      `,
      [input.targetUserID, input.passwordHash],
    ).then(() => undefined);
  }

  async phoneNumberExists(phoneNumber: string, excludedUserID: string | null = null): Promise<boolean> {
    const result = await this.database.one<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM users
        WHERE phone_number = $1
          AND ($2::text IS NULL OR id <> $2)
      ) AS exists
      `,
      [phoneNumber, excludedUserID],
    );
    return result?.exists ?? false;
  }

  setUserStatus(targetUserID: string, status: 'frozen' | 'active' | 'deleted'): Promise<void> {
    return this.database.query('UPDATE users SET status = $2 WHERE id = $1', [targetUserID, status]).then(() => undefined);
  }

  listSkills(scope: { departmentID: string; departmentPath: string }): Promise<SkillRow[]> {
    return this.database.query<SkillRow>(
      `
      SELECT
        s.skill_id,
        s.display_name,
        s.description,
        COALESCE(u.username, '未知发布者') AS publisher_name,
        d.id AS department_id,
        d.name AS department_name,
        d.path AS department_path,
        s.category,
        v.version,
        v.risk_level AS current_version_risk_level,
        v.review_summary AS current_version_review_summary,
        s.status,
        s.visibility_level,
        (SELECT count(*) FROM skill_stars ss WHERE ss.skill_id = s.id) AS star_count,
        (SELECT count(DISTINCT de.user_id) FROM download_events de WHERE de.skill_id = s.id AND de.purpose = 'install') AS download_count,
        s.updated_at
      FROM skills s
      JOIN departments d ON d.id = s.department_id
      JOIN skill_versions v ON v.id = s.current_version_id
      LEFT JOIN users u ON u.id = s.author_id
      WHERE d.id = $1 OR d.path LIKE $2
      ORDER BY s.updated_at DESC
      `,
      [scope.departmentID, `${scope.departmentPath}/%`],
    ).then((result) => result.rows);
  }

  async loadManagedSkill(skillID: string): Promise<SkillRow> {
    const target = await this.database.one<SkillRow>(
      `
      SELECT
        s.skill_id,
        s.display_name,
        s.description,
        COALESCE(u.username, '未知发布者') AS publisher_name,
        d.id AS department_id,
        d.name AS department_name,
        d.path AS department_path,
        s.category,
        v.version,
        v.risk_level AS current_version_risk_level,
        v.review_summary AS current_version_review_summary,
        s.status,
        s.visibility_level,
        (SELECT count(*) FROM skill_stars ss WHERE ss.skill_id = s.id) AS star_count,
        (SELECT count(DISTINCT de.user_id) FROM download_events de WHERE de.skill_id = s.id AND de.purpose = 'install') AS download_count,
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

  updateSkillStatus(skillID: string, status: SkillStatus): Promise<void> {
    return this.database.query(
      'UPDATE skills SET status = $2, updated_at = now() WHERE skill_id = $1',
      [skillID, status],
    ).then(() => undefined);
  }
}
