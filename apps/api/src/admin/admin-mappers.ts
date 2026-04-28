import { AdminSkillDto, AdminUserDto, DepartmentNodeDto } from '../common/p1-contracts';
import type { DepartmentRow, SkillRow, UserRow } from './admin.repository';

function toIsoDateTime(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildDepartmentTree(rows: DepartmentRow[]): DepartmentNodeDto[] {
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
      adminCount: Number(row.admin_count),
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

export function toAdminUser(row: UserRow): AdminUserDto {
  return {
    username: row.username,
    phoneNumber: row.phone_number,
    departmentID: row.department_id,
    departmentName: row.department_name,
    departmentPath: row.department_path,
    role: row.role,
    adminLevel: row.admin_level,
    status: row.status,
    passwordMustChange: row.password_must_change,
    lastLoginAt: toIsoDateTime(row.last_login_at),
    publishedSkillCount: Number(row.published_skill_count),
    starCount: Number(row.star_count),
  };
}

export function toAdminSkill(row: SkillRow): AdminSkillDto {
  return {
    skillID: row.skill_id,
    displayName: row.display_name,
    description: row.description,
    publisherName: row.publisher_name,
    departmentID: row.department_id,
    departmentName: row.department_name,
    category: row.category,
    version: row.version,
    currentVersionRiskLevel: row.current_version_risk_level,
    currentVersionReviewSummary: row.current_version_review_summary,
    status: row.status,
    visibilityLevel: row.visibility_level,
    starCount: Number(row.star_count),
    downloadCount: Number(row.download_count),
    updatedAt: toIsoDateTime(row.updated_at)!,
  };
}
