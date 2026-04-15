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
      if (page === "market" && auth.authState !== "authenticated") {
        sessionFlow.requireAuth(page);
        return;
      }
      if (page === "manage" || page === "review") {
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
    persistNotifications: localSync.persistNotifications,
    refreshLocalBootstrap: localSync.refreshLocalBootstrap,
    refreshLocalScans: localSync.refreshLocalScans,
    requireAuthenticatedAction: sessionFlow.requireAuthenticatedAction,
    setNotifications: localSync.setNotifications,
    setOfflineEvents: localSync.setOfflineEvents,
    setProjects: localSync.setProjects,
    setTools: localSync.setTools
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
    marketSkills: derived.marketSkills,
    installedSkills: derived.installedSkills,
    discoveredLocalSkills: derived.discoveredLocalSkills,
    selectedSkill: derived.selectedSkill,
    selectedSkillID: market.selectedSkillID,
    selectSkill: market.selectSkill,
    openSkill,
    tools: localSync.tools,
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
    progress: market.progress,
    clearProgress: market.clearProgress,
    authError: auth.authError,
    login: sessionFlow.login,
    logout: sessionFlow.logout,
    refreshBootstrap: sessionFlow.refreshBootstrap,
    installOrUpdate: marketActions.installOrUpdate,
    enableSkill: marketActions.enableSkill,
    disableSkill: marketActions.disableSkill,
    uninstallSkill: marketActions.uninstallSkill,
    saveToolConfig: localActions.saveToolConfig,
    saveProjectConfig: localActions.saveProjectConfig,
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
      adminSkills: adminReview.adminSkills,
      reviews: adminReview.reviews,
      selectedReview: adminReview.selectedReview,
      selectedReviewID: adminReview.selectedReviewID,
      setSelectedReviewID: adminReview.setSelectedReviewID,
      manageSection: adminReview.manageSection,
      setManageSection: adminReview.setManageSection,
      refreshManageData: adminActions.refreshManageData,
      refreshReviews: adminActions.refreshReviews,
      claimReview: adminActions.claimReview,
      passPrecheck: adminActions.passPrecheck,
      approveReview: adminActions.approveReview,
      returnReview: adminActions.returnReview,
      rejectReview: adminActions.rejectReview,
      listReviewFiles: adminActions.listReviewFiles,
      getReviewFileContent: adminActions.getReviewFileContent,
      createDepartment: adminActions.createDepartment,
      updateDepartment: adminActions.updateDepartment,
      deleteDepartment: adminActions.deleteDepartment,
      createAdminUser: adminActions.createAdminUser,
      updateAdminUser: adminActions.updateAdminUser,
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
