import { ForbiddenException } from '@nestjs/common';
import { SkillStatus } from '../common/p1-contracts';
import type { ActorRow, ManagedUserRow, SkillRow } from './admin.repository';

export interface ActorContext {
  userID: string;
  displayName: string;
  role: 'normal_user' | 'admin';
  adminLevel: number;
  departmentID: string;
  departmentName: string;
  departmentPath: string;
}

export function assertAdminActor(actor: ActorRow | null): ActorContext {
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

export function isWithinScope(targetPath: string, actorPath: string, includeSelf = false): boolean {
  return includeSelf
    ? targetPath === actorPath || targetPath.startsWith(`${actorPath}/`)
    : targetPath.startsWith(`${actorPath}/`);
}

export function assertAssignableRole(
  actor: ActorContext,
  nextRole: 'normal_user' | 'admin',
  nextAdminLevel: number | null,
  updatingSelf = false,
): void {
  if (nextRole === 'normal_user') {
    return;
  }
  if (nextAdminLevel === null || nextAdminLevel <= actor.adminLevel || updatingSelf) {
    throw new ForbiddenException('permission_denied');
  }
}

export function assertManagedUser(actor: ActorContext, target: ManagedUserRow): void {
  if (!isWithinScope(target.department_path, actor.departmentPath, true)) {
    throw new ForbiddenException('permission_denied');
  }
  if (target.role === 'admin' && target.admin_level !== null && target.admin_level <= actor.adminLevel) {
    throw new ForbiddenException('permission_denied');
  }
}

export function assertSkillStatusPermission(
  actor: ActorContext,
  target: SkillRow,
  nextStatus: SkillStatus,
): void {
  const withinScope = isWithinScope(target.department_path, actor.departmentPath, true);
  if (withinScope) {
    return;
  }

  const canCrossDepartmentDelist =
    actor.adminLevel === 1 &&
    nextStatus === 'delisted' &&
    target.visibility_level === 'public_installable';
  if (!canCrossDepartmentDelist) {
    throw new ForbiddenException('permission_denied');
  }
}
