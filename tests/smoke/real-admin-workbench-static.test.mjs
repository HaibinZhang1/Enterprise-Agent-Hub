import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const sharedContracts = read('packages/shared-contracts/src/index.ts');
const apiContracts = read('apps/api/src/common/p1-contracts.ts');
const desktopDomain = read('apps/desktop/src/domain/p1.ts');
const adminRepository = read('apps/api/src/admin/admin.repository.ts');
const adminMappers = read('apps/api/src/admin/admin-mappers.ts');
const adminWriteService = read('apps/api/src/admin/admin-write.service.ts');
const skillStatus = read('apps/api/src/admin/skill-status.ts');
const desktopSections = read('apps/desktop/src/ui/desktopSections.tsx');

function interfaceBody(source, name) {
  const match = source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `expected interface ${name} to exist`);
  return match[1];
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `expected function ${name} to exist`);
  const nextExport = source.indexOf('\nexport function', start + 1);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  const candidates = [nextExport, nextFunction].filter((index) => index !== -1);
  const end = candidates.length === 0 ? source.length : Math.min(...candidates);
  return source.slice(start, end);
}

test('real admin workbench contracts expose the approved DTO increments', () => {
  const department = interfaceBody(sharedContracts, 'DepartmentNode');
  const user = interfaceBody(sharedContracts, 'AdminUser');
  const skill = interfaceBody(sharedContracts, 'AdminSkill');

  assert.match(department, /readonly adminCount:\s*number;/);
  assert.doesNotMatch(user, /readonly userID:/);
  assert.match(user, /readonly departmentPath:\s*string;/);
  assert.match(user, /readonly phoneNumber:\s*string;/);
  assert.match(user, /readonly lastLoginAt:\s*ISODateTimeString\s*\|\s*null;/);
  assert.match(skill, /readonly description:\s*string;/);
  assert.match(skill, /readonly category:\s*string\s*\|\s*null;/);
  assert.match(skill, /readonly currentVersionRiskLevel:\s*RiskLevel;/);
  assert.match(skill, /readonly currentVersionReviewSummary:\s*string\s*\|\s*null;/);

  assert.match(apiContracts, /DepartmentNodeDto = MutableDeep<SharedDepartmentNodeDto>/);
  assert.match(apiContracts, /AdminUserDto = MutableDeep<SharedAdminUserDto>/);
  assert.match(apiContracts, /AdminSkillDto = MutableDeep<SharedAdminSkillDto>/);
  assert.match(desktopDomain, /DepartmentNode = MutableDeep<SharedDepartmentNode>/);
  assert.match(desktopDomain, /AdminUser = MutableDeep<SharedAdminUser>/);
  assert.match(desktopDomain, /AdminSkill = MutableDeep<SharedAdminSkill>/);
});

test('real admin workbench read queries and mappers populate enriched fields from real data', () => {
  assert.match(adminRepository, /admin_count/);
  assert.match(adminRepository, /u\.role\s*=\s*'admin'/);
  assert.match(adminRepository, /d\.path AS department_path/);
  assert.match(adminRepository, /auth_sessions/);
  assert.match(adminRepository, /MAX\(session\.created_at\)/);
  assert.match(adminRepository, /AS last_login_at/);
  assert.match(adminRepository, /s\.description/);
  assert.match(adminRepository, /s\.category/);
  assert.match(adminRepository, /current_version_risk_level/);
  assert.match(adminRepository, /current_version_review_summary/);

  assert.match(adminMappers, /adminCount:\s*Number\(row\.admin_count\)/);
  assert.match(adminMappers, /departmentPath:\s*row\.department_path/);
  assert.match(adminMappers, /lastLoginAt:\s*toIsoDateTime\(row\.last_login_at\)/);
  assert.match(adminMappers, /description:\s*row\.description/);
  assert.match(adminMappers, /category:\s*row\.category/);
  assert.match(adminMappers, /currentVersionRiskLevel:\s*row\.current_version_risk_level/);
  assert.match(adminMappers, /currentVersionReviewSummary:\s*row\.current_version_review_summary/);
});

