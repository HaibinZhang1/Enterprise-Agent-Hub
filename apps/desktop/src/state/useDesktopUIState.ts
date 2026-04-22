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
import type { DesktopNotificationItem } from "./ui/desktopNotifications.ts";
import { deriveDesktopNotifications, notificationBadgeLabel, resolveDesktopNotificationAction } from "./ui/desktopNotifications.ts";
import {
  cacheClientUpdateCheck,
  defaultAppUpdateState,
  deriveAppUpdateState,
  dismissOptionalClientUpdate,
  extractServerAppUpdateNotification,
  readClientUpdateCache,
  resolveClientUpdateDeviceID,
  shouldUseCachedClientUpdate,
  writeClientUpdateCache,
  type AppUpdateState,
  type ClientUpdateCache
} from "./ui/clientUpdates.ts";
import type { InstalledListFilter } from "./ui/installedSkillsTypes.ts";
import type { DisplayLanguage } from "../ui/desktopShared.tsx";
import { clearRemoteWriteGuardStatus, p1Client, setRemoteWriteGuardStatus } from "../services/p1Client.ts";
import { prepareClientUpdateInstall, launchPreparedClientUpdateInstall } from "../services/clientUpdateFlow.ts";
import { desktopBridge } from "../services/tauriBridge.ts";
import { themeLabel } from "../ui/themeLabels.ts";

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

