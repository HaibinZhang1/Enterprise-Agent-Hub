import { Injectable } from '@nestjs/common';
import { AdminSkillDto, AdminUserDto, DepartmentNodeDto } from '../common/p1-contracts';
import { AdminReadService } from './admin-read.service';
import { AdminWriteService } from './admin-write.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly readService: AdminReadService,
    private readonly writeService: AdminWriteService,
  ) {}

  listDepartments(userID: string): Promise<DepartmentNodeDto[]> {
    return this.readService.listDepartments(userID);
  }

  async createDepartment(
    userID: string,
    input: { parentDepartmentID?: string; name?: string },
  ): Promise<DepartmentNodeDto[]> {
    await this.writeService.createDepartment(userID, input);
    return this.readService.listDepartments(userID);
  }

  async updateDepartment(
    userID: string,
    departmentID: string,
    input: { name?: string },
  ): Promise<DepartmentNodeDto[]> {
    await this.writeService.updateDepartment(userID, departmentID, input);
    return this.readService.listDepartments(userID);
  }

  async deleteDepartment(userID: string, departmentID: string): Promise<{ ok: true }> {
    await this.writeService.deleteDepartment(userID, departmentID);
    return { ok: true };
  }

  listUsers(userID: string): Promise<AdminUserDto[]> {
    return this.readService.listUsers(userID);
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
    await this.writeService.createUser(userID, input);
    return this.readService.listUsers(userID);
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
    await this.writeService.updateUser(userID, targetUserID, input);
    return this.readService.listUsers(userID);
  }

  async freezeUser(
    userID: string,
    targetUserID: string,
    nextStatus: 'frozen' | 'active',
  ): Promise<AdminUserDto[]> {
    await this.writeService.freezeUser(userID, targetUserID, nextStatus);
    return this.readService.listUsers(userID);
  }

  async deleteUser(userID: string, targetUserID: string): Promise<{ ok: true }> {
    await this.writeService.deleteUser(userID, targetUserID);
    return { ok: true };
  }

  listSkills(userID: string): Promise<AdminSkillDto[]> {
    return this.readService.listSkills(userID);
  }

  async setSkillStatus(
    userID: string,
    skillID: string,
    nextStatus: 'delisted' | 'published' | 'archived',
  ): Promise<AdminSkillDto[]> {
    await this.writeService.setSkillStatus(userID, skillID, nextStatus);
    return this.readService.listSkills(userID);
  }
}
