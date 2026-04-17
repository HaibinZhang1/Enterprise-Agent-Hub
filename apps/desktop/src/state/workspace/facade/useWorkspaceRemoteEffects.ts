import { useEffect } from "react";
import { isUnauthenticatedError, p1Client } from "../../../services/p1Client";
import { desktopBridge } from "../../../services/tauriBridge";
import { buildGuestBootstrap, localSummaryFromInstall, mergeLocalInstalls } from "../../p1WorkspaceHelpers";
import type { HandleRemoteError } from "../workspaceTypes";

const adminPages = ["review", "admin_departments", "admin_users", "admin_skills"] as const;

export function useWorkspaceRemoteEffects(input: {
  auth: {
    activePage: string;
    authState: "guest" | "authenticated";
    bootstrap: any;
    setActivePageState: (value: any) => void;
    setAuthState: (value: "guest" | "authenticated") => void;
    setBootstrap: (value: any) => void;
  };
  localSync: {
    localBootstrapRef: { current: any };
    refreshLocalBootstrap: () => Promise<any>;
    setNotifications: (value: any) => void;
    setOfflineEvents: (value: any) => void;
    setScanTargets: (value: any) => void;
  };
  market: {
    setSelectedSkillID: (value: any) => void;
    setSkills: (value: any) => void;
  };
  derived: {
    visibleNavigation: string[];
  };
  remoteMarketFilters: Record<string, unknown>;
  hydrateAuthenticatedState: (localBootstrap?: any) => Promise<any>;
  handleRemoteError: HandleRemoteError;
  adminActions: {
    refreshManageData: () => Promise<void>;
    refreshReviews: () => Promise<void>;
  };
  publisherActions: {
    refreshPublisherData: () => Promise<void>;
  };
}) {
  const {
    auth,
    localSync,
    market,
    derived,
    remoteMarketFilters,
    hydrateAuthenticatedState,
    handleRemoteError,
    adminActions,
    publisherActions
  } = input;

  useEffect(() => {
    let cancelled = false;

    async function initializeWorkspace() {
      const localBootstrap = await localSync.refreshLocalBootstrap();
      const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
      if (cancelled) return;
      const localSkills = localBootstrap.installs.map(localSummaryFromInstall);
      auth.setBootstrap(buildGuestBootstrap(localBootstrap));
      market.setSkills(localSkills);
      localSync.setNotifications(localBootstrap.notifications);
      localSync.setOfflineEvents(localBootstrap.offlineEvents);
      localSync.setScanTargets(localScanTargets);
      market.setSelectedSkillID(localSkills[0]?.skillID ?? "");

      if (p1Client.hasStoredSession()) {
        auth.setBootstrap((current: any) => ({
          ...current,
          connection: { ...current.connection, status: "connecting", lastError: "正在恢复登录状态..." }
        }));
        try {
          await hydrateAuthenticatedState(localBootstrap);
        } catch (error) {
          if (cancelled) return;
          if (isUnauthenticatedError(error)) {
            p1Client.clearStoredSession();
          }
          const message = error instanceof Error ? error.message : "当前处于离线模式。";
          auth.setBootstrap(buildGuestBootstrap(localBootstrap, message));
          auth.setAuthState("guest");
        }
      }
    }

    void initializeWorkspace();
    return () => {
      cancelled = true;
    };
  }, [
    auth.setAuthState,
    auth.setBootstrap,
    hydrateAuthenticatedState,
    localSync.refreshLocalBootstrap,
    localSync.setNotifications,
    localSync.setOfflineEvents,
    localSync.setScanTargets,
    market.setSelectedSkillID,
    market.setSkills
  ]);

  useEffect(() => {
    if (auth.authState !== "authenticated" || auth.bootstrap.connection.status !== "connected") return;
    let cancelled = false;

    void p1Client
      .listSkills(remoteMarketFilters as never)
      .then((remoteSkills) => {
        if (cancelled) return;
        const localBootstrap = localSync.localBootstrapRef.current;
        const mergedSkills = localBootstrap ? mergeLocalInstalls(remoteSkills, localBootstrap) : remoteSkills;
        market.setSkills(mergedSkills);
        market.setSelectedSkillID((current: string) => (mergedSkills.some((skill) => skill.skillID === current) ? current : mergedSkills[0]?.skillID ?? ""));
      })
      .catch((error) => void handleRemoteError(error));

    return () => {
      cancelled = true;
    };
  }, [
    auth.authState,
    auth.bootstrap.connection.status,
    handleRemoteError,
    localSync.localBootstrapRef,
    market.setSelectedSkillID,
    market.setSkills,
    remoteMarketFilters
  ]);

  useEffect(() => {
    if (auth.activePage === "notifications") {
      auth.setActivePageState("home");
    }
    if (adminPages.includes(auth.activePage as (typeof adminPages)[number]) && !derived.visibleNavigation.includes(auth.activePage)) {
      auth.setActivePageState("home");
    }
  }, [auth.activePage, auth.setActivePageState, derived.visibleNavigation]);

  useEffect(() => {
    if (auth.authState !== "authenticated" || auth.bootstrap.connection.status !== "connected") return;
    if (
      (auth.activePage === "admin_departments" && auth.bootstrap.menuPermissions.includes("admin_departments")) ||
      (auth.activePage === "admin_users" && auth.bootstrap.menuPermissions.includes("admin_users")) ||
      (auth.activePage === "admin_skills" && auth.bootstrap.menuPermissions.includes("admin_skills"))
    ) {
      void adminActions.refreshManageData().catch((error) => void handleRemoteError(error));
    }
    if (auth.activePage === "publisher" && auth.bootstrap.features.publishSkill) {
      void publisherActions.refreshPublisherData().catch((error) => void handleRemoteError(error));
    }
    if (auth.activePage === "review" && auth.bootstrap.menuPermissions.includes("review")) {
      void adminActions.refreshReviews().catch((error) => void handleRemoteError(error));
    }
  }, [
    adminActions.refreshManageData,
    adminActions.refreshReviews,
    auth.activePage,
    auth.authState,
    auth.bootstrap.connection.status,
    auth.bootstrap.features.publishSkill,
    auth.bootstrap.menuPermissions,
    handleRemoteError,
    publisherActions.refreshPublisherData
  ]);
}
