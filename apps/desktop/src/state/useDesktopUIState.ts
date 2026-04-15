import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DesktopModalState,
  NotificationListFilter,
  PreferenceState,
  ReviewBoardTab,
  SkillSummary,
} from "../domain/p1.ts";
import type { P1WorkspaceState } from "./useP1Workspace.ts";
import type { DisplayLanguage } from "../ui/desktopShared.tsx";
import { buildPublishPrecheck } from "./ui/publishPrecheck.ts";
import { defaultPreferences, loadPreferences, PREFERENCES_STORAGE_KEY, resolveDisplayLanguage } from "./ui/useDesktopPreferences.ts";
import { useDesktopNavigation } from "./ui/useDesktopNavigation.ts";
import { useTargetsModalState } from "./ui/useTargetsModalState.ts";
import { useLocalConfigEditors } from "./ui/useLocalConfigEditors.ts";
export { buildPublishPrecheck } from "./ui/publishPrecheck.ts";
export { collectInstalledSkillIssues } from "./ui/installedSkillSelectors.ts";

interface FlashMessage {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
}

interface ConfirmModalState extends Exclude<DesktopModalState, { type: "none" | "targets" | "tool_editor" | "project_editor" | "connection_status" | "settings" }> {
  onConfirm?: () => Promise<void> | void;
}

export function useDesktopUIState(workspace: P1WorkspaceState) {
  const [notificationFilter, setNotificationFilter] = useState<NotificationListFilter>("all");
  const [reviewTab, setReviewTab] = useState<ReviewBoardTab>("pending");
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

  const filteredNotifications = useMemo(
    () => workspace.notifications.filter((notification) => notificationFilter === "all" || notification.unread),
    [notificationFilter, workspace.notifications]
  );

  const filteredReviews = useMemo(
    () => workspace.adminData.reviews.filter((review) => (reviewTab === "pending" ? review.reviewStatus === "pending" : review.reviewStatus === reviewTab)),
    [reviewTab, workspace.adminData.reviews]
  );

  const visibleSkillDetail = useMemo(
    () => workspace.selectedSkill ?? workspace.marketSkills[0] ?? workspace.installedSkills[0] ?? null,
    [workspace.installedSkills, workspace.marketSkills, workspace.selectedSkill]
  );

  const clearFlash = useCallback(() => {
    setFlash(null);
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    setConfirmModal(null);
    workspace.clearProgress();
  }, [workspace]);

  const navigationState = useDesktopNavigation({
    workspace,
    visibleSkillDetail,
    setModal
  });



  const openInstallConfirm = useCallback((skill: SkillSummary, operation: "install" | "update") => {
    const title = operation === "install" ? `安装 ${skill.displayName}` : `更新 ${skill.displayName}`;
    const body = operation === "install"
      ? "安装会下载包、校验 SHA-256，并写入 Central Store。"
      : skill.hasLocalHashDrift
        ? "检测到本地内容已变更，本次更新会直接覆盖 Central Store 中的本地内容。"
        : "更新会下载新包、校验 SHA-256，并覆盖 Central Store 中的旧版本。";
    setConfirmModal({
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
  }, [closeModal, workspace]);

  const openUninstallConfirm = useCallback((skill: SkillSummary) => {
    const referencedTargets = skill.enabledTargets.map((target) => `${target.targetName} · ${target.targetPath}`);
    setConfirmModal({
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
  }, [closeModal, workspace]);

  const targetsModalState = useTargetsModalState({
    workspace,
    closeModal,
    setModal,
    setConfirmModal: (input) => setConfirmModal(input),
    setFlash
  });

  const openConnectionStatus = useCallback(() => {
    setModal({ type: "connection_status" });
  }, []);

  const openSettingsModal = useCallback(() => {
    setModal({ type: "settings" });
  }, []);

  const openConfirm = useCallback((input: Omit<NonNullable<ConfirmModalState>, "type">) => {
    setConfirmModal({ type: "confirm", ...input });
  }, []);

  const localConfigEditors = useLocalConfigEditors({
    workspace,
    closeModal,
    setModal,
    setFlash
  });

  return {
    activePage: navigationState.activePage,
    navigation: navigationState.navigation,
    lastShellPage: navigationState.lastShellPage,
    drawerOpen: navigationState.drawerOpen,
    drawerSkill: navigationState.drawerSkill,
    modal,
    confirmModal,
    flash,
    language,
    notificationFilter,
    reviewTab,
    preferences,
    toolDraft: localConfigEditors.toolDraft,
    projectDraft: localConfigEditors.projectDraft,
    targetDrafts: targetsModalState.targetDrafts,
    filteredNotifications,
    filteredReviews,

    clearFlash,
    closeModal,
    navigate: navigationState.navigate,
    openSkillDetail: navigationState.openSkillDetail,
    closeSkillDetail: navigationState.closeSkillDetail,
    openInstallConfirm,
    openUninstallConfirm,
    openTargetsModal: targetsModalState.openTargetsModal,
    toggleTargetDraft: targetsModalState.toggleTargetDraft,
    applyTargetDrafts: targetsModalState.applyTargetDrafts,
    openConnectionStatus,
    openSettingsModal,
    openConfirm,
    setNotificationFilter,
    setReviewTab,
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
