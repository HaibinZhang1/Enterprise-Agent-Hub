import { Injectable } from '@nestjs/common';
import { AdminSkillDto, AdminUserDto, DepartmentNodeDto } from '../common/p1-contracts';
import { buildDepartmentTree, toAdminSkill, toAdminUser } from './admin-mappers';
import { AdminRepository } from './admin.repository';
import { assertAdminActor } from './admin-scope.policy';

@Injectable()
export class AdminReadService {
  constructor(private readonly repository: AdminRepository) {}

  async listDepartments(userID: string): Promise<DepartmentNodeDto[]> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    return buildDepartmentTree(
      await this.repository.listDepartments({
        departmentID: actor.departmentID,
        departmentPath: actor.departmentPath,
      }),
    );
  }

  async listUsers(userID: string): Promise<AdminUserDto[]> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    return (
      await this.repository.listUsers({
        departmentID: actor.departmentID,
        departmentPath: actor.departmentPath,
      })
    ).map(toAdminUser);
  }

  async listSkills(userID: string): Promise<AdminSkillDto[]> {
    const actor = assertAdminActor(await this.repository.loadActor(userID));
    return (
      await this.repository.listSkills({
        departmentID: actor.departmentID,
        departmentPath: actor.departmentPath,
      })
    ).map(toAdminSkill);
  }
}
