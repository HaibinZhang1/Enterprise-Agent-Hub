import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopModalState, NavigationPageID } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";

export function useDesktopNavigation(input: {
  workspace: P1WorkspaceState;
  visibleSkillDetail: P1WorkspaceState["selectedSkill"];
  setModal: (modal: DesktopModalState) => void;
}) {
  const { workspace, visibleSkillDetail, setModal } = input;
  const [activePage, setActivePage] = useState<NavigationPageID>("home");
  const [lastShellPage, setLastShellPage] = useState<NavigationPageID>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (activePage === "review" && !workspace.visibleNavigation.includes("review")) {
      setActivePage("home");
    }
    if (activePage === "manage" && !workspace.visibleNavigation.includes("manage")) {
      setActivePage("home");
    }
    if (activePage === "settings") {
      setActivePage(lastShellPage);
    }
  }, [activePage, lastShellPage, workspace.visibleNavigation]);

  const navigation = useMemo(() => workspace.visibleNavigation as NavigationPageID[], [workspace.visibleNavigation]);

  const navigate = useCallback((page: NavigationPageID) => {
    if (page === "settings") {
      setModal({ type: "settings" });
      return;
    }

    setDrawerOpen(false);
    setLastShellPage(page);
    setActivePage(page);
    workspace.openPage(page);
  }, [setModal, workspace]);

  const openSkillDetail = useCallback((skillID: string, sourcePage: NavigationPageID = "market") => {
    workspace.selectSkill(skillID);
    setDrawerOpen(true);
    if (activePage !== sourcePage) {
      setActivePage(sourcePage);
      setLastShellPage(sourcePage);
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
