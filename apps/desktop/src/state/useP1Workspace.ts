import { useCallback, useMemo } from "react";
import type { PageID } from "../domain/p1";
import { p1Client } from "../services/p1Client";
import { useWorkspaceAdminReviewActions, useWorkspaceAdminReviewState } from "./workspace/useWorkspaceAdminReview";
import { useWorkspaceAuthState } from "./workspace/useWorkspaceAuth";
import { useWorkspaceRemoteEffects } from "./workspace/facade/useWorkspaceRemoteEffects";
import { useWorkspaceSessionFlow } from "./workspace/facade/useWorkspaceSessionFlow";
import { useWorkspaceLocalSyncActions, useWorkspaceLocalSyncState } from "./workspace/useWorkspaceLocalSync";
import { useWorkspaceMarketActions, useWorkspaceMarketState } from "./workspace/useWorkspaceMarket";
import { useWorkspacePublisherActions, useWorkspacePublisherState } from "./workspace/useWorkspacePublisher";
import { deriveWorkspaceState } from "./workspace/workspaceDerivedState";

const adminPages: PageID[] = ["review", "admin_departments", "admin_users", "admin_skills"];

export function useP1Workspace() {
  const auth = useWorkspaceAuthState();
  const localSync = useWorkspaceLocalSyncState();
  const market = useWorkspaceMarketState();
  const publisher = useWorkspacePublisherState();
  const adminReview = useWorkspaceAdminReviewState();

  const remoteMarketFilters = useMemo(
    () => ({ ...market.filters, installed: "all" as const, enabled: "all" as const }),
    [market.filters]
  );

  const derived = useMemo(
    () =>
      deriveWorkspaceState({
        authState: auth.authState,
        bootstrap: auth.bootstrap,
        departments: adminReview.departments,
        filters: market.filters,
        notifications: localSync.notifications,
        scanTargets: localSync.scanTargets,
        selectedDepartmentID: adminReview.selectedDepartmentID,
        selectedSkillID: market.selectedSkillID,
        skills: market.skills
      }),
    [
      adminReview.departments,
      adminReview.selectedDepartmentID,
      auth.authState,
      auth.bootstrap,
      localSync.notifications,
      localSync.scanTargets,
      market.filters,
      market.selectedSkillID,
      market.skills
    ]
  );

  const sessionFlow = useWorkspaceSessionFlow({
    auth,
    localSync,
    market,
    publisher,
    adminReview,
    remoteMarketFilters
  });

  const openPage = useCallback(
    (page: PageID) => {
      if (page === "notifications") {
        auth.setActivePageState("home");
        return;
      }
      if (page === "market" && auth.authState !== "authenticated") {
        sessionFlow.requireAuth(page);
        return;
      }
      if (adminPages.includes(page)) {
        if (auth.authState !== "authenticated") {
          sessionFlow.requireAuth(page);
          return;
        }
        if (!derived.visibleNavigation.includes(page)) {
          auth.setActivePageState("home");
          return;
        }
      }
      auth.setActivePageState(page);
    },
    [auth.authState, auth.setActivePageState, derived.visibleNavigation, sessionFlow]
  );

  const marketActions = useWorkspaceMarketActions({
    bootstrap: auth.bootstrap,
    persistNotifications: localSync.persistNotifications,
    refreshLocalBootstrap: localSync.refreshLocalBootstrap,
    refreshLocalScans: localSync.refreshLocalScans,
    requireAuthenticatedAction: sessionFlow.requireAuthenticatedAction,
    setLeaderboards: market.setLeaderboards,
    setLeaderboardsLoading: market.setLeaderboardsLoading,
    setOfflineEvents: localSync.setOfflineEvents,
    setSkills: market.setSkills,
    skills: market.skills,
    updateSkillProgress: market.updateSkillProgress
  });

  const localActions = useWorkspaceLocalSyncActions({
    authState: auth.authState,
    bootstrap: auth.bootstrap,
    handleRemoteError: sessionFlow.handleRemoteError,
    notifications: localSync.notifications,
    offlineEvents: localSync.offlineEvents,
    extensions: localSync.extensions,
    refreshLocalBootstrap: localSync.refreshLocalBootstrap,
    refreshLocalScans: localSync.refreshLocalScans,
    setExtensions: localSync.setExtensions,
    setNotifications: localSync.setNotifications,
    setOfflineEvents: localSync.setOfflineEvents,
    setProjects: localSync.setProjects,
    setTools: localSync.setTools,
    updateSkillProgress: market.updateSkillProgress
  });

  const publisherActions = useWorkspacePublisherActions({
    activePage: auth.activePage,
    authState: auth.authState,
    handleRemoteError: sessionFlow.handleRemoteError,
    requireAuthenticatedAction: sessionFlow.requireAuthenticatedAction,
    selectedPublisherSubmissionID: publisher.selectedPublisherSubmissionID,
    setPublisherSkills: publisher.setPublisherSkills,
    setSelectedPublisherSubmission: publisher.setSelectedPublisherSubmission,
    setSelectedPublisherSubmissionID: publisher.setSelectedPublisherSubmissionID
  });

  const adminActions = useWorkspaceAdminReviewActions({
    activePage: auth.activePage,
    authState: auth.authState,
    handleRemoteError: sessionFlow.handleRemoteError,
    requireAuthenticatedAction: sessionFlow.requireAuthenticatedAction,
    selectedReviewID: adminReview.selectedReviewID,
    setAdminSkills: adminReview.setAdminSkills,
    setAdminUsers: adminReview.setAdminUsers,
    setClientUpdateReleases: adminReview.setClientUpdateReleases,
    setDepartments: adminReview.setDepartments,
    setReviews: adminReview.setReviews,
    setSelectedDepartmentID: adminReview.setSelectedDepartmentID,
    setSelectedReview: adminReview.setSelectedReview,
    setSelectedReviewID: adminReview.setSelectedReviewID
  });

  useWorkspaceRemoteEffects({
    auth,
    localSync,
    market,
    derived,
    remoteMarketFilters,
    hydrateAuthenticatedState: sessionFlow.hydrateAuthenticatedState,
    handleRemoteError: sessionFlow.handleRemoteError,
    adminActions,
    publisherActions
  });

  const openSkill = useCallback(
    (skillID: string) => {
      market.setSelectedSkillID(skillID);
      openPage("market");
    },
    [market.setSelectedSkillID, openPage]
  );

  const changeOwnPassword = useCallback(
    async (input: { currentPassword: string; nextPassword: string }) => {
      try {
        await p1Client.changeOwnPassword(input);
        return { ok: true as const };
      } catch (error) {
        await sessionFlow.handleRemoteError(error, { reopenLogin: true });
        return {
          ok: false as const,
          error: error instanceof Error ? error.message : "修改密码失败，请稍后重试。"
        };
      }
    },
    [sessionFlow]
  );

  return {
    authState: auth.authState,
    loggedIn: auth.authState === "authenticated",
    loginModalOpen: auth.loginModalOpen,
    setLoginModalOpen: auth.setLoginModalOpen,
    bootstrap: { ...auth.bootstrap, counts: derived.counts },
    activePage: auth.activePage,
    setActivePage: openPage,
    openPage,
    visibleNavigation: derived.visibleNavigation,
    skills: market.skills,
    leaderboards: market.leaderboards,
    leaderboardsLoading: market.leaderboardsLoading,
    marketSkills: derived.marketSkills,
    installedSkills: derived.installedSkills,
    discoveredLocalSkills: derived.discoveredLocalSkills,
    selectedSkill: derived.selectedSkill,
    selectedSkillID: market.selectedSkillID,
    selectSkill: market.selectSkill,
    openSkill,
    tools: localSync.tools,
    localExtensions: localSync.extensions,
    projects: localSync.projects,
    localCentralStorePath: localSync.localCentralStorePath,
    scanTargets: localSync.scanTargets,
    notifications: localSync.notifications,
    offlineEvents: localSync.offlineEvents,
    filters: market.filters,
    setFilters: market.setFilters,
    departments: derived.departmentsFilter,
    compatibleTools: derived.compatibleTools,
    categories: derived.categories,
    tags: derived.tags,
    progress: market.progress,
    clearProgress: market.clearProgress,
    authError: auth.authError,
    login: sessionFlow.login,
    completeInitialPasswordChange: sessionFlow.completeInitialPasswordChange,
    logout: sessionFlow.logout,
    changeOwnPassword,
    refreshBootstrap: sessionFlow.refreshBootstrap,
    installOrUpdate: marketActions.installOrUpdate,
    importLocalSkill: marketActions.importLocalSkill,
    enableSkill: marketActions.enableSkill,
    disableSkill: marketActions.disableSkill,
    enableExtension: localActions.enableExtension,
    disableExtension: localActions.disableExtension,
    uninstallSkill: marketActions.uninstallSkill,
    saveToolConfig: localActions.saveToolConfig,
    deleteToolConfig: localActions.deleteToolConfig,
    saveProjectConfig: localActions.saveProjectConfig,
    deleteProjectConfig: localActions.deleteProjectConfig,
    toggleStar: marketActions.toggleStar,
    markNotificationsRead: localActions.markNotificationsRead,
    syncOfflineEvents: localActions.syncOfflineEvents,
    refreshTools: localActions.refreshTools,
    scanLocalTargets: localActions.scanLocalTargets,
    validateTargetPath: localActions.validateTargetPath,
    pickProjectDirectory: localActions.pickProjectDirectory,
    requireAuth: sessionFlow.requireAuth,
    apiBaseURL: p1Client.currentAPIBase(),
    currentUser: auth.bootstrap.user,
    isAdminConnected: derived.isAdminConnected,
    publisherData: {
      publisherSkills: publisher.publisherSkills,
      selectedPublisherSubmission: publisher.selectedPublisherSubmission,
      selectedPublisherSubmissionID: publisher.selectedPublisherSubmissionID,
      setSelectedPublisherSubmissionID: publisher.setSelectedPublisherSubmissionID,
      refreshPublisherData: publisherActions.refreshPublisherData,
      submitPublisherSubmission: publisherActions.submitPublisherSubmission,
      withdrawPublisherSubmission: publisherActions.withdrawPublisherSubmission,
      delistPublisherSkill: publisherActions.delistPublisherSkill,
      relistPublisherSkill: publisherActions.relistPublisherSkill,
      archivePublisherSkill: publisherActions.archivePublisherSkill,
      listSubmissionFiles: publisherActions.listPublisherSubmissionFiles,
      getSubmissionFileContent: publisherActions.getPublisherSubmissionFileContent
    },
    adminData: {
      departments: adminReview.departments,
      selectedDepartment: derived.selectedDepartment,
      setSelectedDepartmentID: adminReview.setSelectedDepartmentID,
      adminUsers: adminReview.adminUsers,
      clientUpdateReleases: adminReview.clientUpdateReleases,
      adminSkills: adminReview.adminSkills,
      reviews: adminReview.reviews,
      selectedReview: adminReview.selectedReview,
      selectedReviewID: adminReview.selectedReviewID,
      setSelectedReviewID: adminReview.setSelectedReviewID,
      refreshManageData: adminActions.refreshManageData,
      refreshReviews: adminActions.refreshReviews,
      claimReview: adminActions.claimReview,
      passPrecheck: adminActions.passPrecheck,
      approveReview: adminActions.approveReview,
      returnReview: adminActions.returnReview,
      rejectReview: adminActions.rejectReview,
      listReviewFiles: adminActions.listReviewFiles,
      getReviewFileContent: adminActions.getReviewFileContent,
      refreshClientUpdateReleases: adminActions.refreshClientUpdateReleases,
      pushClientUpdateExe: adminActions.pushClientUpdateExe,
      pauseClientUpdateRelease: adminActions.pauseClientUpdateRelease,
      createDepartment: adminActions.createDepartment,
      updateDepartment: adminActions.updateDepartment,
      deleteDepartment: adminActions.deleteDepartment,
      createAdminUser: adminActions.createAdminUser,
      updateAdminUser: adminActions.updateAdminUser,
      changeAdminUserPassword: adminActions.changeAdminUserPassword,
      freezeAdminUser: adminActions.freezeAdminUser,
      unfreezeAdminUser: adminActions.unfreezeAdminUser,
      deleteAdminUser: adminActions.deleteAdminUser,
      delistAdminSkill: adminActions.delistAdminSkill,
      relistAdminSkill: adminActions.relistAdminSkill,
      archiveAdminSkill: adminActions.archiveAdminSkill
    }
  };
}

export type P1WorkspaceState = ReturnType<typeof useP1Workspace>;