test('real admin workbench write paths preserve existing governance safeguards', () => {
  assert.match(adminWriteService, /createDepartment[\s\S]*isWithinScope\(parent\.path, actor\.departmentPath, true\)/);
  assert.match(adminWriteService, /updateDepartment[\s\S]*target\.id === actor\.departmentID/);
  assert.match(adminWriteService, /deleteDepartment[\s\S]*loadDepartmentBlockers/);
  assert.match(adminWriteService, /createUser[\s\S]*assertAssignableRole/);
  assert.match(adminWriteService, /updateUser[\s\S]*assertManagedUser/);
  assert.match(adminWriteService, /freezeUser[\s\S]*revokeAllSessionsForUser/);
  assert.match(adminWriteService, /deleteUser[\s\S]*loadManagedUserByPhoneNumber[\s\S]*setUserStatus\(target\.user_id, 'deleted'\)[\s\S]*revokeAllSessionsForUser/);
  assert.match(adminWriteService, /setSkillStatus[\s\S]*assertSkillStatusPermission[\s\S]*assertSkillStatusTransition/);
  assert.match(skillStatus, /nextStatus === 'published' && currentStatus !== 'delisted'/);
  assert.match(skillStatus, /nextStatus === 'delisted' && currentStatus !== 'published'/);
  assert.match(skillStatus, /nextStatus === 'archived' && currentStatus === 'archived'/);
});

test('real admin skills pane uses a list plus enriched right-side summary backed by AdminSkill', () => {
  const pane = functionBody(desktopSections, 'ManageSkillsPane');
  const adminSkillHelper = functionBody(desktopSections, 'adminSkillView');

  assert.match(pane, /manage-pane-grid/);
  assert.match(pane, /selectedSkill/);
  assert.match(pane, /adminSkillView\(selectedSkill/);
  assert.match(pane, /getAdminSkillDescription\(skill\)/);
  assert.match(pane, /getAdminSkillCategory\(skill\)/);
  assert.match(adminSkillHelper, /getAdminSkillRiskLevel\(skill\)/);
  assert.match(adminSkillHelper, /getAdminSkillReviewSummary\(skill\)/);
  assert.match(pane, /delistAdminSkill\(selectedSkill\.skillID\)/);
  assert.match(pane, /relistAdminSkill\(selectedSkill\.skillID\)/);
  assert.match(pane, /archiveAdminSkill\(selectedSkill\.skillID\)/);
});

test('real admin users pane separates searchable governance from create-user flow', () => {
  const pane = functionBody(desktopSections, 'ManageUsersPane');

  assert.match(pane, /search|Search|搜索|query/i);
  assert.match(pane, /roleFilter|角色筛选|filterRole|selectedRole/i);
  assert.match(pane, /statusFilter|状态筛选|filterStatus|selectedStatus/i);
  assert.match(pane, /selectedUser/);
  assert.match(pane, /getAdminUserDepartmentPath\(selectedUser\)/);
  assert.match(pane, /getAdminUserLastLoginAt\(selectedUser\)/);
  assert.match(pane, /createAdminUser/);
  assert.match(pane, /updateAdminUser\(selectedUser\.phoneNumber/);
  assert.match(pane, /changeAdminUserPassword\(selectedUser\.phoneNumber/);
  assert.match(pane, /freezeAdminUser\(selectedUser\.phoneNumber\)/);
  assert.match(pane, /unfreezeAdminUser\(selectedUser\.phoneNumber\)/);
  assert.match(pane, /deleteAdminUser\(selectedUser\.phoneNumber\)/);
});

test('real admin departments pane makes the tree the primary surface and projects real datasets', () => {
  const pane = functionBody(desktopSections, 'ManageDepartmentsPane');

  assert.match(pane, /expanded|collapse|折叠|展开/i);
  assert.match(pane, /hasChildren|childDepartments/);
  assert.doesNotMatch(pane, /flattenDepartments\(workspace\.adminData\.departments\)\.map\(\(department\)/);
  assert.match(pane, /selectedDepartment/);
  assert.match(pane, /getDepartmentAdminCount\(row\.department/);
  assert.match(pane, /workspace\.adminData\.adminUsers/);
  assert.match(pane, /workspace\.adminData\.adminSkills/);
  assert.match(pane, /createDepartment\(createParentDepartment\.departmentID/);
  assert.match(pane, /updateDepartment\(selectedDepartment\.departmentID/);
  assert.match(pane, /deleteDepartment\(selectedDepartment\.departmentID\)/);
});
