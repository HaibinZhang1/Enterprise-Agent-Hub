import type { SkillLeaderboardItem, SkillLeaderboardsResponse, SkillSummary } from "../../domain/p1.ts";

export const COMMUNITY_LEADERBOARD_LIMIT = 10;
type CommunityLeaderboardMetric = "downloadCount" | "starCount";

function toLeaderboardItem(skill: SkillSummary): SkillLeaderboardItem {
  return {
    ...skill,
    recentStarCount: 0,
    recentDownloadCount: 0,
    hotScore: 0
  };
}

function buildCommunityLeaderboard(skills: SkillSummary[], primaryMetric: CommunityLeaderboardMetric, limit: number): SkillLeaderboardItem[] {
  const secondaryMetric: CommunityLeaderboardMetric = primaryMetric === "downloadCount" ? "starCount" : "downloadCount";
  return [...skills]
    .sort((left, right) => {
      const primaryDelta = right[primaryMetric] - left[primaryMetric];
      if (primaryDelta !== 0) return primaryDelta;
      const secondaryDelta = right[secondaryMetric] - left[secondaryMetric];
      if (secondaryDelta !== 0) return secondaryDelta;
      return left.displayName.localeCompare(right.displayName, "zh-Hans-CN");
    })
    .slice(0, limit)
    .map(toLeaderboardItem);
}

export function deriveCommunityLeaderboards(skills: SkillSummary[], limit = COMMUNITY_LEADERBOARD_LIMIT): Pick<SkillLeaderboardsResponse, "hot" | "stars" | "downloads"> {
  return {
    hot: [],
    downloads: buildCommunityLeaderboard(skills, "downloadCount", limit),
    stars: buildCommunityLeaderboard(skills, "starCount", limit)
  };
}