export interface SettingsPanelSummary {
  id: "general" | "agent" | "local" | "sync" | "about";
  title: string;
  description: string;
  status: string;
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
  return input.isAdminConnected ? ["community", "home", "local", "manage"] : ["community", "home", "local"];
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

function appUpdateSettingsStatus(appUpdate: AppUpdateState): string {
  if (appUpdate.status === "mandatory_update") return "必须更新";
  if (appUpdate.status === "unsupported_version") return "版本过低";
  return appUpdate.available ? "有更新" : "已是最新";
}

export function buildSettingsPanels(input: {
  language: DisplayLanguage;
  theme: PreferenceState["theme"];
  hasAgentKey: boolean;
  connectionStatus: P1WorkspaceState["bootstrap"]["connection"]["status"];
  appUpdate: AppUpdateState;
}): SettingsPanelSummary[] {
  return [
    { id: "general", title: "常规偏好", description: "语言、主题", status: themeLabel(input.theme, input.language) },
    { id: "agent", title: "Agent 接入", description: "模型服务、API Key", status: input.hasAgentKey ? "已保存" : "待配置" },
    { id: "local", title: "本地环境", description: "Central Store、服务地址", status: input.connectionStatus === "connected" ? "已连接" : "本地可用" },
    { id: "sync", title: "同步与更新", description: "通知、启动上下文", status: appUpdateSettingsStatus(input.appUpdate) },
    { id: "about", title: "关于", description: "软件信息、版本、仓库", status: `v${input.appUpdate.currentVersion}` }
  ];
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
  const [clientUpdateCache, setClientUpdateCache] = useState<ClientUpdateCache | null>(() => readClientUpdateCache());
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [processingAppUpdate, setProcessingAppUpdate] = useState(false);
  const [appUpdateError, setAppUpdateError] = useState<string | null>(null);

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

  const appUpdate = useMemo(
    () =>
      deriveAppUpdateState({
        currentVersion: packageInfo.version,
        cache: clientUpdateCache,
        notifications: workspace.notifications,
        lastError: appUpdateError,
        checking: checkingAppUpdate || processingAppUpdate
      }),
    [appUpdateError, checkingAppUpdate, clientUpdateCache, processingAppUpdate, workspace.notifications]
  );

  const refreshAppUpdate = useCallback(async (options: { force?: boolean } = {}) => {
    if (!workspace.loggedIn || workspace.bootstrap.connection.status !== "connected") {
      clearRemoteWriteGuardStatus();
      return null;
    }

    if (!options.force && shouldUseCachedClientUpdate(clientUpdateCache, packageInfo.version)) {
      setAppUpdateError(null);
      return clientUpdateCache;
    }

    setCheckingAppUpdate(true);
    try {
      const checkResult = await p1Client.checkClientUpdate({
        currentVersion: packageInfo.version,
        platform: "windows",
        arch: "x64",
        channel: "stable",
        deviceID: resolveClientUpdateDeviceID(),
        dismissedVersion: clientUpdateCache?.dismissedVersion ?? null
      });
      const nextCache = cacheClientUpdateCheck(checkResult, clientUpdateCache);
      setClientUpdateCache(nextCache);
      writeClientUpdateCache(nextCache);
      setAppUpdateError(null);
      return nextCache;
    } catch (error) {
      setAppUpdateError(error instanceof Error ? error.message : "检查更新失败，请稍后重试。");
      return null;
    } finally {
      setCheckingAppUpdate(false);
    }
  }, [clientUpdateCache, workspace.bootstrap.connection.status, workspace.loggedIn]);

  const dismissOptionalAppUpdate = useCallback(async () => {
    if (!appUpdate.available || appUpdate.blocking) return;
    const nextCache = dismissOptionalClientUpdate(clientUpdateCache, appUpdate);
    setClientUpdateCache(nextCache);
    writeClientUpdateCache(nextCache);

    const serverNotificationIDs = workspace.notifications
      .filter((notification) => {
        const serverNotice = extractServerAppUpdateNotification(notification);
        return serverNotice?.releaseID === appUpdate.releaseID && serverNotice.latestVersion === appUpdate.latestVersion;
      })
      .map((notification) => notification.notificationID);

    if (serverNotificationIDs.length > 0) {
      await workspace.markNotificationsRead(serverNotificationIDs);
    }
  }, [appUpdate, clientUpdateCache, workspace]);

  useEffect(() => {
    if (!workspace.loggedIn || workspace.bootstrap.connection.status !== "connected") {
      clearRemoteWriteGuardStatus();
      setCheckingAppUpdate(false);
      return;
    }
    void refreshAppUpdate();
  }, [refreshAppUpdate, workspace.bootstrap.connection.status, workspace.loggedIn]);

  useEffect(() => {
    if (workspace.loggedIn && workspace.bootstrap.connection.status === "connected" && (appUpdate.status === "mandatory_update" || appUpdate.status === "unsupported_version")) {
      setRemoteWriteGuardStatus(appUpdate.status);
      return;
    }
    clearRemoteWriteGuardStatus();
  }, [appUpdate.status, workspace.bootstrap.connection.status, workspace.loggedIn]);

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

  const openAppUpdateModal = useCallback(() => {
    presentBlockingModal({ type: "app_update" });
  }, [presentBlockingModal]);

  const viewAppUpdate = useCallback(async () => {
    if (processingAppUpdate) {
      return;
    }

    const releaseID = appUpdate.releaseID;
    if (!appUpdate.available || !releaseID) {
      setFlash({
        tone: "warning",
        title: "更新信息不完整",
        body: "请先重新检查更新，再继续安装。"
      });
      return;
    }

    const deviceID = resolveClientUpdateDeviceID();
    setProcessingAppUpdate(true);
    try {
      setFlash({
        tone: "info",
        title: "正在准备升级",
        body: "正在申请下载票据并校验更新包，请稍候。"
      });
      const prepared = await prepareClientUpdateInstall(
        {
          currentVersion: appUpdate.currentVersion,
          latestVersion: appUpdate.latestVersion,
          releaseID,
          deviceID,
          packageName: appUpdate.packageName,
          sizeBytes: appUpdate.sizeBytes,
          sha256: appUpdate.sha256
        },
        {
          requestClientUpdateDownloadTicket: p1Client.requestClientUpdateDownloadTicket,
          reportClientUpdateEvent: p1Client.reportClientUpdateEvent,
          downloadClientUpdate: desktopBridge.downloadClientUpdate,
          verifyClientUpdate: desktopBridge.verifyClientUpdate
        }
      );
      setProcessingAppUpdate(false);
      closeModal();
      presentBlockingConfirm({
        type: "confirm",
        title: `安装桌面客户端 ${appUpdate.latestVersion}`,
        body: "更新包已下载并通过校验。确认后将启动系统安装程序，安装过程中可能需要关闭当前客户端。",
        confirmLabel: "启动安装程序",
        tone: appUpdate.blocking ? "danger" : "primary",
        detailLines: [
          `当前版本：${appUpdate.currentVersion}`,
          `目标版本：${appUpdate.latestVersion}`,
          prepared.downloadTicket.packageName ? `安装包：${prepared.downloadTicket.packageName}` : null,
          prepared.downloadTicket.sizeBytes ? `大小：${prepared.downloadTicket.sizeBytes} 字节` : null,
          prepared.verificationResult.signatureStatus ? `签名状态：${prepared.verificationResult.signatureStatus}` : null
        ].filter((line): line is string => Boolean(line)),
        onConfirm: async () => {
          setProcessingAppUpdate(true);
          try {
            await launchPreparedClientUpdateInstall(
              {
                currentVersion: appUpdate.currentVersion,
                latestVersion: appUpdate.latestVersion,
                releaseID,
                deviceID,
                packageName: appUpdate.packageName,
                sizeBytes: appUpdate.sizeBytes,
                sha256: appUpdate.sha256,
                downloadResult: prepared.downloadResult
              },
              {
                reportClientUpdateEvent: p1Client.reportClientUpdateEvent,
                launchClientInstaller: desktopBridge.launchClientInstaller
              }
            );
            closeModal();
            setFlash({
              tone: "success",
              title: "安装程序已启动",
              body: "安装完成并重新启动后，客户端会自动上报已安装版本并清除更新提示。"
            });
          } catch (error) {
            setFlash({
              tone: "warning",
              title: "启动安装程序失败",
              body: error instanceof Error ? error.message : "请稍后重试。"
            });
          } finally {
            setProcessingAppUpdate(false);
          }
        }
      });
    } catch (error) {
      setFlash({
        tone: "warning",
        title: "准备升级失败",
        body: error instanceof Error ? error.message : "请稍后重试。"
      });
    } finally {
      setProcessingAppUpdate(false);
    }
  }, [
    appUpdate.available,
    appUpdate.blocking,
    appUpdate.currentVersion,
    appUpdate.latestVersion,
    appUpdate.packageName,
    appUpdate.releaseID,
    appUpdate.sha256,
    appUpdate.sizeBytes,
    closeModal,
    p1Client,
    presentBlockingConfirm,
    processingAppUpdate
  ]);

  const recheckAppUpdate = useCallback(async () => {
    const refreshed = await refreshAppUpdate({ force: true });
    if (refreshed) {
      setFlash({
        tone: "success",
        title: "更新状态已刷新",
        body: "已按最新服务端状态刷新桌面客户端更新信息。"
      });
      return;
    }
    setFlash({
      tone: "warning",
      title: "检查更新失败",
      body: appUpdateError ?? "请稍后重试。"
    });
  }, [appUpdateError, refreshAppUpdate]);

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
    dismissOptionalAppUpdate,
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
    setToolDraft: localConfigEditors.setToolDraft,
    setProjectDraft: localConfigEditors.setProjectDraft,
    submitToolDraft: localConfigEditors.submitToolDraft,
    submitProjectDraft: localConfigEditors.submitProjectDraft
  };
}

export type DesktopUIState = ReturnType<typeof useDesktopUIState>;
