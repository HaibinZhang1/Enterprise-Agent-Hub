import type { AdminSkill, AdminUser, DepartmentNode } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON, routePath } from "./core.ts";

export function createAdminClient() {
  return {
    async listDepartments(): Promise<DepartmentNode[]> {
      return requestJSON<DepartmentNode[]>(P1_API_ROUTES.adminDepartments);
    },

    async createDepartment(input: { parentDepartmentID: string; name: string }): Promise<DepartmentNode[]> {
      return requestJSON<DepartmentNode[]>(P1_API_ROUTES.adminDepartments, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },

    async updateDepartment(departmentID: string, input: { name: string }): Promise<DepartmentNode[]> {
      return requestJSON<DepartmentNode[]>(routePath(P1_API_ROUTES.adminDepartmentDetail, { departmentID }), {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },

    async deleteDepartment(departmentID: string): Promise<void> {
      await requestJSON<{ ok: true }>(routePath(P1_API_ROUTES.adminDepartmentDetail, { departmentID }), {
        method: "DELETE"
      });
    },

    async listAdminUsers(): Promise<AdminUser[]> {
      return requestJSON<AdminUser[]>(P1_API_ROUTES.adminUsers);
    },

    async createAdminUser(input: { username: string; password: string; displayName: string; departmentID: string; role: "normal_user" | "admin"; adminLevel: number | null }): Promise<AdminUser[]> {
      return requestJSON<AdminUser[]>(P1_API_ROUTES.adminUsers, {
        method: "POST",
        body: JSON.stringify(input)
      });
    },

    async updateAdminUser(targetUserID: string, input: { displayName?: string; departmentID?: string; role?: "normal_user" | "admin"; adminLevel?: number | null }): Promise<AdminUser[]> {
      return requestJSON<AdminUser[]>(routePath(P1_API_ROUTES.adminUserDetail, { targetUserID }), {
        method: "PATCH",
        body: JSON.stringify(input)
      });
    },

    async freezeAdminUser(targetUserID: string): Promise<AdminUser[]> {
      return requestJSON<AdminUser[]>(routePath(P1_API_ROUTES.adminUserFreeze, { targetUserID }), {
        method: "POST"
      });
    },

    async unfreezeAdminUser(targetUserID: string): Promise<AdminUser[]> {
      return requestJSON<AdminUser[]>(routePath(P1_API_ROUTES.adminUserUnfreeze, { targetUserID }), {
        method: "POST"
      });
    },

    async deleteAdminUser(targetUserID: string): Promise<void> {
      await requestJSON<{ ok: true }>(routePath(P1_API_ROUTES.adminUserDetail, { targetUserID }), {
        method: "DELETE"
      });
    },

    async listAdminSkills(): Promise<AdminSkill[]> {
      return requestJSON<AdminSkill[]>(P1_API_ROUTES.adminSkills);
    },

    async delistAdminSkill(skillID: string): Promise<AdminSkill[]> {
      return requestJSON<AdminSkill[]>(routePath(P1_API_ROUTES.adminSkillDelist, { skillID }), {
        method: "POST"
      });
    },

    async relistAdminSkill(skillID: string): Promise<AdminSkill[]> {
      return requestJSON<AdminSkill[]>(routePath(P1_API_ROUTES.adminSkillRelist, { skillID }), {
        method: "POST"
      });
    },

    async archiveAdminSkill(skillID: string): Promise<void> {
      await requestJSON<{ ok: true }>(routePath(P1_API_ROUTES.adminSkillArchive, { skillID }), {
        method: "DELETE"
      });
    },
  };
}
