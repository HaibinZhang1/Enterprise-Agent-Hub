import type { AdminSkill, AdminUser, DepartmentNode, RiskLevel } from "../../domain/p1.ts";

export type AdminUserRoleFilter = "all" | "admin" | "normal_user";
export type AdminUserStatusFilter = "all" | AdminUser["status"];

export interface AdminUserFilters {
  query: string;
  role: AdminUserRoleFilter;
  status: AdminUserStatusFilter;
}

export interface DepartmentTreeRow {
  department: DepartmentNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface DepartmentWorkbenchProjection {
  selectedDepartment: DepartmentNode | null;
  visibleRows: DepartmentTreeRow[];
  childDepartments: DepartmentNode[];
  scopedUsers: AdminUser[];
  scopedAdmins: AdminUser[];
  scopedSkills: AdminSkill[];
  departmentIDsInScope: Set<string>;
}

type AdminSkillWorkbenchFields = AdminSkill & {
  description?: string | null;
  category?: string | null;
  currentVersionRiskLevel?: RiskLevel | null;
  currentVersionReviewSummary?: string | null;
};

type DepartmentWorkbenchFields = DepartmentNode & {
  adminCount?: number | null;
};

type AdminUserWorkbenchFields = AdminUser & {
  departmentPath?: string | null;
  lastLoginAt?: string | null;
};

export function getAdminSkillDescription(skill: AdminSkill): string {
  return (skill as AdminSkillWorkbenchFields).description?.trim() || "暂无说明，等待发布者补充 Skill 描述。";
}

export function getAdminSkillCategory(skill: AdminSkill): string {
  return (skill as AdminSkillWorkbenchFields).category?.trim() || "未分类";
}

export function getAdminSkillRiskLevel(skill: AdminSkill): RiskLevel {
  return (skill as AdminSkillWorkbenchFields).currentVersionRiskLevel ?? "unknown";
}

export function getAdminSkillReviewSummary(skill: AdminSkill): string {
  return (skill as AdminSkillWorkbenchFields).currentVersionReviewSummary?.trim() || "当前版本暂无审核摘要。";
}

export function getAdminUserDepartmentPath(user: AdminUser): string {
  return (user as AdminUserWorkbenchFields).departmentPath?.trim() || user.departmentName;
}

export function getAdminUserLastLoginAt(user: AdminUser): string | null {
  return (user as AdminUserWorkbenchFields).lastLoginAt ?? null;
}

export function getDepartmentAdminCount(department: DepartmentNode, users: AdminUser[] = []): number {
  const explicitCount = (department as DepartmentWorkbenchFields).adminCount;
  if (typeof explicitCount === "number") return explicitCount;
  return users.filter((user) => user.departmentID === department.departmentID && user.role === "admin").length;
}

export function collectDepartmentIDs(department: DepartmentNode | null): Set<string> {
  const ids = new Set<string>();
  const visit = (node: DepartmentNode) => {
    ids.add(node.departmentID);
    node.children.forEach(visit);
  };
  if (department) visit(department);
  return ids;
}

export function flattenDepartmentTree(departments: DepartmentNode[], expandedDepartmentIDs: Set<string>): DepartmentTreeRow[] {
  const rows: DepartmentTreeRow[] = [];
  const visit = (department: DepartmentNode, depth: number) => {
    const hasChildren = department.children.length > 0;
    const expanded = expandedDepartmentIDs.has(department.departmentID);
    rows.push({ department, depth, hasChildren, expanded });
    if (expanded) {
      department.children.forEach((child) => visit(child, depth + 1));
    }
  };
  departments.forEach((department) => visit(department, 0));
  return rows;
}

export function findDepartmentNode(departments: DepartmentNode[], departmentID: string | null): DepartmentNode | null {
  if (!departmentID) return null;
  for (const department of departments) {
    if (department.departmentID === departmentID) return department;
    const childMatch = findDepartmentNode(department.children, departmentID);
    if (childMatch) return childMatch;
  }
  return null;
}

export function deriveDepartmentWorkbench(input: {
  departments: DepartmentNode[];
  users: AdminUser[];
  skills: AdminSkill[];
  selectedDepartmentID: string | null;
  expandedDepartmentIDs: Set<string>;
}): DepartmentWorkbenchProjection {
  const selectedDepartment = findDepartmentNode(input.departments, input.selectedDepartmentID) ?? input.departments[0] ?? null;
  const departmentIDsInScope = collectDepartmentIDs(selectedDepartment);
  const scopedUsers = input.users.filter((user) => departmentIDsInScope.has(user.departmentID));
  return {
    selectedDepartment,
    visibleRows: flattenDepartmentTree(input.departments, input.expandedDepartmentIDs),
    childDepartments: selectedDepartment?.children ?? [],
    scopedUsers,
    scopedAdmins: scopedUsers.filter((user) => user.role === "admin"),
    scopedSkills: input.skills.filter((skill) => departmentIDsInScope.has(skill.departmentID)),
    departmentIDsInScope
  };
}

export function filterAdminUsers(users: AdminUser[], filters: AdminUserFilters): AdminUser[] {
  const query = filters.query.trim().toLowerCase();
  return users.filter((user) => {
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.status !== "all" && user.status !== filters.status) return false;
    if (!query) return true;
    const searchable = [
      user.username,
      user.phoneNumber,
      user.departmentName,
      getAdminUserDepartmentPath(user),
      user.role === "admin" ? `admin l${user.adminLevel ?? ""}` : "normal user"
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(query);
  });
}
