import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { normalizePhoneNumber } from '../auth/phone-number';
import { INITIAL_PASSWORD, hashPassword, validatePasswordStrength } from '../auth/password';
import { AdminRepository } from './admin.repository';
import {
  assertAdminActor,
  assertAssignableRole,
  assertManagedUser,
  assertSkillStatusPermission,
  isWithinScope,
} from './admin-scope.policy';
import { assertSkillStatusTransition } from './skill-status';

@Injectable()
export class AdminWriteService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly authService: AuthService,
  ) {}

  async createDepartment(
    userID: string,
    input: { parentDepartmentID?: string; name?: string },
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const name = input.name?.trim();
    if (!name || !input.parentDepartmentID) {
      throw new BadRequestException('validation_failed');
    }

    const parent = await this.repository.loadDepartment(input.parentDepartmentID);
    if (!isWithinScope(parent.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    await this.repository.createDepartment({
      departmentID: `dept_${randomBytes(6).toString('hex')}`,
      parentDepartmentID: parent.id,
      name,
      path: `${parent.path}/${name}`,
      level: parent.level + 1,
    });
  }

  async updateDepartment(
    userID: string,
    departmentID: string,
    input: { name?: string },
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('validation_failed');
    }

    const target = await this.repository.loadDepartment(departmentID);
    const canRenameOwnRootDepartment =
      target.id === actor.departmentID && actor.adminLevel === 1 && target.level === 0;
    if (
      (!isWithinScope(target.path, actor.departmentPath) && !canRenameOwnRootDepartment) ||
      (target.id === actor.departmentID && !canRenameOwnRootDepartment)
    ) {
      throw new ForbiddenException('permission_denied');
    }

    const nextPath = `${target.path.split('/').slice(0, -1).join('/')}/${name}`;
    await this.repository.renameDepartmentTree(target.path, nextPath);
    await this.repository.renameDepartmentLabel(departmentID, name);
  }

  async deleteDepartment(userID: string, departmentID: string): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const target = await this.repository.loadDepartment(departmentID);
    if (!isWithinScope(target.path, actor.departmentPath) || target.id === actor.departmentID) {
      throw new ForbiddenException('permission_denied');
    }

    const blockers = await this.repository.loadDepartmentBlockers(departmentID);
    if (blockers.childCount > 0 || blockers.userCount > 0 || blockers.skillCount > 0) {
      throw new BadRequestException('validation_failed');
    }

    await this.repository.deleteDepartment(departmentID);
  }

  async createUser(
    userID: string,
    input: {
      username?: string;
      phoneNumber?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const username = input.username?.trim();
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);
    if (!username || !input.departmentID || !input.role) {
      throw new BadRequestException('validation_failed');
    }
    if (await this.repository.phoneNumberExists(phoneNumber)) {
      throw new BadRequestException('phone_number_already_exists');
    }

    const department = await this.repository.loadDepartment(input.departmentID);
    if (!isWithinScope(department.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    const normalizedRole = input.role;
    const normalizedAdminLevel = normalizedRole === 'admin' ? input.adminLevel ?? null : null;
    assertAssignableRole(actor, normalizedRole, normalizedAdminLevel);

    await this.repository.createUser({
      userID: `u_${randomBytes(6).toString('hex')}`,
      username,
      phoneNumber,
      passwordHash: hashPassword(INITIAL_PASSWORD),
      departmentID: department.id,
      role: normalizedRole,
      adminLevel: normalizedAdminLevel,
    });
  }

  async updateUser(
    userID: string,
    targetUserID: string,
    input: {
      username?: string;
      phoneNumber?: string;
      departmentID?: string;
      role?: 'normal_user' | 'admin';
      adminLevel?: number | null;
    },
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const targetPhoneNumber = normalizePhoneNumber(targetUserID);
    const target = await this.repository.loadManagedUserByPhoneNumber(targetPhoneNumber);
    assertManagedUser(actor, target);

    const nextDepartment = input.departmentID ? await this.repository.loadDepartment(input.departmentID) : null;
    if (nextDepartment && !isWithinScope(nextDepartment.path, actor.departmentPath, true)) {
      throw new ForbiddenException('permission_denied');
    }

    const nextRole = input.role ?? target.role;
    const nextAdminLevel = nextRole === 'admin' ? (input.adminLevel ?? target.admin_level ?? null) : null;
    assertAssignableRole(actor, nextRole, nextAdminLevel, target.user_id === actor.userID);
    const nextUsername = input.username?.trim() || null;
    const nextPhoneNumber = input.phoneNumber === undefined ? null : normalizePhoneNumber(input.phoneNumber);
    if (nextPhoneNumber && await this.repository.phoneNumberExists(nextPhoneNumber, target.user_id)) {
      throw new BadRequestException('phone_number_already_exists');
    }

    await this.repository.updateUser({
      targetUserID: target.user_id,
      username: nextUsername,
      phoneNumber: nextPhoneNumber,
      departmentID: nextDepartment?.id ?? null,
      role: nextRole,
      adminLevel: nextAdminLevel,
    });
  }

  async changeUserPassword(
    userID: string,
    targetUserID: string,
    input: { password?: string },
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const target = await this.repository.loadManagedUserByPhoneNumber(normalizePhoneNumber(targetUserID));
    assertManagedUser(actor, target);

    const password = input.password?.trim();
    if (!password) {
      throw new BadRequestException('validation_failed');
    }
    const validationMessage = validatePasswordStrength(password);
    if (validationMessage) {
      throw new BadRequestException(validationMessage);
    }

    await this.repository.updateUserPassword({
      targetUserID: target.user_id,
      passwordHash: hashPassword(password),
    });
    await this.authService.revokeAllSessionsForUser(target.user_id);
  }

  async freezeUser(
    userID: string,
    targetUserID: string,
    nextStatus: 'frozen' | 'active',
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const target = await this.repository.loadManagedUserByPhoneNumber(normalizePhoneNumber(targetUserID));
    assertManagedUser(actor, target);
    if (target.user_id === actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    await this.repository.setUserStatus(target.user_id, nextStatus);
    if (nextStatus === 'frozen') {
      await this.authService.revokeAllSessionsForUser(target.user_id);
    }
  }

  async deleteUser(userID: string, targetUserID: string): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const target = await this.repository.loadManagedUserByPhoneNumber(normalizePhoneNumber(targetUserID));
    assertManagedUser(actor, target);
    if (target.user_id === actor.userID) {
      throw new ForbiddenException('permission_denied');
    }

    await this.repository.setUserStatus(target.user_id, 'deleted');
    await this.authService.revokeAllSessionsForUser(target.user_id);
  }

  async setSkillStatus(
    userID: string,
    skillID: string,
    nextStatus: 'delisted' | 'published' | 'archived',
  ): Promise<void> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    const target = await this.repository.loadManagedSkill(skillID);
    assertSkillStatusPermission(actor, target, nextStatus);
    assertSkillStatusTransition(target.status, nextStatus);
    await this.repository.updateSkillStatus(skillID, nextStatus);
  }
}
