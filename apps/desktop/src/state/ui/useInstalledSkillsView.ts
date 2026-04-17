import { useMemo, useState } from "react";
import type { P1WorkspaceState } from "../useP1Workspace.ts";
import { collectInstalledSkillIssues, matchesInstalledFilter } from "./installedSkillSelectors.ts";
import type { InstalledListFilter } from "./installedSkillsTypes.ts";

export function useInstalledSkillsView(
  workspace: P1WorkspaceState,
  input: {
    installedFilter: InstalledListFilter;
    setInstalledFilter: (value: InstalledListFilter) => void;
  }
) {
  const [installedQuery, setInstalledQuery] = useState("");
  const installedFilter = input.installedFilter;

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
      const matchesQuery =
        query.length === 0 ||
        skill.displayName.toLocaleLowerCase().includes(query) ||
        skill.skillID.toLocaleLowerCase().includes(query) ||
        issues.some((issue) => issue.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [installedFilter, installedQuery, installedSkillIssuesByID, workspace.installedSkills]);

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
    installedFilter: input.installedFilter,
    setInstalledFilter: input.setInstalledFilter,
    installedSkillIssuesByID,
    filteredInstalledSkills,
    installedFilterCounts,
  };
}
