import { useCallback, useEffect, useMemo, useState } from "react";
import type { NavigationPageID } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";

type ShellNavigationPageID = Exclude<NavigationPageID, "notifications">;
const adminPages: ShellNavigationPageID[] = ["review", "admin_departments", "admin_users", "admin_skills"];

export function useDesktopNavigation(input: {
  workspace: P1WorkspaceState;
  visibleSkillDetail: P1WorkspaceState["selectedSkill"];
}) {
  const { workspace, visibleSkillDetail } = input;
  const [activePage, setActivePage] = useState<NavigationPageID>("home");
  const [lastShellPage, setLastShellPage] = useState<ShellNavigationPageID>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const activeAdminPage = activePage as ShellNavigationPageID;
    if (activePage === "notifications") {
      setActivePage("home");
    }
    if (adminPages.includes(activeAdminPage) && !workspace.visibleNavigation.includes(activeAdminPage)) {
      setActivePage("home");
    }
  }, [activePage, workspace.visibleNavigation]);

  const navigation = useMemo(() => workspace.visibleNavigation as ShellNavigationPageID[], [workspace.visibleNavigation]);

  const navigate = useCallback((page: NavigationPageID) => {
    if (page === "notifications") {
      setDrawerOpen(false);
      setLastShellPage("home");
      setActivePage("home");
      workspace.openPage("home");
      return;
    }

    setDrawerOpen(false);
    setLastShellPage(page as ShellNavigationPageID);
    setActivePage(page);
    workspace.openPage(page);
  }, [workspace]);

  const openSkillDetail = useCallback((skillID: string, sourcePage: NavigationPageID = "market") => {
    workspace.selectSkill(skillID);
    setDrawerOpen(true);
    if (activePage !== sourcePage) {
      const nextSourcePage = (sourcePage === "notifications" ? "market" : sourcePage) as ShellNavigationPageID;
      setActivePage(nextSourcePage);
      setLastShellPage(nextSourcePage);
    }
  }, [activePage, workspace]);

  const closeSkillDetail = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  /** The skill to display in the drawer — only non-null when drawer is explicitly open */
  const drawerSkill = drawerOpen ? visibleSkillDetail : null;

  return {
    activePage,
    navigation,
    lastShellPage,
    drawerOpen,
    drawerSkill,
    navigate,
    openSkillDetail,
    closeSkillDetail,
  };
}
