import packageInfo from "../../package.json" with { type: "json" };
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DesktopModalState,
  NotificationListFilter,
  PageID,
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
import type { AppUpdateState, DesktopNotificationItem } from "./ui/desktopNotifications.ts";
import { deriveDesktopNotifications, notificationBadgeLabel, resolveDesktopNotificationAction } from "./ui/desktopNotifications.ts";
import type { InstalledListFilter } from "./ui/installedSkillsTypes.ts";
import type { DisplayLanguage } from "../ui/desktopShared.tsx";

export { buildPublishPrecheck } from "./ui/publishPrecheck.ts";
export { collectInstalledSkillIssues } from "./ui/installedSkillSelectors.ts";

export type TopLevelSection = "home" | "community" | "local" | "manage";
export type CommunityPane = "skills" | "mcp" | "plugins" | "publish" | "mine";
export type LocalPane = "skills" | "tools" | "projects";
export type ManagePane = "reviews" | "skills" | "departments" | "users";
export type PublisherPane = "compose" | "mine";

export type OverlayState =
  | { kind: "none" }
  | { kind: "skill_detail"; skillID: string; source: TopLevelSection }
  | { kind: "review_detail"; reviewID: string }
  | { kind: "publisher"; pane: PublisherPane };

export interface FlashMessage {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
}

export interface ConfirmModalState extends Exclude<DesktopModalState, { type: "none" | "targets" | "local_import" | "tool_editor" | "project_editor" | "connection_status" | "app_update" | "settings" }> {
  onConfirm?: () => Promise<void> | void;
}

export function presentModalWithDrawerDismissal(
  nextModal: DesktopModalState,
  handlers: {
    closeSkillDetail: () => void;
    setModal: (nextModal: DesktopModalState) => void;
  }
): void {
  handlers.closeSkillDetail();
  handlers.setModal(nextModal);
}

export function presentConfirmWithDrawerDismissal(
  nextConfirm: ConfirmModalState | null,
  handlers: {
    closeSkillDetail: () => void;
    setConfirmModal: (nextConfirm: ConfirmModalState | null) => void;
  }
): void {
  if (nextConfirm) {
    handlers.closeSkillDetail();
  }
  handlers.setConfirmModal(nextConfirm);
}

export function deriveTopLevelNavigation(input: {
  isAdminConnected: boolean;
}): TopLevelSection[] {
  return input.isAdminConnected ? ["home", "community", "local", "manage"] : ["home", "community", "local"];
}

export function mapLegacyPageToView(page: PageID): {
  section: TopLevelSection;
  communityPane?: CommunityPane;
  localPane?: LocalPane;
  managePane?: ManagePane;
} {
  switch (page) {
    case "market":
      return { section: "community", communityPane: "skills" };
    case "my_installed":
      return { section: "local", localPane: "skills" };
    case "target_management":
      return { section: "local", localPane: "tools" };
    case "review":
      return { section: "manage", managePane: "reviews" };
    case "admin_departments":
      return { section: "manage", managePane: "departments" };
    case "admin_users":
      return { section: "manage", managePane: "users" };
    case "admin_skills":
      return { section: "manage", managePane: "skills" };
    case "publisher":
      return { section: "community", communityPane: "mine" };
    case "notifications":
    case "home":
    case "detail":
    default:
      return { section: "home" };
  }
}

export function legacyPageForView(input: {
  section: TopLevelSection;
  communityPane: CommunityPane;
  localPane: LocalPane;
  managePane: ManagePane;
  overlay: OverlayState;
}): Exclude<PageID, "detail" | "notifications"> {
  if (input.overlay.kind === "publisher") return "publisher";
  if (input.overlay.kind === "review_detail") return "review";

  switch (input.section) {
    case "community":
      return input.communityPane === "publish" || input.communityPane === "mine" ? "publisher" : "market";
    case "local":
      return input.localPane === "skills" ? "my_installed" : "target_management";
    case "manage":
      switch (input.managePane) {
        case "reviews":
          return "review";
        case "skills":
          return "admin_skills";
        case "departments":
          return "admin_departments";
        case "users":
          return "admin_users";
      }
    case "home":
    default:
      return "home";
  }
}

export function skillDetailOverlay(skillID: string, source: TopLevelSection): OverlayState {
  return { kind: "skill_detail", skillID, source };
}

export function reviewDetailOverlay(reviewID: string): OverlayState {
  return { kind: "review_detail", reviewID };
}

function isDetailOverlay(overlay: OverlayState): boolean {
  return overlay.kind === "skill_detail" || overlay.kind === "review_detail";
}

