import type {
  AuthState,
  BootstrapContext,
  DepartmentNode,
  LocalNotification,
  MarketFilters,
  ScanTargetSummary,
  SkillSummary
} from "../../domain/p1.ts";
import { SKILL_CATEGORIES, SKILL_TAGS } from "../../domain/p1.ts";
import { isCommunityVisibleSkill } from "../p1WorkspaceHelpers.ts";
import { deriveDiscoveredLocalSkills } from "../../utils/discoveredLocalSkills.ts";
import { guestNavigation } from "./workspaceTypes.ts";

const adminNavigationPages = ["review", "admin_departments", "admin_users", "admin_skills"] as const;

export function deriveVisibleNavigation(input: {
  authState: AuthState;
  bootstrap: BootstrapContext;
}) {
  const { authState, bootstrap } = input;
  const visibleNavigation = (authState === "authenticated" ? bootstrap.navigation : guestNavigation).filter((page) => page !== "notifications");

  if (authState !== "authenticated") {
    return visibleNavigation;
  }

  if (!bootstrap.features.publishSkill || visibleNavigation.includes("publisher")) {
    return visibleNavigation;
  }

  const myInstalledIndex = visibleNavigation.indexOf("my_installed");
  if (myInstalledIndex >= 0) {
    visibleNavigation.splice(myInstalledIndex + 1, 0, "publisher");
    return visibleNavigation;
  }

  visibleNavigation.push("publisher");
  return visibleNavigation;
}

function findDepartment(nodes: DepartmentNode[], departmentID: string | null): DepartmentNode | null {
  if (!departmentID) return null;
  for (const node of nodes) {
    if (node.departmentID === departmentID) return node;
    const match = findDepartment(node.children, departmentID);
    if (match) return match;
  }
  return null;
}

export function deriveMarketSkills(input: {
  authState: AuthState;
  bootstrap: BootstrapContext;
  filters: MarketFilters;
  skills: SkillSummary[];
}): SkillSummary[] {
  const { filters, skills } = input;
  const communitySkills = skills.filter(isCommunityVisibleSkill);
  const query = filters.query.trim().toLocaleLowerCase();
  const publishedWindowDays = filters.publishedWithin === "7d" ? 7 : filters.publishedWithin === "30d" ? 30 : filters.publishedWithin === "90d" ? 90 : 0;
  const updatedWindowDays = filters.updatedWithin === "7d" ? 7 : filters.updatedWithin === "30d" ? 30 : filters.updatedWithin === "90d" ? 90 : 0;

  function relevanceScore(skill: SkillSummary) {
    if (query.length === 0) return 0;
    let score = 0;
    if (skill.displayName.toLocaleLowerCase().includes(query)) score += 4;
    if (skill.skillID.toLocaleLowerCase().includes(query)) score += 3;
    if (skill.tags.some((tag) => tag.toLocaleLowerCase().includes(query))) score += 2;
    if (skill.category.toLocaleLowerCase().includes(query)) score += 2;
    if (skill.description.toLocaleLowerCase().includes(query)) score += 1;
    return score;
  }

  const filtered = [...communitySkills].filter((skill) => {
    const matchesInstalled =
      filters.installed === "all" || (filters.installed === "installed" ? skill.localVersion : !skill.localVersion);
    const matchesEnabled =
      filters.enabled === "all" || (filters.enabled === "enabled" ? skill.enabledTargets.length > 0 : skill.enabledTargets.length === 0);
    const matchesQuery =
      query.length === 0 ||
      skill.displayName.toLocaleLowerCase().includes(query) ||
      skill.description.toLocaleLowerCase().includes(query) ||
      skill.skillID.toLocaleLowerCase().includes(query) ||
      skill.category.toLocaleLowerCase().includes(query) ||
      skill.tags.some((tag) => tag.toLocaleLowerCase().includes(query)) ||
      skill.authorDepartment?.toLocaleLowerCase().includes(query) ||
      skill.authorName?.toLocaleLowerCase().includes(query);
    const matchesDepartment = filters.department === "all" || skill.authorDepartment === filters.department;
    const matchesTool = filters.compatibleTool === "all" || skill.compatibleTools.includes(filters.compatibleTool);
    const matchesAccess = filters.accessScope === "include_public" || skill.detailAccess === "full";
    const matchesCategory = filters.category === "all" || skill.category === filters.category;
    const matchesTags = filters.tags.length === 0 || filters.tags.some((tag) => skill.tags.includes(tag));
    const matchesRisk = filters.riskLevel === "all" || skill.riskLevel === filters.riskLevel;
    const matchesPublishedWithin =
      publishedWindowDays === 0 || new Date(skill.publishedAt).getTime() >= Date.now() - publishedWindowDays * 24 * 60 * 60 * 1000;
    const matchesUpdatedWithin =
      updatedWindowDays === 0 || new Date(skill.currentVersionUpdatedAt).getTime() >= Date.now() - updatedWindowDays * 24 * 60 * 60 * 1000;

    return (
      matchesQuery &&
      matchesDepartment &&
      matchesTool &&
      matchesInstalled &&
      matchesEnabled &&
      matchesAccess &&
      matchesCategory &&
      matchesTags &&
      matchesRisk &&
      matchesPublishedWithin &&
      matchesUpdatedWithin
    );
  });

  return filtered.sort((left, right) => {
    switch (filters.sort) {
      case "latest_published":
        return right.publishedAt.localeCompare(left.publishedAt);
      case "recently_updated":
        return right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt);
      case "download_count":
        return right.downloadCount - left.downloadCount;
      case "star_count":
        return right.starCount - left.starCount;
      case "relevance":
        return relevanceScore(right) - relevanceScore(left);
      case "composite":
      default:
        return right.starCount + right.downloadCount - (left.starCount + left.downloadCount);
    }
  });
}

