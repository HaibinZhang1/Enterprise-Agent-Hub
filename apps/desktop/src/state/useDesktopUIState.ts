import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActionAvailability,
  DesktopModalState,
  NavigationPageID,
  NotificationListFilter,
  PreferenceState,
  ProjectDraft,
  PublishDraft,
  PublishPrecheckResult,
  ReviewBoardTab,
  SkillSummary,
  TargetDraft,
  ToolDraft
} from "../domain/p1.ts";
import { PendingBackendError, PendingLocalCommandError } from "../domain/p1.ts";
import { prototypeActionClient } from "../services/prototypeActionClient.ts";
import type { P1WorkspaceState } from "./useP1Workspace.ts";

const PREFERENCES_STORAGE_KEY = "enterprise-agent-hub:desktop-preferences";

const defaultPreferences: PreferenceState = {
  language: "auto",
  autoDetectLanguage: true,
  theme: "classic",
  showInstallResults: true,
  syncLocalEvents: true
};

const defaultToolDraft: ToolDraft = {
  name: "",
  configPath: "",
  skillsPath: "",
  enabled: true
};

const defaultProjectDraft: ProjectDraft = {
  name: "",
  projectPath: "",
  skillsPath: "",
  enabled: true
};

export type InstalledListFilter = "all" | "enabled" | "updates" | "scope_restricted" | "issues";

interface FlashMessage {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
}

interface ConfirmModalState extends Exclude<DesktopModalState, { type: "none" | "targets" | "tool_editor" | "project_editor" | "connection_status" }> {
  onConfirm?: () => Promise<void> | void;
}

function loadPreferences(): PreferenceState {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return defaultPreferences;
  try {
    return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<PreferenceState>) };
  } catch {
    return defaultPreferences;
  }
}

function buildPendingAvailability(kind: ActionAvailability["kind"], label: string, reason: string): ActionAvailability {
  return { kind, label, reason };
}

function buildTargetDrafts(skill: SkillSummary, workspace: P1WorkspaceState): TargetDraft[] {
  const enabledKeys = new Set(skill.enabledTargets.map((target) => `${target.targetType}:${target.targetID}`));
  const toolDrafts = workspace.tools.map((tool) => {
    const live = tool.toolID === "codex";
    return {
      key: `tool:${tool.toolID}`,
      targetType: "tool" as const,
      targetID: tool.toolID,
      targetName: tool.name,
      targetPath: tool.skillsPath,
      disabled: !tool.enabled || tool.status === "missing" || tool.status === "invalid",
      statusLabel: tool.enabled ? tool.status : "disabled",
      selected: enabledKeys.has(`tool:${tool.toolID}`),
      availability: live
        ? { kind: "live" as const, label: "已接入", reason: "当前可直接调用 Tauri 命令配置该目标。" }
        : buildPendingAvailability("pending_local_command", "待接入", "该目标的本地配置命令尚未落地。")
    };
  });

  const projectDrafts = workspace.projects.map((project) => ({
    key: `project:${project.projectID}`,
    targetType: "project" as const,
    targetID: project.projectID,
    targetName: project.name,
    targetPath: project.skillsPath,
    disabled: !project.enabled,
    statusLabel: project.enabled ? "项目级优先" : "已停用",
    selected: enabledKeys.has(`project:${project.projectID}`),
    availability: project.enabled
      ? { kind: "live" as const, label: "已接入", reason: "项目级目标已接到 Tauri SQLite 真源与分发命令。" }
      : buildPendingAvailability("pending_local_command", "待接入", "启用项目后才可作为目标使用。")
  }));

  return [...toolDrafts, ...projectDrafts];
}

