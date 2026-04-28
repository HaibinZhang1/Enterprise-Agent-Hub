import { useMemo, useState } from "react";
import type { P1WorkspaceState } from "../useP1Workspace.ts";
import { collectInstalledSkillIssues, compareToolsByAvailability, matchesInstalledFilter, matchesInstalledTargetFilter } from "./installedSkillSelectors.ts";
import type { InstalledListFilter, InstalledTargetFilterType, InstalledTargetFilterValue } from "./installedSkillsTypes.ts";

function parseInstalledTargetFilter(value: InstalledTargetFilterValue): { type: InstalledTargetFilterType; id: string } {
  if (value === "all") return { type: "all", id: "all" };
  const [type, id] = value.split(":") as [Exclude<InstalledTargetFilterType, "all">, string];
  return { type, id };
}

export function useInstalledSkillsView(
  workspace: P1WorkspaceState,
  input: {
    installedFilter: InstalledListFilter;
    setInstalledFilter: (value: InstalledListFilter) => void;
  }
) {
  const [installedQuery, setInstalledQuery] = useState("");
  const [installedTargetFilterValue, setInstalledTargetFilterValue] = useState<InstalledTargetFilterValue>("all");
  const installedFilter = input.installedFilter;
  const parsedInstalledTargetFilter = parseInstalledTargetFilter(installedTargetFilterValue);

  const installedSkillIssuesByID = useMemo(
    () =>
      Object.fromEntries(
        workspace.installedSkills.map((skill) => [skill.skillID, collectInstalledSkillIssues(skill, workspace)])
      ) as Record<string, string[]>,
    [workspace]
  );

  const filteredInstalledSkills = useMemo(() => {
    const query = installedQuery.trim().toLocaleLowerCase();
    return workspace.installedSkills.filter((skill) => {
      const issues = installedSkillIssuesByID[skill.skillID] ?? [];
      const matchesFilter = matchesInstalledFilter(skill, installedFilter, issues);
      const matchesTarget = matchesInstalledTargetFilter(skill, parsedInstalledTargetFilter.type, parsedInstalledTargetFilter.id);
      const matchesQuery =
        query.length === 0 ||
        skill.displayName.toLocaleLowerCase().includes(query) ||
        skill.skillID.toLocaleLowerCase().includes(query) ||
        issues.some((issue) => issue.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesTarget && matchesQuery;
    });
  }, [installedFilter, installedQuery, installedSkillIssuesByID, parsedInstalledTargetFilter.id, parsedInstalledTargetFilter.type, workspace.installedSkills]);

  const installedTargetOptions = useMemo(() => {
    const tools = [...workspace.tools].sort(compareToolsByAvailability).map((tool) => ({
      id: `tool:${tool.toolID}` as const,
      label: tool.displayName || tool.name
    }));
    const projects = [...workspace.projects].sort((left, right) => left.name.localeCompare(right.name) || left.projectID.localeCompare(right.projectID)).map((project) => ({
      id: `project:${project.projectID}` as const,
      label: project.name
    }));
    return [...tools, ...projects];
  }, [workspace.projects, workspace.tools]);

  const installedFilterCounts = useMemo(
    () => ({
      all: workspace.installedSkills.length,
      enabled: workspace.installedSkills.filter((skill) => skill.enabledTargets.length > 0).length,
      updates: workspace.installedSkills.filter((skill) => skill.installState === "update_available").length,
      scope_restricted: workspace.installedSkills.filter((skill) => skill.isScopeRestricted).length,
      issues: workspace.installedSkills.filter((skill) => (installedSkillIssuesByID[skill.skillID] ?? []).length > 0).length
    }),
    [installedSkillIssuesByID, workspace.installedSkills]
  );

  return {
    installedQuery,
    setInstalledQuery,
    installedTargetFilterType: parsedInstalledTargetFilter.type,
    installedTargetFilterID: parsedInstalledTargetFilter.id,
    installedTargetFilterValue,
    setInstalledTargetFilterValue,
    installedTargetOptions,
    installedFilter: input.installedFilter,
    setInstalledFilter: input.setInstalledFilter,
    installedSkillIssuesByID,
    filteredInstalledSkills,
    installedFilterCounts,
  };
}
