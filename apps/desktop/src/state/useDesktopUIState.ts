import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DesktopModalState,
  NotificationListFilter,
  PreferenceState,
  ReviewBoardTab,
  SkillSummary
} from "../domain/p1.ts";
import type { P1WorkspaceState } from "./useP1Workspace.ts";
import { buildPublishPrecheck } from "./ui/publishPrecheck.ts";
import { defaultPreferences, loadPreferences, PREFERENCES_STORAGE_KEY, resolveDisplayLanguage } from "./ui/useDesktopPreferences.ts";
import { useTargetsModalState } from "./ui/useTargetsModalState.ts";
import { useLocalConfigEditors } from "./ui/useLocalConfigEditors.ts";
import { useInstalledSkillsView } from "./ui/useInstalledSkillsView.ts";
import type { DesktopNotificationItem } from "./ui/desktopNotifications.ts";
import { deriveDesktopNotifications, notificationBadgeLabel, resolveDesktopNotificationAction } from "./ui/desktopNotifications.ts";
import type { InstalledListFilter } from "./ui/installedSkillsTypes.ts";
import type { DisplayLanguage } from "../ui/desktopShared.tsx";
import {
  DEFAULT_COMMUNITY_PANE,
  deriveTopLevelNavigation,
  isDetailOverlay,
  legacyPageForView,
  mapLegacyPageToView,
  reviewDetailOverlay,
  shouldPromptLoginForSectionNavigation,
  skillDetailOverlay,
  type CommunityPane,
  type LocalPane,
  type ManagePane,
  type OverlayState,
  type PublisherPane,
  type TopLevelSection
} from "./ui/desktopNavigation.ts";
import type { FlashMessage } from "./ui/feedback.ts";
import { useAppUpdateFlow } from "./ui/useAppUpdateFlow.ts";
import {
  presentConfirmWithDrawerDismissal,
  presentModalWithDrawerDismissal,
  type ConfirmModalState
} from "./ui/modalPresentation.ts";

export { buildPublishPrecheck } from "./ui/publishPrecheck.ts";
export { collectInstalledSkillIssues } from "./ui/installedSkillSelectors.ts";
export { buildCommunityExploreFilters } from "./ui/communityExploreFilters.ts";
export { buildSettingsPanels } from "./ui/settingsPanels.ts";
export type { SettingsPanelSummary } from "./ui/settingsPanels.ts";
export { presentConfirmWithDrawerDismissal, presentModalWithDrawerDismissal } from "./ui/modalPresentation.ts";
export type { ConfirmModalState } from "./ui/modalPresentation.ts";
export type { FlashMessage } from "./ui/feedback.ts";
export {
  DEFAULT_COMMUNITY_PANE,
  canAccessClientUpdateManagement,
  deriveTopLevelNavigation,
  legacyPageForView,
  mapLegacyPageToView,
  reviewDetailOverlay,
  shouldPromptLoginForSectionNavigation,
  skillDetailOverlay
} from "./ui/desktopNavigation.ts";
export type { CommunityPane, LocalPane, ManagePane, OverlayState, PublisherPane, TopLevelSection } from "./ui/desktopNavigation.ts";