function uniq(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

export function collectInstalledSkillIssues(skill: SkillSummary, workspace: Pick<P1WorkspaceState, "tools" | "projects">): string[] {
  const issues: string[] = [];

  if (skill.hasLocalHashDrift) {
    issues.push("本地内容已变更，更新时会直接覆盖。");
  }

  for (const target of skill.enabledTargets) {
    if (target.lastError) {
      issues.push(target.lastError);
    }

    if (target.targetType === "tool") {
      const tool = workspace.tools.find((item) => item.toolID === target.targetID);
      if (!tool) {
        issues.push(`${target.targetName} 目标已不存在，请重新启用或停用。`);
        continue;
      }
      if (!tool.enabled || tool.status === "disabled") {
        issues.push(`${target.targetName} 已停用，当前启用位置不可用。`);
      } else if (tool.status === "missing") {
        issues.push(`${target.targetName} 未检测到，请修复路径后再启用。`);
      } else if (tool.status === "invalid") {
        issues.push(`${target.targetName} 路径不可用，请修改路径。`);
      }
    }

    if (target.targetType === "project") {
      const project = workspace.projects.find((item) => item.projectID === target.targetID);
      if (!project) {
        issues.push(`${target.targetName} 项目已移除，请重新配置项目路径。`);
        continue;
      }
      if (!project.enabled) {
        issues.push(`${target.targetName} 已停用，项目级启用不再生效。`);
      }
    }
  }

  return uniq(issues);
}

function matchesInstalledFilter(skill: SkillSummary, filter: InstalledListFilter, issues: string[]): boolean {
  switch (filter) {
    case "enabled":
      return skill.enabledTargets.length > 0;
    case "updates":
      return skill.installState === "update_available";
    case "scope_restricted":
      return skill.isScopeRestricted;
    case "issues":
      return issues.length > 0;
    case "all":
    default:
      return true;
  }
}

export function buildPublishPrecheck(draft: PublishDraft): PublishPrecheckResult {
  const totalSize = draft.files.reduce((sum, file) => sum + file.size, 0);
  const hasFolderSkillFile = draft.uploadMode === "folder" && draft.files.some((file) => file.name.endsWith("SKILL.md"));
  const zipSelected = draft.uploadMode === "zip" && draft.files.length === 1;
  const versionValid = /^\d+\.\d+\.\d+$/.test(draft.version.trim());
  const sizeUnderLimit = totalSize > 0 && totalSize <= 5 * 1024 * 1024;
  const fileCountKnown = draft.uploadMode === "folder";
  const fileCountUnderLimit = !fileCountKnown || draft.files.length <= 100;

  const items: PublishPrecheckResult["items"] = [
    {
      id: "skill-doc",
      label: "存在 SKILL.md",
      status: hasFolderSkillFile ? "pass" : zipSelected ? "pending" : "warn",
      message: hasFolderSkillFile ? "已在目录中找到 SKILL.md。" : zipSelected ? "ZIP 内容需由后端或 Tauri 解压后校验。" : "上传目录时需要包含 SKILL.md。"
    },
    {
      id: "semver",
      label: "SemVer 合法",
      status: versionValid ? "pass" : "warn",
      message: versionValid ? "版本号格式符合 x.y.z。" : "版本号需使用 x.y.z 格式。"
    },
    {
      id: "size",
      label: "包小于 5MB",
      status: draft.files.length === 0 ? "pending" : sizeUnderLimit ? "pass" : "warn",
      message: draft.files.length === 0 ? "选择 ZIP 或文件夹后可校验体积。" : sizeUnderLimit ? "当前前端可见文件总大小在限制内。" : "当前前端可见文件总大小已超出 5MB。"
    },
    {
      id: "count",
      label: "文件数小于 100",
      status: draft.files.length === 0 ? "pending" : fileCountUnderLimit ? "pass" : "warn",
      message: draft.files.length === 0
        ? "选择文件后可校验数量。"
        : fileCountKnown
          ? `当前目录共 ${draft.files.length} 个文件。`
          : "ZIP 内部文件数需由后端或 Tauri 解压后校验。"
    },
    {
      id: "risk",
      label: "脚本风险待人工复核",
      status: "pending" as const,
      message: "风险脚本扫描与深层结构校验由后端或 Tauri 接手。"
    }
  ];

  const canSubmit =
    draft.skillID.trim().length > 0 &&
    draft.displayName.trim().length > 0 &&
    versionValid &&
    draft.changelog.trim().length > 0 &&
    draft.files.length > 0 &&
    sizeUnderLimit &&
    fileCountUnderLimit;

  return { items, canSubmit };
}

function mapPendingError(error: PendingBackendError | PendingLocalCommandError): FlashMessage {
  return {
    tone: "warning",
    title: error.code === "pending_backend" ? "后端待接入" : "本地命令待接入",
    body: error.message
  };
}

function isShellPage(page: NavigationPageID | "detail"): page is NavigationPageID {
  return page !== "detail";
}

export function useDesktopUIState(workspace: P1WorkspaceState) {
  const [activePage, setActivePage] = useState<NavigationPageID | "detail">("home");
  const [lastShellPage, setLastShellPage] = useState<NavigationPageID>("home");
  const [notificationFilter, setNotificationFilter] = useState<NotificationListFilter>("all");
  const [reviewTab, setReviewTab] = useState<ReviewBoardTab>("pending");
  const [preferences, setPreferences] = useState<PreferenceState>(() => loadPreferences());
  const [installedQuery, setInstalledQuery] = useState("");
  const [installedFilter, setInstalledFilter] = useState<InstalledListFilter>("all");
  const [toolDraft, setToolDraft] = useState<ToolDraft>(defaultToolDraft);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>([]);
  const [modal, setModal] = useState<DesktopModalState>({ type: "none" });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    document.body.dataset.theme = preferences.theme;
  }, [preferences]);

  useEffect(() => {
    if (activePage === "review" && !workspace.visibleNavigation.includes("review")) {
      setActivePage("home");
    }
    if (activePage === "manage" && !workspace.visibleNavigation.includes("manage")) {
      setActivePage("home");
    }
    if (activePage === "detail" && !workspace.selectedSkill) {
      setActivePage(lastShellPage);
    }
  }, [activePage, lastShellPage, workspace.selectedSkill, workspace.visibleNavigation]);

  const navigation = useMemo(() => workspace.visibleNavigation as NavigationPageID[], [workspace.visibleNavigation]);

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

  const installedSkillIssuesByID = useMemo(
    () =>
      Object.fromEntries(
        workspace.installedSkills.map((skill) => [skill.skillID, collectInstalledSkillIssues(skill, workspace)])
      ) as Record<string, string[]>,
    [workspace]
  );

  const filteredInstalledSkills = useMemo(() => {
    const query = installedQuery.trim().toLocaleLowerCase();
    return workspace.installedSkills.filter((skill) => {
      const issues = installedSkillIssuesByID[skill.skillID] ?? [];
      const matchesFilter = matchesInstalledFilter(skill, installedFilter, issues);
      const matchesQuery =
        query.length === 0 ||
        skill.displayName.toLocaleLowerCase().includes(query) ||
        skill.skillID.toLocaleLowerCase().includes(query) ||
        issues.some((issue) => issue.toLocaleLowerCase().includes(query));
      return matchesFilter && matchesQuery;
    });
  }, [installedFilter, installedQuery, installedSkillIssuesByID, workspace.installedSkills]);

  const installedFilterCounts = useMemo(
    () => ({
      all: workspace.installedSkills.length,
      enabled: workspace.installedSkills.filter((skill) => skill.enabledTargets.length > 0).length,
      updates: workspace.installedSkills.filter((skill) => skill.installState === "update_available").length,
      scope_restricted: workspace.installedSkills.filter((skill) => skill.isScopeRestricted).length,
      issues: workspace.installedSkills.filter((skill) => (installedSkillIssuesByID[skill.skillID] ?? []).length > 0).length
    }),
    [installedSkillIssuesByID, workspace.installedSkills]
  );

  const clearFlash = useCallback(() => {
    setFlash(null);
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
    setConfirmModal(null);
    workspace.clearProgress();
  }, [workspace]);

  const navigate = useCallback((page: NavigationPageID | "detail") => {
    if (page === "detail") {
      if (!visibleSkillDetail) return;
      setActivePage("detail");
      return;
    }

    if (isShellPage(page)) {
      setLastShellPage(page);
      setActivePage(page);
      workspace.openPage(page);
    }
  }, [visibleSkillDetail, workspace]);

  const openSkillDetail = useCallback((skillID: string, sourcePage: NavigationPageID = "market") => {
    workspace.selectSkill(skillID);
    setLastShellPage(sourcePage);
    setActivePage("detail");
  }, [workspace]);

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

  const openTargetsModal = useCallback((skill: SkillSummary) => {
    setTargetDrafts(buildTargetDrafts(skill, workspace));
    setModal({ type: "targets", skillID: skill.skillID });
  }, [workspace]);

  const toggleTargetDraft = useCallback((key: string) => {
    setTargetDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, selected: !draft.selected } : draft)));
  }, []);

  const applyTargetDrafts = useCallback(async (skill: SkillSummary) => {
    const sourceDrafts = buildTargetDrafts(skill, workspace);
    const changedDrafts = targetDrafts.filter((draft) => {
      const source = sourceDrafts.find((item) => item.key === draft.key);
      return source && source.selected !== draft.selected;
    });

    if (changedDrafts.length === 0) {
      setFlash({ tone: "info", title: "没有变更", body: "当前目标选择与现有状态一致。" });
      closeModal();
      return;
    }

    const hasPending = changedDrafts.some((draft) => draft.availability.kind !== "live");
    if (hasPending) {
      try {
        await prototypeActionClient.applyTargetDrafts(skill.skillID, changedDrafts);
      } catch (error) {
        if (error instanceof PendingBackendError || error instanceof PendingLocalCommandError) {
          setFlash(mapPendingError(error));
          closeModal();
          return;
        }
        throw error;
      }
    }

    for (const draft of changedDrafts) {
      if (draft.availability.kind !== "live") continue;
      if (draft.selected) {
        await workspace.enableSkill(skill.skillID, draft.targetType, draft.targetID);
      } else {
        await workspace.disableSkill(skill.skillID, draft.targetID, draft.targetType);
      }
    }

    closeModal();
  }, [closeModal, targetDrafts, workspace]);

  const openConnectionStatus = useCallback(() => {
    setModal({ type: "connection_status" });
  }, []);

  const openToolEditor = useCallback((tool?: P1WorkspaceState["tools"][number]) => {
    setToolDraft(
      tool
        ? {
            toolID: tool.toolID,
            name: tool.name,
            configPath: tool.configPath,
            skillsPath: tool.skillsPath,
            enabled: tool.enabled
          }
        : defaultToolDraft
    );
    setModal({ type: "tool_editor" });
  }, []);

  const openProjectEditor = useCallback((project?: P1WorkspaceState["projects"][number]) => {
    setProjectDraft(
      project
        ? {
            projectID: project.projectID,
            name: project.name,
            projectPath: project.projectPath,
            skillsPath: project.skillsPath,
            enabled: project.enabled
          }
        : defaultProjectDraft
    );
    setModal({ type: "project_editor" });
  }, []);

  const submitToolDraft = useCallback(async () => {
    try {
      await prototypeActionClient.createToolDraft(toolDraft);
    } catch (error) {
      if (error instanceof PendingBackendError || error instanceof PendingLocalCommandError) {
        setFlash(mapPendingError(error));
        closeModal();
        return;
      }
      throw error;
    }
  }, [closeModal, toolDraft]);

  const submitProjectDraft = useCallback(async () => {
    await workspace.saveProjectConfig(projectDraft);
    closeModal();
    setFlash({
      tone: "success",
      title: projectDraft.projectID ? "项目已更新" : "项目已保存",
      body: "项目路径、skills 目录和启用状态已写入本地 SQLite 真源。"
    });
  }, [closeModal, projectDraft, workspace]);

  return {
    activePage,
    navigation,
    lastShellPage,
    modal,
    confirmModal,
    flash,
    notificationFilter,
    reviewTab,
    preferences,
    installedQuery,
    installedFilter,
    toolDraft,
    projectDraft,
    targetDrafts,
    filteredNotifications,
    filteredReviews,
    visibleSkillDetail,
    filteredInstalledSkills,
    installedFilterCounts,
    installedSkillIssuesByID,
    clearFlash,
    closeModal,
    navigate,
    openSkillDetail,
    openInstallConfirm,
    openUninstallConfirm,
    openTargetsModal,
    toggleTargetDraft,
    applyTargetDrafts,
    openConnectionStatus,
    setNotificationFilter,
    setReviewTab,
    setPreferences,
    setInstalledQuery,
    setInstalledFilter,
    openToolEditor,
    openProjectEditor,
    setToolDraft,
    setProjectDraft,
    submitToolDraft,
    submitProjectDraft
  };
}

export type DesktopUIState = ReturnType<typeof useDesktopUIState>;
