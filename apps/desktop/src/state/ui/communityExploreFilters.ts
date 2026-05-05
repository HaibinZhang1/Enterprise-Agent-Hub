import type { MarketFilters } from "../../domain/p1.ts";
import { defaultFilters } from "../workspace/workspaceTypes.ts";

export function buildCommunityExploreFilters(query: string): MarketFilters {
  const trimmedQuery = query.trim();
  return {
    ...defaultFilters,
    query: trimmedQuery,
    sort: trimmedQuery.length > 0 ? "relevance" : "composite"
  };
}
