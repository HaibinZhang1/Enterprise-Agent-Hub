import { useCallback, useEffect, useRef } from "react";
import type { LocalBootstrap, PageID, SkillSummary } from "../../../domain/p1";
import { isConnectionUnavailableError, isPermissionError, isServerUnavailableError, isUnauthenticatedError, p1Client } from "../../../services/p1Client";
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
    setExtensions: (value: LocalBootstrap["extensions"]) => void;
    setProjects: (value: LocalBootstrap["projects"]) => void;
    setScanTargets: (value: Awaited<ReturnType<typeof import("../../../services/desktopBridge").desktopBridge.scanLocalTargets>>) => void;
    setTools: (value: LocalBootstrap["tools"]) => void;
  };
  market: {
    setLeaderboards: (value: null) => void;
    setLeaderboardsLoading: (value: false) => void;
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
  const remoteMarketFiltersRef = useRef(remoteMarketFilters);

  useEffect(() => {
    remoteMarketFiltersRef.current = remoteMarketFilters;
  }, [remoteMarketFilters]);

  const moveToGuest = useCallback(
    async (message?: string) => {
      await moveWorkspaceToGuest({
        message,
        localBootstrapRef: localSync.localBootstrapRef,
        refreshLocalBootstrap: localSync.refreshLocalBootstrap,
        setAuthState: auth.setAuthState,
        setBootstrap: auth.setBootstrap,
        setLeaderboards: market.setLeaderboards,
        setLeaderboardsLoading: market.setLeaderboardsLoading,
        setSkills: market.setSkills,
        setExtensions: localSync.setExtensions,
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
      localSync.setExtensions,
      localSync.setScanTargets,
      market.setLeaderboards,
      market.setLeaderboardsLoading,
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
        market.setProgress({ operation: "request", skillID: "permission", stage: "权限变化", result: "failed", message: "当前账号已不具备该页面权限。" });
        return true;
      }
      const message = error instanceof Error ? error.message : "请求失败";
      if (isConnectionUnavailableError(error)) {
        auth.setBootstrap((current: any) => ({
          ...current,
          connection: {
            ...current.connection,
            status: "offline",
            lastError: message
          }
        }));
        market.setProgress({ operation: "request", skillID: "offline", stage: "离线模式", result: "failed", message });
        return true;
      }
      if (isServerUnavailableError(error)) {
        auth.setBootstrap((current: any) => ({
          ...current,
          connection: {
            ...current.connection,
            status: "failed",
            lastError: message
          }
        }));
        market.setProgress({ operation: "request", skillID: "server", stage: "服务异常", result: "failed", message });
        return true;
      }
      market.setProgress({ operation: "request", skillID: "request", stage: "请求失败", result: "failed", message });
      return false;
    },
    [auth.setAuthError, auth.setBootstrap, auth.setLoginModalOpen, auth.stripAdminCapabilities, market.setProgress, moveToGuest]
  );

  const hydrateAuthenticatedState = useCallback(
    async (localBootstrap?: LocalBootstrap) => {
      return hydrateAuthenticatedWorkspace({
        localBootstrap,
        localBootstrapRef: localSync.localBootstrapRef,
        refreshLocalBootstrap: localSync.refreshLocalBootstrap,
        remoteMarketFilters: remoteMarketFiltersRef.current,
        setAuthState: auth.setAuthState,
        setBootstrap: auth.setBootstrap,
        setSkills: market.setSkills,
        setTools: localSync.setTools,
        setExtensions: localSync.setExtensions,
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
      localSync.setExtensions,
      localSync.setProjects,
      localSync.setScanTargets,
      localSync.setTools,
      market.setSelectedSkillID,
      market.setSkills,
      remoteMarketFiltersRef
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
    async (inputValue: Parameters<typeof p1Client.login>[0]) => {
      auth.setAuthError(null);
      try {
        const localBootstrap = localSync.localBootstrapRef.current ?? (await localSync.refreshLocalBootstrap());
        localSync.localBootstrapRef.current = localBootstrap;
        const result = await p1Client.login(inputValue);
        if (result.status === "password_change_required") {
          return result;
        }
        await hydrateAuthenticatedState(localBootstrap);
        auth.setLoginModalOpen(false);
        const pending = auth.consumePendingLogin("home");
        auth.setActivePageState(pending.page);
        if (pending.action) {
          await pending.action();
        }
        return { status: "authenticated" as const };
      } catch (error) {
        auth.setAuthError(error instanceof Error ? error.message : "登录失败");
        return { status: "failed" as const };
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

  const completeInitialPasswordChange = useCallback(
    async (inputValue: Parameters<typeof p1Client.completeInitialPasswordChange>[0]) => {
      auth.setAuthError(null);
      try {
        const localBootstrap = localSync.localBootstrapRef.current ?? (await localSync.refreshLocalBootstrap());
        localSync.localBootstrapRef.current = localBootstrap;
        await p1Client.completeInitialPasswordChange(inputValue);
        await hydrateAuthenticatedState(localBootstrap);
        auth.setLoginModalOpen(false);
        const pending = auth.consumePendingLogin("home");
        auth.setActivePageState(pending.page);
        if (pending.action) {
          await pending.action();
        }
        return { ok: true as const };
      } catch (error) {
        auth.setAuthError(error instanceof Error ? error.message : "首次登录修改密码失败");
        return { ok: false as const, error: error instanceof Error ? error.message : "首次登录修改密码失败" };
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
    completeInitialPasswordChange,
    hydrateAuthenticatedState,
    login,
    logout,
    moveToGuest,
    refreshBootstrap,
    requireAuth,
    requireAuthenticatedAction
  };
}