export function deriveWorkspaceState(input: {
  authState: AuthState;
  bootstrap: BootstrapContext;
  departments: DepartmentNode[];
  filters: MarketFilters;
  notifications: LocalNotification[];
  scanTargets: ScanTargetSummary[];
  selectedDepartmentID: string | null;
  selectedSkillID: string;
  skills: SkillSummary[];
}) {
  const {
    authState,
    bootstrap,
    departments,
    filters,
    notifications,
    scanTargets,
    selectedDepartmentID,
    selectedSkillID,
    skills
  } = input;
  const communitySkills = skills.filter(isCommunityVisibleSkill);
  const selectedSkill = skills.find((skill) => skill.skillID === selectedSkillID) ?? skills[0] ?? null;
  const selectedDepartment = findDepartment(departments, selectedDepartmentID) ?? departments[0] ?? null;
  const counts = {
    installedCount: skills.filter((skill) => skill.localVersion !== null).length,
    enabledCount: skills.filter((skill) => skill.enabledTargets.length > 0).length,
    updateAvailableCount: skills.filter((skill) => skill.installState === "update_available").length,
    unreadNotificationCount: notifications.filter((notification) => notification.unread).length
  };
  const marketSkills = deriveMarketSkills({ authState, bootstrap, filters, skills });
  const installedSkills = skills.filter((skill) => skill.localVersion !== null);
  const discoveredLocalSkills = deriveDiscoveredLocalSkills({
    installedSkills,
    marketSkills: communitySkills,
    scanTargets
  });
  const visibleNavigation = deriveVisibleNavigation({ authState, bootstrap });
  const departmentsFilter = [...new Set(communitySkills.map((skill) => skill.authorDepartment).filter(Boolean))] as string[];
  const compatibleTools = [...new Set(skills.flatMap((skill) => skill.compatibleTools))];
  const categories = [...SKILL_CATEGORIES];
  const tags = [...SKILL_TAGS];
  const isAdminConnected =
    authState === "authenticated" &&
    bootstrap.user.role === "admin" &&
    adminNavigationPages.some((page) => bootstrap.menuPermissions.includes(page));

  return {
    categories,
    tags,
    compatibleTools,
    counts,
    departmentsFilter,
    discoveredLocalSkills,
    installedSkills,
    isAdminConnected,
    marketSkills,
    selectedDepartment,
    selectedSkill,
    visibleNavigation
  };
}