function defaultAppUpdateState(): AppUpdateState {
  return {
    available: true,
    currentVersion: packageInfo.version,
    latestVersion: "0.1.3",
    summary: "顶栏导航、发布中心覆盖层和本地工作台重建。",
    highlights: [
      "一级导航收敛为主页、社区、本地、管理",
      "发布中心改为覆盖层工作台",
      "本地工具和项目统一收口到本地页"
    ],
    occurredAt: "2026-04-18T09:00:00.000Z",
    unread: true,
    releaseURL: null,
    actionLabel: "查看更新"
  };
}

export function useDesktopUIState(workspace: P1WorkspaceState) {
  const initialView = mapLegacyPageToView(workspace.activePage);
  const [activeSection, setActiveSection] = useState<TopLevelSection>(initialView.section);
  const [communityPane, setCommunityPane] = useState<CommunityPane>(initialView.communityPane ?? "skills");
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
  const [appUpdate, setAppUpdate] = useState<AppUpdateState>(() => defaultAppUpdateState());

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

  const closeSkillDetail = useCallback(() => {
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
  }, []);

  const clearFlash = useCallback(() => {
    setFlash(null);
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    setConfirmModal(null);
    workspace.clearProgress();
  }, [workspace]);

  const presentBlockingModal = useCallback((nextModal: DesktopModalState) => {
    presentModalWithDrawerDismissal(nextModal, { closeSkillDetail, setModal });
  }, [closeSkillDetail]);

  const presentBlockingConfirm = useCallback((nextConfirm: ConfirmModalState | null) => {
    presentConfirmWithDrawerDismissal(nextConfirm, { closeSkillDetail, setConfirmModal });
  }, [closeSkillDetail]);

  const goHome = useCallback(() => {
    setOverlay({ kind: "none" });
    setActiveSection("home");
  }, []);

  const navigateSection = useCallback((section: TopLevelSection) => {
    if (section === "manage" && !workspace.isAdminConnected) return;
    setOverlay((current) => (isDetailOverlay(current) ? { kind: "none" } : current));
    if (section === "community") {
      setCommunityPane("skills");
    }
    setActiveSection(section);
  }, [workspace.isAdminConnected]);

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

  const markAppUpdateRead = useCallback(() => {
    setAppUpdate((current) => (current.unread ? { ...current, unread: false } : current));
  }, []);

  const openAppUpdateModal = useCallback(() => {
    markAppUpdateRead();
    presentBlockingModal({ type: "app_update" });
  }, [markAppUpdateRead, presentBlockingModal]);

  const viewAppUpdate = useCallback(() => {
    if (appUpdate.releaseURL && typeof window !== "undefined") {
      window.open(appUpdate.releaseURL, "_blank", "noopener,noreferrer");
      markAppUpdateRead();
      return;
    }

    markAppUpdateRead();
    setFlash({
      tone: "info",
      title: "更新入口待接入",
      body: "当前版本先展示版本信息与更新说明，真实下载和升级流程后续接入。"
    });
  }, [appUpdate.releaseURL, markAppUpdateRead]);

  const markAllNotificationsRead = useCallback(async () => {
    markAppUpdateRead();
    await workspace.markNotificationsRead("all");
  }, [markAppUpdateRead, workspace]);

  const openDesktopNotification = useCallback(async (notification: DesktopNotificationItem) => {
    const readPromise = notification.rawNotificationID
      ? workspace.markNotificationsRead([notification.rawNotificationID])
      : Promise.resolve().then(markAppUpdateRead);

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
        workspace.adminData.setSelectedReviewID(action.reviewID);
      }
      openManagePane("reviews");
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
    markAppUpdateRead,
    openAppUpdateModal,
    openCommunityPane,
    openLocalPane,
    openManagePane,
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
    setModal: presentBlockingModal,
    setConfirmModal: (input) => presentBlockingConfirm(input),
    setFlash
  });

  const localConfigEditors = useLocalConfigEditors({
    workspace,
    closeModal,
    setModal: presentBlockingModal,
    setFlash
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
    viewAppUpdate,
    openConfirm,
    setNotificationFilter,
    setReviewTab,
    setInstalledFilter,
    setPreferences,
    openToolEditor: localConfigEditors.openToolEditor,
    openProjectEditor: localConfigEditors.openProjectEditor,
    pickProjectDirectoryForDraft: localConfigEditors.pickProjectDirectoryForDraft,
    setToolDraft: localConfigEditors.setToolDraft,
    setProjectDraft: localConfigEditors.setProjectDraft,
    submitToolDraft: localConfigEditors.submitToolDraft,
    submitProjectDraft: localConfigEditors.submitProjectDraft
  };
}

export type DesktopUIState = ReturnType<typeof useDesktopUIState>;
