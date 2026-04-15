import { useCallback, useEffect, useMemo, useState } from "react";
import type { DesktopModalState, NavigationPageID } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";

function isShellPage(page: NavigationPageID | "detail"): page is NavigationPageID {
  return page !== "detail";
}

export function useDesktopNavigation(input: {
  workspace: P1WorkspaceState;
  visibleSkillDetail: P1WorkspaceState["selectedSkill"];
  setModal: (modal: DesktopModalState) => void;
}) {
  const { workspace, visibleSkillDetail, setModal } = input;
  const [activePage, setActivePage] = useState<NavigationPageID | "detail">("home");
  const [lastShellPage, setLastShellPage] = useState<NavigationPageID>("home");

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
    if (activePage === "detail" && !visibleSkillDetail) {
      setActivePage(lastShellPage);
    }
  }, [activePage, lastShellPage, visibleSkillDetail, workspace.visibleNavigation]);

  const navigation = useMemo(() => workspace.visibleNavigation as NavigationPageID[], [workspace.visibleNavigation]);

  const navigate = useCallback((page: NavigationPageID | "detail") => {
    if (page === "detail") {
      if (!visibleSkillDetail) return;
      setActivePage("detail");
      return;
    }

    if (page === "settings") {
      setModal({ type: "settings" });
      return;
    }

    if (isShellPage(page)) {
      setLastShellPage(page);
      setActivePage(page);
      workspace.openPage(page);
    }
  }, [setModal, visibleSkillDetail, workspace]);

  const openSkillDetail = useCallback((skillID: string, sourcePage: NavigationPageID = "market") => {
    workspace.selectSkill(skillID);
    setLastShellPage(sourcePage);
    setActivePage("detail");
  }, [workspace]);

  return {
    activePage,
    navigation,
    lastShellPage,
    navigate,
    openSkillDetail,
  };
}
