import { useCallback } from "react";
import type { LocalBootstrap, PageID, SkillSummary } from "../../../domain/p1";
import { isPermissionError, isUnauthenticatedError, p1Client } from "../../../services/p1Client";
import { hydrateAuthenticatedWorkspace, moveWorkspaceToGuest } from "./useWorkspaceBootstrap";
import type { HandleRemoteError, RequireAuthenticatedAction } from "../workspaceTypes";

export function useWorkspaceSessionFlow(input: {
  auth: {
    activePage: PageID;
    authState: "guest" | "authenticated";
    clearPendingLogin: () => void;
    consumePendingLogin: (fallbackPage: PageID) => { page: PageID; action: (() => Promise<void> | void) | null };
    loginModalOpen: boolean;
    queueLogin: (page: PageID | null, action?: () => Promise<void> | void) => void;
    setActivePageState: any;
    setAuthError: (value: string | null) => void;
    setAuthState: (value: "guest" | "authenticated") => void;
    setBootstrap: any;
    setLoginModalOpen: (value: boolean) => void;
    stripAdminCapabilities: () => void;
  };
  localSync: {
    localBootstrapRef: { current: LocalBootstrap | null };
    refreshLocalBootstrap: () => Promise<LocalBootstrap>;
    setNotifications: (value: LocalBootstrap["notifications"]) => void;
    setOfflineEvents: (value: LocalBootstrap["offlineEvents"]) => void;
    setProjects: (value: LocalBootstrap["projects"]) => void;
    setScanTargets: (value: Awaited<ReturnType<typeof import("../../../services/tauriBridge").desktopBridge.scanLocalTargets>>) => void;
    setTools: (value: LocalBootstrap["tools"]) => void;
  };
  market: {
    setProgress: (value: any) => void;
    setSelectedSkillID: (value: string | ((current: string) => string)) => void;
    setSkills: (value: SkillSummary[] | ((current: SkillSummary[]) => SkillSummary[])) => void;
  };
  publisher: {
    resetPublisherState: () => void;
  };
  adminReview: {
    resetAdminReviewState: () => void;
  };
  remoteMarketFilters: Record<string, unknown>;
}) {
  const { auth, localSync, market, publisher, adminReview, remoteMarketFilters } = input;

  const moveToGuest = useCallback(
    async (message?: string) => {
      await moveWorkspaceToGuest({
        message,
        localBootstrapRef: localSync.localBootstrapRef,
        refreshLocalBootstrap: localSync.refreshLocalBootstrap,
        setAuthState: auth.setAuthState,
        setBootstrap: auth.setBootstrap,
        setSkills: market.setSkills,
        setOfflineEvents: localSync.setOfflineEvents,
        setScanTargets: localSync.setScanTargets,
        setNotifications: localSync.setNotifications,
        resetPublisherState: publisher.resetPublisherState,
        resetAdminReviewState: adminReview.resetAdminReviewState,
        setSelectedSkillID: market.setSelectedSkillID,
        setActivePageState: auth.setActivePageState
      });
    },
    [
      adminReview.resetAdminReviewState,
      auth.setActivePageState,
      auth.setAuthState,
      auth.setBootstrap,
      localSync.localBootstrapRef,
      localSync.refreshLocalBootstrap,
      localSync.setNotifications,
      localSync.setOfflineEvents,
      localSync.setScanTargets,
      market.setSelectedSkillID,
      market.setSkills,
      publisher.resetPublisherState
    ]
  );

  const handleRemoteError = useCallback<HandleRemoteError>(
    async (error: unknown, options: { reopenLogin?: boolean } = {}) => {
      if (isUnauthenticatedError(error)) {
        p1Client.clearStoredSession();
        await moveToGuest("登录已失效，请重新登录。");
        auth.setAuthError("登录已失效，请重新登录。");
        if (options.reopenLogin) {
          auth.setLoginModalOpen(true);
        }
        return true;
      }
      if (isPermissionError(error)) {
        auth.stripAdminCapabilities();
        market.setProgress({ operation: "update", skillID: "permission", stage: "权限变化", result: "failed", message: "当前账号已不具备该页面权限。" });
        return true;
      }
      const message = error instanceof Error ? error.message : "请求失败";
      market.setProgress({ operation: "update", skillID: "request", stage: "失败", result: "failed", message });
      return false;
    },
    [auth.setAuthError, auth.setLoginModalOpen, auth.stripAdminCapabilities, market.setProgress, moveToGuest]
  );

  const hydrateAuthenticatedState = useCallback(
    async (localBootstrap?: LocalBootstrap) => {
      return hydrateAuthenticatedWorkspace({
        localBootstrap,
        localBootstrapRef: localSync.localBootstrapRef,
        refreshLocalBootstrap: localSync.refreshLocalBootstrap,
        remoteMarketFilters,
        setAuthState: auth.setAuthState,
        setBootstrap: auth.setBootstrap,
        setSkills: market.setSkills,
        setTools: localSync.setTools,
        setProjects: localSync.setProjects,
        setOfflineEvents: localSync.setOfflineEvents,
        setScanTargets: localSync.setScanTargets,
        setNotifications: localSync.setNotifications,
        setSelectedSkillID: market.setSelectedSkillID
      });
    },
    [
      auth.setAuthState,
      auth.setBootstrap,
      localSync.localBootstrapRef,
      localSync.refreshLocalBootstrap,
      localSync.setNotifications,
      localSync.setOfflineEvents,
      localSync.setProjects,
      localSync.setScanTargets,
      localSync.setTools,
      market.setSelectedSkillID,
      market.setSkills,
      remoteMarketFilters
    ]
  );

  const requireAuth = useCallback(
    (page: PageID | null, action?: () => Promise<void> | void) => {
      auth.queueLogin(page, action);
      auth.setLoginModalOpen(true);
    },
    [auth.queueLogin, auth.setLoginModalOpen]
  );

  const requireAuthenticatedAction = useCallback<RequireAuthenticatedAction>(
    (page: PageID | null, action: () => Promise<void> | void) => {
      if (auth.authState !== "authenticated") {
        requireAuth(page, action);
        return false;
      }
      void Promise.resolve(action()).catch((error) => void handleRemoteError(error, { reopenLogin: true }));
      return true;
    },
    [auth.authState, handleRemoteError, requireAuth]
  );

  const login = useCallback(
    async (inputValue: { username: string; password: string; serverURL: string }) => {
      auth.setAuthError(null);
      try {
        const localBootstrap = localSync.localBootstrapRef.current ?? (await localSync.refreshLocalBootstrap());
        localSync.localBootstrapRef.current = localBootstrap;
        await p1Client.login(inputValue);
        await hydrateAuthenticatedState(localBootstrap);
        auth.setLoginModalOpen(false);
        const pending = auth.consumePendingLogin("home");
        auth.setActivePageState(pending.page);
        if (pending.action) {
          await pending.action();
        }
      } catch (error) {
        auth.setAuthError(error instanceof Error ? error.message : "登录失败");
      }
    },
    [
      auth.consumePendingLogin,
      auth.setActivePageState,
      auth.setAuthError,
      auth.setLoginModalOpen,
      hydrateAuthenticatedState,
      localSync.localBootstrapRef,
      localSync.refreshLocalBootstrap
    ]
  );

  const logout = useCallback(async () => {
    await p1Client.logout();
    auth.clearPendingLogin();
    auth.setLoginModalOpen(false);
    auth.setAuthError(null);
    await moveToGuest("已切换到本地模式。");
  }, [auth.clearPendingLogin, auth.setAuthError, auth.setLoginModalOpen, moveToGuest]);

  const refreshBootstrap = useCallback(async () => {
    if (auth.authState !== "authenticated") {
      requireAuth(auth.activePage);
      return;
    }
    try {
      await hydrateAuthenticatedState();
    } catch (error) {
      await handleRemoteError(error, { reopenLogin: true });
    }
  }, [auth.activePage, auth.authState, handleRemoteError, hydrateAuthenticatedState, requireAuth]);

  return {
    handleRemoteError,
    hydrateAuthenticatedState,
    login,
    logout,
    moveToGuest,
    refreshBootstrap,
    requireAuth,
    requireAuthenticatedAction
  };
}