export function useDesktopUIState(workspace: P1WorkspaceState) {
  const initialView = mapLegacyPageToView(workspace.activePage);
  const [activeSection, setActiveSection] = useState<TopLevelSection>(initialView.section);
  const [communityPane, setCommunityPane] = useState<CommunityPane>(initialView.communityPane ?? DEFAULT_COMMUNITY_PANE);
  const [localPane, setLocalPane] = useState<LocalPane>(initialView.localPane ?? "skills");
  const [managePane, setManagePane] = useState<ManagePane>(initialView.managePane ?? "reviews");
  const [overlay, setOverlay] = useState<OverlayState>({ kind: "none" });

  const [notificationFilter, setNotificationFilter] = useState<NotificationListFilter>("all");
  const [reviewTab, setReviewTab] = useState<ReviewBoardTab>("pending");
  const [installedFilter, setInstalledFilter] = useState<InstalledListFilter>("all");
  const [preferences, setPreferences] = useState<PreferenceState>(() => loadPreferences());
  const [modal, setModal] = useState<DesktopModalState>({ type: "none" });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const language = useMemo<DisplayLanguage>(
    () => resolveDisplayLanguage(preferences, workspace.currentUser.locale),
    [preferences, workspace.currentUser.locale]
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    document.body.dataset.theme = preferences.theme;
    document.documentElement.lang = language;
  }, [language, preferences]);

  useEffect(() => {
    if (!preferences.syncLocalEvents) return;
    if (!workspace.loggedIn || workspace.bootstrap.connection.status !== "connected") return;
    if (workspace.offlineEvents.length === 0) return;
    void workspace.syncOfflineEvents();
  }, [
    preferences.syncLocalEvents,
    workspace.bootstrap.connection.status,
    workspace.loggedIn,
    workspace.offlineEvents.length,
    workspace.syncOfflineEvents
  ]);

  const closeSkillDetail = useCallback(() => {
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    setConfirmModal(null);
    workspace.clearProgress();
  }, [workspace]);

  const presentBlockingConfirm = useCallback((nextConfirm: ConfirmModalState | null) => {
    presentConfirmWithDrawerDismissal(nextConfirm, { closeSkillDetail, setConfirmModal });
  }, [closeSkillDetail]);

  const { appUpdate, dismissOptionalAppUpdate, recheckAppUpdate, viewAppUpdate } = useAppUpdateFlow({
    workspace,
    closeModal,
    presentBlockingConfirm,
    setFlash
  });

  const desktopNotifications = useMemo(
    () =>
      deriveDesktopNotifications({
        notifications:
          workspace.bootstrap.connection.status === "connected"
            ? workspace.notifications
            : workspace.notifications.filter((notification) => notification.source !== "server"),
        appUpdate
      }),
    [appUpdate, workspace.bootstrap.connection.status, workspace.notifications]
  );

  const visibleNotifications = useMemo(
    () => desktopNotifications.filter((notification) => notificationFilter === "all" || notification.unread),
    [desktopNotifications, notificationFilter]
  );

  const notificationUnreadCount = useMemo(
    () => desktopNotifications.filter((notification) => notification.unread).length,
    [desktopNotifications]
  );

  const notificationBadge = useMemo(
    () => notificationBadgeLabel(notificationUnreadCount),
    [notificationUnreadCount]
  );

  const filteredReviews = useMemo(
    () => workspace.adminData.reviews.filter((review) => (reviewTab === "pending" ? review.reviewStatus === "pending" : review.reviewStatus === reviewTab)),
    [reviewTab, workspace.adminData.reviews]
  );

  const installedView = useInstalledSkillsView(workspace, { installedFilter, setInstalledFilter });

  const navigationSections = useMemo(
    () => deriveTopLevelNavigation({ isAdminConnected: workspace.isAdminConnected }),
    [workspace.isAdminConnected]
  );

  const desiredLegacyPage = useMemo(
    () => legacyPageForView({ section: activeSection, communityPane, localPane, managePane, overlay }),
    [activeSection, communityPane, localPane, managePane, overlay]
  );

  useEffect(() => {
    if (desiredLegacyPage === "market" && !workspace.loggedIn) return;
    if (
      (desiredLegacyPage === "review" || desiredLegacyPage === "admin_departments" || desiredLegacyPage === "admin_users" || desiredLegacyPage === "admin_skills") &&
      !workspace.isAdminConnected
    ) {
      return;
    }
    if (workspace.activePage !== desiredLegacyPage) {
      workspace.openPage(desiredLegacyPage);
    }
  }, [desiredLegacyPage, workspace]);

  useEffect(() => {
    if (activeSection === "manage" && !workspace.isAdminConnected) {
      setActiveSection("home");
    }
  }, [activeSection, workspace.isAdminConnected]);

  const clearFlash = useCallback(() => {
    setFlash(null);
  }, []);

  const presentBlockingModal = useCallback((nextModal: DesktopModalState) => {
    presentModalWithDrawerDismissal(nextModal, { closeSkillDetail, setModal });
  }, [closeSkillDetail]);

  const goHome = useCallback(() => {
    setOverlay({ kind: "none" });
    setActiveSection("home");
  }, []);

  const applySectionNavigation = useCallback((section: TopLevelSection) => {
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
    if (section === "community") {
      setCommunityPane(DEFAULT_COMMUNITY_PANE);
    }
    setActiveSection(section);
  }, []);

  const navigateSection = useCallback((section: TopLevelSection) => {
    if (section === "manage" && !workspace.isAdminConnected) return;
    if (shouldPromptLoginForSectionNavigation({ section, loggedIn: workspace.loggedIn })) {
      workspace.requireAuth(workspace.activePage, () => {
        applySectionNavigation(section);
      });
      return;
    }
    applySectionNavigation(section);
  }, [applySectionNavigation, workspace]);

  const openCommunityPane = useCallback((pane: CommunityPane) => {
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
    setActiveSection("community");
    setCommunityPane(pane);
  }, []);

  const openLocalPane = useCallback((pane: LocalPane) => {
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
    setActiveSection("local");
    setLocalPane(pane);
  }, []);

  const openManagePane = useCallback((pane: ManagePane) => {
    if (!workspace.isAdminConnected) return;
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
    setActiveSection("manage");
    setManagePane(pane);
  }, [workspace.isAdminConnected]);

  const setPublisherPane = useCallback((pane: PublisherPane) => {
    openCommunityPane(pane === "compose" ? "publish" : "mine");
  }, [openCommunityPane]);

  const openSkillDetail = useCallback((skillID: string, source: TopLevelSection = activeSection) => {
    workspace.selectSkill(skillID);
    setOverlay(skillDetailOverlay(skillID, source));
  }, [activeSection, workspace]);

  const openReviewDetail = useCallback((reviewID: string) => {
    if (!workspace.isAdminConnected) return;
    workspace.adminData.setSelectedReviewID(reviewID);
    setActiveSection("manage");
    setManagePane("reviews");
    setOverlay(reviewDetailOverlay(reviewID));
  }, [workspace]);

  const closeOverlay = useCallback(() => {
    setOverlay({ kind: "none" });
  }, []);

  const openConnectionStatus = useCallback(() => {
    presentBlockingModal({ type: "connection_status" });
  }, [presentBlockingModal]);

  const openSettingsModal = useCallback(() => {
    presentBlockingModal({ type: "settings" });
  }, [presentBlockingModal]);

  const openConfirm = useCallback((input: Omit<NonNullable<ConfirmModalState>, "type">) => {
    presentBlockingConfirm({ type: "confirm", ...input });
  }, [presentBlockingConfirm]);

  const openAppUpdateModal = useCallback(() => {
    presentBlockingModal({ type: "app_update" });
  }, [presentBlockingModal]);

  const markAllNotificationsRead = useCallback(async () => {
    if (appUpdate.available && !appUpdate.blocking) {
      await dismissOptionalAppUpdate();
    }
    await workspace.markNotificationsRead("all");
  }, [appUpdate.available, appUpdate.blocking, dismissOptionalAppUpdate, workspace]);

  const openDesktopNotification = useCallback(async (notification: DesktopNotificationItem) => {
    const readPromise =
      notification.kind === "app_update"
        ? dismissOptionalAppUpdate()
        : notification.rawNotificationID
          ? workspace.markNotificationsRead([notification.rawNotificationID])
          : Promise.resolve();

    const action = resolveDesktopNotificationAction(notification, {
      publisherSubmissions: workspace.publisherData.publisherSkills.map((skill) => ({
        submissionID: skill.latestSubmissionID ?? null,
        skillID: skill.skillID
      })),
      reviews: workspace.adminData.reviews.map((review) => ({
        reviewID: review.reviewID,
        skillID: review.skillID
      }))
    });

    if (action.kind === "review") {
      if (action.reviewID) {
        openReviewDetail(action.reviewID);
      } else {
        openManagePane("reviews");
      }
      await readPromise;
      return;
    }

    if (action.kind === "publisher") {
      if (action.submissionID) {
        workspace.publisherData.setSelectedPublisherSubmissionID(action.submissionID);
      }
      openCommunityPane("mine");
      await readPromise;
      return;
    }

    if (action.kind === "my_installed") {
      setInstalledFilter(action.installedFilter);
      openLocalPane("skills");
      if (action.skillID) {
        workspace.selectSkill(action.skillID);
        openSkillDetail(action.skillID, "local");
      }
      await readPromise;
      return;
    }

    openAppUpdateModal();
    await readPromise;
  }, [
    dismissOptionalAppUpdate,
    openAppUpdateModal,
    openCommunityPane,
    openLocalPane,
    openManagePane,
    openReviewDetail,
    openSkillDetail,
    workspace
  ]);

  const openInstallConfirm = useCallback((skill: SkillSummary, operation: "install" | "update") => {
    const title = operation === "install" ? `安装 ${skill.displayName}` : `更新 ${skill.displayName}`;
    const body = operation === "install"
      ? "安装会下载包、校验 SHA-256，并写入 Central Store。"
      : skill.hasLocalHashDrift
        ? "检测到本地内容已变更，本次更新会覆盖 Central Store 中的本地内容。"
        : "更新会下载新包、校验 SHA-256，并覆盖 Central Store 中的旧版本。";
    presentBlockingConfirm({
      type: "confirm",
      title,
      body,
      confirmLabel: operation === "install" ? "确认安装" : "确认更新",
      tone: operation === "install" ? "primary" : "danger",
      detailLines: [
        `市场版本：${skill.version}`,
        `当前本地版本：${skill.localVersion ?? "未安装"}`,
        `风险等级：${skill.riskLevel}`
      ],
      onConfirm: async () => {
        closeModal();
        await workspace.installOrUpdate(skill.skillID, operation);
      }
    });
  }, [closeModal, presentBlockingConfirm, workspace]);

  const openUninstallConfirm = useCallback((skill: SkillSummary) => {
    const referencedTargets = skill.enabledTargets.map((target) => `${target.targetName} · ${target.targetPath}`);
    presentBlockingConfirm({
      type: "confirm",
      title: `卸载 ${skill.displayName}`,
      body: "卸载会删除 Central Store 中的本地副本，并移除当前已托管的目标位置。",
      confirmLabel: "确认卸载",
      tone: "danger",
      detailLines: [
        `当前本地版本：${skill.localVersion ?? "未安装"}`,
        referencedTargets.length > 0 ? "将移除以下启用位置：" : "当前没有启用位置。",
        ...referencedTargets
      ],
      onConfirm: async () => {
        closeModal();
        await workspace.uninstallSkill(skill.skillID);
      }
    });
  }, [closeModal, presentBlockingConfirm, workspace]);

  const openLocalImportModal = useCallback((skillID: string) => {
    presentBlockingModal({ type: "local_import", skillID });
  }, [presentBlockingModal]);

  const targetsModalState = useTargetsModalState({
    language,
    workspace,
    closeModal,
    showInstallResults: preferences.showInstallResults,
    setModal: presentBlockingModal,
    setConfirmModal: (input) => presentBlockingConfirm(input),
    setFlash
  });

  const localConfigEditors = useLocalConfigEditors({
    workspace,
    closeModal,
    setModal: presentBlockingModal,
    setFlash,
    openConfirm
  });

  return {
    activeSection,
    communityPane,
    localPane,
    managePane,
    overlay,
    modal,
    confirmModal,
    flash,
    language,
    notificationFilter,
    reviewTab,
    installedFilter,
    preferences,
    appUpdate,
    navigationSections,
    desktopNotifications,
    visibleNotifications,
    notificationUnreadCount,
    notificationBadge,
    filteredReviews,
    toolDraft: localConfigEditors.toolDraft,
    projectDraft: localConfigEditors.projectDraft,
    targetDrafts: targetsModalState.targetDrafts,
    installedView,

    clearFlash,
    closeModal,
    closeOverlay,
    closeSkillDetail,
    goHome,
    navigateSection,
    openCommunityPane,
    openLocalPane,
    openManagePane,
    setCommunityPane,
    setLocalPane,
    setManagePane,
    setPublisherPane,
    openSkillDetail,
    openReviewDetail,
    openDesktopNotification,
    openInstallConfirm,
    openUninstallConfirm,
    openLocalImportModal,
    openTargetsModal: targetsModalState.openTargetsModal,
    toggleTargetDraft: targetsModalState.toggleTargetDraft,
    applyTargetDrafts: targetsModalState.applyTargetDrafts,
    openConnectionStatus,
    openSettingsModal,
    openAppUpdateModal,
    markAllNotificationsRead,
    dismissOptionalAppUpdate,
    recheckAppUpdate,
    viewAppUpdate,
    openConfirm,
    setNotificationFilter,
    setReviewTab,
    setInstalledFilter,
    setPreferences,
    openToolEditor: localConfigEditors.openToolEditor,
    openProjectEditor: localConfigEditors.openProjectEditor,
    pickProjectDirectoryForDraft: localConfigEditors.pickProjectDirectoryForDraft,
    confirmDeleteToolConfig: localConfigEditors.confirmDeleteToolConfig,
    confirmDeleteProjectConfig: localConfigEditors.confirmDeleteProjectConfig,
    setToolDraft: localConfigEditors.setToolDraft,
    setProjectDraft: localConfigEditors.setProjectDraft,
    submitToolDraft: localConfigEditors.submitToolDraft,
    submitProjectDraft: localConfigEditors.submitProjectDraft
  };
}

export type DesktopUIState = ReturnType<typeof useDesktopUIState>;
