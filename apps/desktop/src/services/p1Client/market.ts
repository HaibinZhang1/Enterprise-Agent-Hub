import type { DownloadTicket, MarketFilters, SkillSummary } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { requestJSON, resolveAPIURL, routePath } from "./core.ts";
import type { ApiPage, ApiSkill } from "./shared.ts";
import { buildSkillListQuery, normalizeSkill } from "./shared.ts";

export function createMarketClient() {
  return {
    async listSkills(filters: MarketFilters): Promise<SkillSummary[]> {
      const response = await requestJSON<ApiPage<ApiSkill>>(`${P1_API_ROUTES.skills}?${buildSkillListQuery(filters).toString()}`);
      return response.items.map(normalizeSkill);
    },

    async getSkill(skillID: string): Promise<SkillSummary> {
      return normalizeSkill(await requestJSON<ApiSkill>(routePath(P1_API_ROUTES.skillDetail, { skillID })));
    },

    async downloadTicket(skill: SkillSummary, purpose: "install" | "update"): Promise<DownloadTicket> {
      const response = await requestJSON<DownloadTicket>(routePath(P1_API_ROUTES.skillDownloadTicket, { skillID: skill.skillID }), {
        method: "POST",
        body: JSON.stringify({
          purpose,
          targetVersion: skill.version,
          localVersion: skill.localVersion
        })
      });
      return {
        ...response,
        packageURL: resolveAPIURL(response.packageURL)
      };
    },

    async star(skillID: string, starred: boolean): Promise<{ skillID: string; starred: boolean; starCount: number }> {
      return requestJSON(routePath(P1_API_ROUTES.skillStar, { skillID }), { method: starred ? "POST" : "DELETE" });
    },
  };
}
