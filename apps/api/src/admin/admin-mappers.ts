import { AdminSkillDto, AdminUserDto, DepartmentNodeDto } from '../common/p1-contracts';
import type { DepartmentRow, SkillRow, UserRow } from './admin.repository';

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

export function toAdminSkill(row: SkillRow): AdminSkillDto {
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
