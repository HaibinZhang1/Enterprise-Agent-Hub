import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminSkill,
  AdminUser,
  AuthState,
  BootstrapContext,
  DepartmentNode,
  LocalBootstrap,
  LocalEvent,
  LocalNotification,
  LocalSkillInstall,
  MarketFilters,
  OperationProgress,
  PageID,
  RequestedMode,
  ReviewDetail,
  ReviewItem,
  ScanTargetSummary,
  SkillSummary,
  TargetType
} from "../domain/p1";
import {
  guestBootstrap
} from "../fixtures/p1SeedData";
import { isPermissionError, isUnauthenticatedError, p1Client } from "../services/p1Client";
import { desktopBridge } from "../services/tauriBridge";

const defaultFilters: MarketFilters = {
  query: "",
  department: "all",
  compatibleTool: "all",
  installed: "all",
  enabled: "all",
  accessScope: "include_public",
  riskLevel: "all",
  sort: "composite"
};

const guestNavigation: PageID[] = ["home", "market", "my_installed", "tools", "projects", "notifications", "settings"];
const emptyLocalNotifications: LocalNotification[] = [];

function notificationFromProgress(progress: OperationProgress, fallbackReason?: string | null): LocalNotification {
  const isSuccess = progress.result === "success";
  return {
    notificationID: `local_${crypto.randomUUID()}`,
    type: `${progress.operation}_result` as LocalNotification["type"],
    title: `${progress.operation} ${isSuccess ? "完成" : "失败"}: ${progress.skillID}`,
    summary: fallbackReason
      ? `${progress.message}；symlink 已降级为 copy（${fallbackReason}）。`
      : progress.message,
    relatedSkillID: progress.skillID,
    targetPage: progress.operation === "install" || progress.operation === "update" ? "my_installed" : "tools",
    occurredAt: new Date().toISOString(),
    unread: true,
    source: "local"
  };
}

function applySkill(skills: SkillSummary[], skillID: string, updater: (skill: SkillSummary) => SkillSummary): SkillSummary[] {
  return skills.map((skill) => (skill.skillID === skillID ? updater(skill) : skill));
}

function normalizeLocalInstallTargets(install: LocalSkillInstall) {
  return install.enabledTargets.map((target) => ({
    ...target,
    fallbackReason: target.fallbackReason ?? null
  }));
}

function applyLocalInstallToSkill(skill: SkillSummary, install: LocalSkillInstall): SkillSummary {
  const enabledTargets = normalizeLocalInstallTargets(install);
  return {
    ...skill,
    localVersion: install.localVersion,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? skill.lastEnabledAt,
    hasLocalHashDrift: false,
    isScopeRestricted: install.isScopeRestricted,
    canUpdate: install.canUpdate && install.localVersion !== skill.version
  };
}

function localSummaryFromInstall(install: LocalSkillInstall): SkillSummary {
  const enabledTargets = normalizeLocalInstallTargets(install);
  return {
    skillID: install.skillID,
    displayName: install.displayName,
    description: "本机已安装的 Skill。登录后可同步市场详情、通知和管理员功能。",
    version: install.localVersion,
    localVersion: install.localVersion,
    latestVersion: install.localVersion,
    status: "published",
    visibilityLevel: "detail_visible",
    detailAccess: "summary",
    canInstall: false,
    canUpdate: install.canUpdate,
    installState: enabledTargets.length > 0 ? "enabled" : "installed",
    authorName: "本机缓存",
    authorDepartment: "离线工作台",
    currentVersionUpdatedAt: install.updatedAt,
    publishedAt: install.installedAt,
    compatibleTools: [],
    compatibleSystems: ["windows"],
    tags: ["本机"],
    category: "本地已安装",
    riskLevel: "unknown",
    starCount: 0,
    downloadCount: 0,
    starred: false,
    readme: "登录后可获取完整 README、安全摘要和远端状态。",
    reviewSummary: install.isScopeRestricted ? "权限已收缩，当前本地版本仍可继续使用。" : "离线模式下仅展示本机状态。",
    isScopeRestricted: install.isScopeRestricted,
    hasLocalHashDrift: false,
    enabledTargets,
    lastEnabledAt: enabledTargets[0]?.enabledAt ?? null
  };
}

function mergeLocalInstalls(skills: SkillSummary[], localBootstrap: LocalBootstrap): SkillSummary[] {
  const installs = new Map(localBootstrap.installs.map((install) => [install.skillID, install]));
  return skills.map((skill) => {
    const install = installs.get(skill.skillID);
    return install ? applyLocalInstallToSkill(skill, install) : skill;
  });
}

function buildGuestBootstrap(localBootstrap: LocalBootstrap, message?: string): BootstrapContext {
  return {
    ...guestBootstrap,
    connection: {
      ...guestBootstrap.connection,
      lastError: message ?? guestBootstrap.connection.lastError
    },
    counts: {
      installedCount: localBootstrap.installs.length,
      enabledCount: localBootstrap.installs.filter((install) => install.enabledTargets.length > 0).length,
      updateAvailableCount: localBootstrap.installs.filter((install) => install.canUpdate).length,
      unreadNotificationCount: localBootstrap.unreadLocalNotificationCount
    }
  };
}

function mergeNotifications(remoteNotifications: LocalNotification[], localNotifications: LocalNotification[]): LocalNotification[] {
  const merged = [...localNotifications];
  const seen = new Set(localNotifications.map((notification) => notification.notificationID));
  for (const notification of remoteNotifications) {
    if (!seen.has(notification.notificationID)) {
      merged.unshift(notification);
    }
  }
  return merged.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

function findDepartment(nodes: DepartmentNode[], departmentID: string | null): DepartmentNode | null {
  if (!departmentID) return null;
  for (const node of nodes) {
    if (node.departmentID === departmentID) return node;
    const match = findDepartment(node.children, departmentID);
    if (match) return match;
  }
  return null;
}

export function useP1Workspace() {
  const [authState, setAuthState] = useState<AuthState>("guest");
  const [bootstrap, setBootstrap] = useState<BootstrapContext>(guestBootstrap);
  const [activePage, setActivePageState] = useState<PageID>("home");
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [tools, setTools] = useState<LocalBootstrap["tools"]>([]);
  const [projects, setProjects] = useState<LocalBootstrap["projects"]>([]);
  const [notifications, setNotifications] = useState<LocalNotification[]>(emptyLocalNotifications);
  const [offlineEvents, setOfflineEvents] = useState<LocalEvent[]>([]);
  const [filters, setFilters] = useState<MarketFilters>(defaultFilters);
  const [selectedSkillID, setSelectedSkillID] = useState("");
  const [progress, setProgress] = useState<OperationProgress | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  const [selectedDepartmentID, setSelectedDepartmentID] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSkills, setAdminSkills] = useState<AdminSkill[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [selectedReviewID, setSelectedReviewID] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null);
  const [manageSection, setManageSection] = useState<"departments" | "users" | "skills">("departments");
  const [scanTargets, setScanTargets] = useState<ScanTargetSummary[]>([]);

  const localBootstrapRef = useRef<LocalBootstrap | null>(null);
  const pendingPageRef = useRef<PageID | null>(null);
  const pendingActionRef = useRef<null | (() => Promise<void> | void)>(null);
  const localNotificationsRef = useRef<LocalNotification[]>(emptyLocalNotifications);
  const remoteMarketFilters = useMemo(
    () => ({ ...filters, installed: "all" as const, enabled: "all" as const }),
    [filters]
  );

  const refreshLocalBootstrap = useCallback(async () => {
    const localBootstrap = await desktopBridge.getLocalBootstrap();
    localBootstrapRef.current = localBootstrap;
    setTools(localBootstrap.tools);
    setProjects(localBootstrap.projects);
    setOfflineEvents(localBootstrap.offlineEvents);
    return localBootstrap;
  }, []);

  const refreshLocalScans = useCallback(async () => {
    const summaries = await desktopBridge.scanLocalTargets();
    setScanTargets(summaries);
    return summaries;
  }, []);

  useEffect(() => {
    localNotificationsRef.current = notifications.filter((notification) => notification.source !== "server");
  }, [notifications]);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.skillID === selectedSkillID) ?? skills[0] ?? null,
    [selectedSkillID, skills]
  );

  const selectedDepartment = useMemo(
    () => findDepartment(departments, selectedDepartmentID) ?? departments[0] ?? null,
    [departments, selectedDepartmentID]
  );

  const counts = useMemo(
    () => ({
      installedCount: skills.filter((skill) => skill.localVersion !== null).length,
      enabledCount: skills.filter((skill) => skill.enabledTargets.length > 0).length,
      updateAvailableCount: skills.filter((skill) => skill.installState === "update_available").length,
      unreadNotificationCount: notifications.filter((notification) => notification.unread).length
    }),
    [notifications, skills]
  );

  const marketSkills = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase();
    const filtered = [...skills]
      .filter((skill) => {
        const matchesInstalled = filters.installed === "all" || (filters.installed === "installed" ? skill.localVersion : !skill.localVersion);
        const matchesEnabled = filters.enabled === "all" || (filters.enabled === "enabled" ? skill.enabledTargets.length > 0 : skill.enabledTargets.length === 0);
        if (authState === "authenticated" && bootstrap.connection.status === "connected") {
          return matchesInstalled && matchesEnabled;
        }
        const matchesQuery =
          query.length === 0 ||
          skill.displayName.toLocaleLowerCase().includes(query) ||
          skill.description.toLocaleLowerCase().includes(query) ||
          skill.skillID.toLocaleLowerCase().includes(query) ||
          skill.tags.some((tag) => tag.toLocaleLowerCase().includes(query)) ||
          skill.authorDepartment?.toLocaleLowerCase().includes(query) ||
          skill.authorName?.toLocaleLowerCase().includes(query);
        const matchesDepartment = filters.department === "all" || skill.authorDepartment === filters.department;
        const matchesTool = filters.compatibleTool === "all" || skill.compatibleTools.includes(filters.compatibleTool);
        const matchesAccess = filters.accessScope === "include_public" || skill.detailAccess === "full";
        const matchesRisk = filters.riskLevel === "all" || skill.riskLevel === filters.riskLevel;
        return matchesQuery && matchesDepartment && matchesTool && matchesInstalled && matchesEnabled && matchesAccess && matchesRisk;
      });

    if (authState === "authenticated" && bootstrap.connection.status === "connected") {
      return filtered;
    }

    return filtered.sort((left, right) => {
      switch (filters.sort) {
        case "latest_published":
          return right.publishedAt.localeCompare(left.publishedAt);
        case "recently_updated":
          return right.currentVersionUpdatedAt.localeCompare(left.currentVersionUpdatedAt);
        case "download_count":
          return right.downloadCount - left.downloadCount;
        case "star_count":
          return right.starCount - left.starCount;
        case "relevance":
          return Number(right.skillID.toLocaleLowerCase().includes(query)) - Number(left.skillID.toLocaleLowerCase().includes(query));
        case "composite":
        default:
          return right.starCount + right.downloadCount - (left.starCount + left.downloadCount);
      }
      });
  }, [authState, bootstrap.connection.status, filters, skills]);

  const installedSkills = useMemo(() => skills.filter((skill) => skill.localVersion !== null), [skills]);
  const visibleNavigation = useMemo(
    () => (authState === "authenticated" && bootstrap.connection.status === "connected" ? bootstrap.navigation : guestNavigation),
    [authState, bootstrap.connection.status, bootstrap.navigation]
  );
  const departmentsFilter = useMemo(() => [...new Set(skills.map((skill) => skill.authorDepartment).filter(Boolean))] as string[], [skills]);
  const compatibleTools = useMemo(() => [...new Set(skills.flatMap((skill) => skill.compatibleTools))], [skills]);
  const isAdminConnected = authState === "authenticated" && bootstrap.connection.status === "connected" && bootstrap.menuPermissions.includes("manage");

  const queueLogin = useCallback((page: PageID | null, action?: () => Promise<void> | void) => {
    pendingPageRef.current = page;
    pendingActionRef.current = action ?? null;
    setAuthError(null);
    setLoginModalOpen(true);
  }, []);

  const moveToGuest = useCallback(async (message?: string) => {
    const localBootstrap = localBootstrapRef.current ?? (await refreshLocalBootstrap());
    const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
    const localSkills = localBootstrap.installs.map(localSummaryFromInstall);
    setAuthState("guest");
    setBootstrap(buildGuestBootstrap(localBootstrap, message));
    setSkills(localSkills);
    setOfflineEvents(localBootstrap.offlineEvents);
    setScanTargets(localScanTargets);
    setNotifications(localNotificationsRef.current);
    setDepartments([]);
    setAdminUsers([]);
    setAdminSkills([]);
    setReviews([]);
    setSelectedReview(null);
    setSelectedReviewID(null);
    setSelectedDepartmentID(null);
    setSelectedSkillID((current) => (localSkills.some((skill) => skill.skillID === current) ? current : localSkills[0]?.skillID ?? ""));
    setActivePageState((current) => (current === "manage" || current === "review" || current === "market" || current === "notifications" ? "home" : current));
  }, [refreshLocalBootstrap]);

  const stripAdminCapabilities = useCallback(() => {
    setBootstrap((current) => ({
      ...current,
      features: {
        ...current.features,
        reviewWorkbench: false,
        adminManage: false
      },
      navigation: current.navigation.filter((page) => page !== "review" && page !== "manage"),
      menuPermissions: current.menuPermissions.filter((page) => page !== "review" && page !== "manage")
    }));
    setActivePageState((current) => (current === "manage" || current === "review" ? "home" : current));
  }, []);

  const handleRemoteError = useCallback(
    async (error: unknown, options: { reopenLogin?: boolean } = {}) => {
      if (isUnauthenticatedError(error)) {
        p1Client.clearStoredSession();
        await moveToGuest("登录已失效，请重新登录。");
        setAuthError("登录已失效，请重新登录。");
        if (options.reopenLogin) {
          setLoginModalOpen(true);
        }
        return true;
      }
      if (isPermissionError(error)) {
        stripAdminCapabilities();
        setProgress({ operation: "update", skillID: "permission", stage: "权限变化", result: "failed", message: "当前账号已不具备该页面权限。" });
        return true;
      }
      const message = error instanceof Error ? error.message : "请求失败";
      setProgress({ operation: "update", skillID: "request", stage: "失败", result: "failed", message });
      return false;
    },
    [moveToGuest, stripAdminCapabilities]
  );

  const hydrateAuthenticatedState = useCallback(
    async (localBootstrap?: LocalBootstrap) => {
      const currentLocalBootstrap = localBootstrap ?? localBootstrapRef.current ?? (await refreshLocalBootstrap());
      const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
      localBootstrapRef.current = currentLocalBootstrap;
      const [remoteBootstrap, remoteSkills, remoteNotifications] = await Promise.all([
        p1Client.bootstrap(),
        p1Client.listSkills(remoteMarketFilters),
        p1Client.listNotifications()
      ]);
      const mergedSkills = mergeLocalInstalls(remoteSkills, currentLocalBootstrap);
      setAuthState("authenticated");
      setBootstrap(remoteBootstrap);
      setSkills(mergedSkills);
      setTools(currentLocalBootstrap.tools);
      setProjects(currentLocalBootstrap.projects);
      setOfflineEvents(currentLocalBootstrap.offlineEvents);
      setScanTargets(localScanTargets);
      setNotifications(mergeNotifications(remoteNotifications, localNotificationsRef.current));
      setSelectedSkillID((current) => (mergedSkills.some((skill) => skill.skillID === current) ? current : mergedSkills[0]?.skillID ?? ""));
      return remoteBootstrap;
    },
    [refreshLocalBootstrap, remoteMarketFilters]
  );

  useEffect(() => {
    let cancelled = false;

    async function initializeWorkspace() {
      const localBootstrap = await refreshLocalBootstrap();
      const localScanTargets = await desktopBridge.scanLocalTargets().catch(() => []);
      if (cancelled) return;
      const localSkills = localBootstrap.installs.map(localSummaryFromInstall);
      setBootstrap(buildGuestBootstrap(localBootstrap));
      setSkills(localSkills);
      setNotifications(localNotificationsRef.current);
      setOfflineEvents(localBootstrap.offlineEvents);
      setScanTargets(localScanTargets);
      setSelectedSkillID(localSkills[0]?.skillID ?? "");

      if (p1Client.hasStoredSession()) {
        setBootstrap((current) => ({
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
          setBootstrap(buildGuestBootstrap(localBootstrap, message));
          setAuthState("guest");
        }
      }
    }

    void initializeWorkspace();
    return () => {
      cancelled = true;
    };
  }, [hydrateAuthenticatedState]);

  useEffect(() => {
    if (authState !== "authenticated" || bootstrap.connection.status !== "connected") return;
    let cancelled = false;

    void p1Client
      .listSkills(remoteMarketFilters)
      .then((remoteSkills) => {
        if (cancelled) return;
        const localBootstrap = localBootstrapRef.current;
        const mergedSkills = localBootstrap ? mergeLocalInstalls(remoteSkills, localBootstrap) : remoteSkills;
        setSkills(mergedSkills);
        setSelectedSkillID((current) => (mergedSkills.some((skill) => skill.skillID === current) ? current : mergedSkills[0]?.skillID ?? ""));
      })
      .catch((error) => void handleRemoteError(error));

    return () => {
      cancelled = true;
    };
  }, [authState, bootstrap.connection.status, handleRemoteError, remoteMarketFilters]);

  useEffect(() => {
    if (activePage === "manage" && !visibleNavigation.includes("manage")) {
      setActivePageState("home");
    }
    if (activePage === "review" && !visibleNavigation.includes("review")) {
      setActivePageState("home");
    }
  }, [activePage, visibleNavigation]);

  const refreshManageData = useCallback(async () => {
    const [nextDepartments, nextUsers, nextSkills] = await Promise.all([
      p1Client.listDepartments(),
      p1Client.listAdminUsers(),
      p1Client.listAdminSkills()
    ]);
    setDepartments(nextDepartments);
    setAdminUsers(nextUsers);
    setAdminSkills(nextSkills);
    setSelectedDepartmentID((current) => findDepartment(nextDepartments, current) ? current : nextDepartments[0]?.departmentID ?? null);
  }, []);

  const refreshReviews = useCallback(async () => {
    const nextReviews = await p1Client.listReviews();
    setReviews(nextReviews);
    setSelectedReviewID((current) => (nextReviews.some((review) => review.reviewID === current) ? current : nextReviews[0]?.reviewID ?? null));
  }, []);

  useEffect(() => {
    if (authState !== "authenticated" || bootstrap.connection.status !== "connected") return;
    if (activePage === "manage" && bootstrap.menuPermissions.includes("manage")) {
      void refreshManageData().catch((error) => void handleRemoteError(error));
    }
    if (activePage === "review" && bootstrap.menuPermissions.includes("review")) {
      void refreshReviews().catch((error) => void handleRemoteError(error));
    }
  }, [activePage, authState, bootstrap.connection.status, bootstrap.menuPermissions, handleRemoteError, refreshManageData, refreshReviews]);

  useEffect(() => {
    if (authState !== "authenticated" || activePage !== "review" || !selectedReviewID) return;
    void p1Client
      .getReview(selectedReviewID)
      .then(setSelectedReview)
      .catch((error) => void handleRemoteError(error));
  }, [activePage, authState, handleRemoteError, selectedReviewID]);

  const login = useCallback(async (input: { username: string; password: string; serverURL: string }) => {
    setAuthError(null);
    try {
      const localBootstrap = localBootstrapRef.current ?? (await refreshLocalBootstrap());
      localBootstrapRef.current = localBootstrap;
      await p1Client.login(input);
      await hydrateAuthenticatedState(localBootstrap);
      setLoginModalOpen(false);
      const nextPage = pendingPageRef.current ?? "home";
      setActivePageState(nextPage);
      const pendingAction = pendingActionRef.current;
      pendingPageRef.current = null;
      pendingActionRef.current = null;
      if (pendingAction) {
        await pendingAction();
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "登录失败");
    }
  }, [hydrateAuthenticatedState, refreshLocalBootstrap]);

  const logout = useCallback(async () => {
    await p1Client.logout();
    pendingPageRef.current = null;
    pendingActionRef.current = null;
    setLoginModalOpen(false);
    setAuthError(null);
    await moveToGuest("已切换到本地模式。");
  }, [moveToGuest]);

  const openPage = useCallback(
    (page: PageID) => {
      if ((page === "market" || page === "notifications") && authState !== "authenticated") {
        queueLogin(page);
        return;
      }
      if ((page === "manage" || page === "review")) {
        if (authState !== "authenticated") {
          queueLogin(page);
          return;
        }
        if (!visibleNavigation.includes(page)) {
          setActivePageState("home");
          return;
        }
      }
      setActivePageState(page);
    },
    [authState, queueLogin, visibleNavigation]
  );

  const refreshBootstrap = useCallback(async () => {
    if (authState !== "authenticated") {
      queueLogin(activePage);
      return;
    }
    try {
      await hydrateAuthenticatedState();
    } catch (error) {
      await handleRemoteError(error, { reopenLogin: true });
    }
  }, [activePage, authState, handleRemoteError, hydrateAuthenticatedState, queueLogin]);

  const requireAuthenticatedAction = useCallback(
    (page: PageID | null, action: () => Promise<void> | void) => {
      if (authState !== "authenticated") {
        queueLogin(page, action);
        return false;
      }
      void Promise.resolve(action()).catch((error) => void handleRemoteError(error, { reopenLogin: true }));
      return true;
    },
    [authState, handleRemoteError, queueLogin]
  );

  const selectSkill = useCallback((skillID: string) => {
    setSelectedSkillID(skillID);
  }, []);

  const openSkill = useCallback((skillID: string) => {
    setSelectedSkillID(skillID);
    openPage("market");
  }, [openPage]);

  const updateSkillProgress = useCallback((nextProgress: OperationProgress) => {
    setProgress(nextProgress);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  const performInstallOrUpdate = useCallback(
    async (skillID: string, operation: "install" | "update") => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      if (bootstrap.connection.status !== "connected") {
        updateSkillProgress({ operation, skillID, stage: "blocked_offline", result: "failed", message: "离线模式下不能安装或更新市场 Skill。" });
        return;
      }
      const stages = ["获取下载凭证", "下载包", "校验大小和文件数", "校验 SHA-256", "写入 Central Store"];
      for (const stage of stages) {
        updateSkillProgress({ operation, skillID, stage, result: "running", message: stage });
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
      const downloadTicket = await p1Client.downloadTicket(skill, operation);
      const result = operation === "install" ? await desktopBridge.installSkillPackage(downloadTicket) : await desktopBridge.updateSkillPackage(downloadTicket);
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setSkills((current) => applySkill(current, skillID, (item) => applyLocalInstallToSkill(item, result)));
      setOfflineEvents(localBootstrap.offlineEvents);
      const nextProgress: OperationProgress = {
        operation,
        skillID,
        stage: "完成",
        result: "success",
        message: `${skill.displayName} 已写入 Central Store，原启用位置不会被自动覆盖。`
      };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress), ...current]);
    },
    [bootstrap.connection.status, refreshLocalBootstrap, refreshLocalScans, skills, updateSkillProgress]
  );

  const installOrUpdate = useCallback(
    async (skillID: string, operation: "install" | "update") => {
      requireAuthenticatedAction("market", async () => {
        await performInstallOrUpdate(skillID, operation);
      });
    },
    [performInstallOrUpdate, requireAuthenticatedAction]
  );

  const enableSkill = useCallback(
    async (
      skillID: string,
      targetType: TargetType,
      targetID: string,
      requestedMode: RequestedMode = "symlink",
      allowOverwrite = false
    ) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill || !skill.localVersion || skill.isScopeRestricted) return;
      updateSkillProgress({ operation: "enable", skillID, stage: "目标转换与写入", result: "running", message: "正在调用 Tauri Adapter 启用 Skill。" });
      const result = await desktopBridge.enableSkill({ skill, targetType, targetID, requestedMode, allowOverwrite });
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setSkills((current) =>
        applySkill(current, skillID, (item) => ({
          ...item,
          installState: "enabled",
          enabledTargets: [
            ...item.enabledTargets.filter((target) => !(target.targetID === targetID && target.targetType === targetType)),
            result.target
          ],
          lastEnabledAt: result.target.enabledAt
        }))
      );
      setOfflineEvents(localBootstrap.offlineEvents);
      const nextProgress: OperationProgress = {
        operation: "enable",
        skillID,
        stage: "完成",
        result: "success",
        message: `${skill.displayName} 已启用到 ${result.target.targetName}`
      };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress, result.target.fallbackReason), ...current]);
    },
    [refreshLocalBootstrap, refreshLocalScans, skills, updateSkillProgress]
  );

  const disableSkill = useCallback(
    async (skillID: string, targetID: string, targetType?: TargetType) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "disable", skillID, stage: "移除托管目标", result: "running", message: "正在停用目标；不会删除 Central Store。" });
      const result = await desktopBridge.disableSkill({ skill, targetID, targetType });
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setSkills((current) =>
        applySkill(current, skillID, (item) => {
          const enabledTargets = item.enabledTargets.filter(
            (target) => !(target.targetID === targetID && (!targetType || target.targetType === targetType))
          );
          return { ...item, enabledTargets, installState: enabledTargets.length > 0 ? "enabled" : "installed" };
        })
      );
      setOfflineEvents(localBootstrap.offlineEvents);
      const nextProgress: OperationProgress = { operation: "disable", skillID, stage: "完成", result: "success", message: `${skill.displayName} 已从目标停用。` };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress), ...current]);
    },
    [refreshLocalBootstrap, refreshLocalScans, skills, updateSkillProgress]
  );

  const uninstallSkill = useCallback(
    async (skillID: string) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "uninstall", skillID, stage: "确认引用并删除", result: "running", message: "正在通过 Store 命令删除 Central Store 与托管目标。" });
      const result = await desktopBridge.uninstallSkill(skillID);
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setSkills((current) =>
        applySkill(current, skillID, (item) => ({ ...item, localVersion: null, installState: "not_installed", enabledTargets: [], lastEnabledAt: null }))
      );
      setOfflineEvents(localBootstrap.offlineEvents);
      const nextProgress: OperationProgress = {
        operation: "uninstall",
        skillID,
        stage: "完成",
        result: result.failedTargetIDs.length === 0 ? "success" : "failed",
        message: result.failedTargetIDs.length === 0
          ? `${skill.displayName} 已卸载。`
          : `${skill.displayName} 已卸载，但仍有 ${result.failedTargetIDs.length} 个目标需要手动清理。`
      };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress), ...current]);
    },
    [refreshLocalBootstrap, refreshLocalScans, skills, updateSkillProgress]
  );

  const toggleStar = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("market", async () => {
        const skill = skills.find((item) => item.skillID === skillID);
        if (!skill) return;
        const result = await p1Client.star(skillID, !skill.starred);
        setSkills((current) => applySkill(current, skillID, (item) => ({ ...item, starred: result.starred, starCount: result.starCount })));
      });
    },
    [requireAuthenticatedAction, skills]
  );

  const markNotificationsRead = useCallback(
    async (notificationIDs: string[] | "all") => {
      requireAuthenticatedAction("notifications", async () => {
        await p1Client.markNotificationsRead(notificationIDs);
        setNotifications((current) =>
          current.map((notification) =>
            notificationIDs === "all" || notificationIDs.includes(notification.notificationID) ? { ...notification, unread: false } : notification
          )
        );
      });
    },
    [requireAuthenticatedAction]
  );

  const syncOfflineEvents = useCallback(async () => {
    requireAuthenticatedAction("notifications", async () => {
      if (offlineEvents.length === 0 || bootstrap.connection.status !== "connected") return;
      const result = await p1Client.syncLocalEvents(offlineEvents);
      const accepted = new Set(result.acceptedEventIDs);
      if (accepted.size > 0) {
        await desktopBridge.markOfflineEventsSynced([...accepted]);
        const localBootstrap = await refreshLocalBootstrap();
        setOfflineEvents(localBootstrap.offlineEvents);
      }
      if (result.serverStateChanged) {
        setNotifications((current) => [
          {
            notificationID: `sync_${crypto.randomUUID()}`,
            type: "connection_restored",
            title: "本地事件已同步",
            summary: "服务端返回远端状态变化，请检查我的 Skill 和通知。",
            relatedSkillID: null,
            targetPage: "notifications",
            occurredAt: new Date().toISOString(),
            unread: true,
            source: "sync"
          },
          ...current
        ]);
      }
    });
  }, [bootstrap.connection.status, offlineEvents, refreshLocalBootstrap, requireAuthenticatedAction]);

  const refreshTools = useCallback(async () => {
    const detectedTools = await desktopBridge.refreshToolDetection();
    setTools(detectedTools);
    await refreshLocalScans();
  }, [refreshLocalScans]);

  const saveToolConfig = useCallback(
    async (tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }) => {
      const saved = await desktopBridge.saveToolConfig(tool);
      const localBootstrap = await refreshLocalBootstrap();
      setTools(localBootstrap.tools);
      await refreshLocalScans();
      return saved;
    },
    [refreshLocalBootstrap, refreshLocalScans]
  );

  const scanLocalTargets = useCallback(async () => {
    return refreshLocalScans();
  }, [refreshLocalScans]);

  const validateTargetPath = useCallback(async (targetPath: string) => {
    return desktopBridge.validateTargetPath(targetPath);
  }, []);

  const saveProjectConfig = useCallback(
    async (project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }) => {
      const saved = await desktopBridge.saveProjectConfig(project);
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setProjects(localBootstrap.projects);
      return saved;
    },
    [refreshLocalBootstrap, refreshLocalScans]
  );

  const createDepartment = useCallback(
    async (parentDepartmentID: string, name: string) => {
      requireAuthenticatedAction("manage", async () => {
        const nextDepartments = await p1Client.createDepartment({ parentDepartmentID, name });
        setDepartments(nextDepartments);
        setSelectedDepartmentID(parentDepartmentID);
      });
    },
    [requireAuthenticatedAction]
  );

  const updateDepartment = useCallback(
    async (departmentID: string, name: string) => {
      requireAuthenticatedAction("manage", async () => {
        const nextDepartments = await p1Client.updateDepartment(departmentID, { name });
        setDepartments(nextDepartments);
      });
    },
    [requireAuthenticatedAction]
  );

  const deleteDepartment = useCallback(
    async (departmentID: string) => {
      requireAuthenticatedAction("manage", async () => {
        await p1Client.deleteDepartment(departmentID);
        await refreshManageData();
      });
    },
    [refreshManageData, requireAuthenticatedAction]
  );

  const createAdminUser = useCallback(
    async (input: { username: string; password: string; displayName: string; departmentID: string; role: "normal_user" | "admin"; adminLevel: number | null }) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminUsers(await p1Client.createAdminUser(input));
      });
    },
    [requireAuthenticatedAction]
  );

  const updateAdminUser = useCallback(
    async (targetUserID: string, input: { displayName?: string; departmentID?: string; role?: "normal_user" | "admin"; adminLevel?: number | null }) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminUsers(await p1Client.updateAdminUser(targetUserID, input));
      });
    },
    [requireAuthenticatedAction]
  );

  const freezeAdminUser = useCallback(
    async (targetUserID: string) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminUsers(await p1Client.freezeAdminUser(targetUserID));
      });
    },
    [requireAuthenticatedAction]
  );

  const unfreezeAdminUser = useCallback(
    async (targetUserID: string) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminUsers(await p1Client.unfreezeAdminUser(targetUserID));
      });
    },
    [requireAuthenticatedAction]
  );

  const deleteAdminUser = useCallback(
    async (targetUserID: string) => {
      requireAuthenticatedAction("manage", async () => {
        await p1Client.deleteAdminUser(targetUserID);
        setAdminUsers((current) => current.filter((user) => user.userID !== targetUserID));
      });
    },
    [requireAuthenticatedAction]
  );

  const delistAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminSkills(await p1Client.delistAdminSkill(skillID));
      });
    },
    [requireAuthenticatedAction]
  );

  const relistAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("manage", async () => {
        setAdminSkills(await p1Client.relistAdminSkill(skillID));
      });
    },
    [requireAuthenticatedAction]
  );

  const archiveAdminSkill = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("manage", async () => {
        await p1Client.archiveAdminSkill(skillID);
        setAdminSkills((current) => current.filter((skill) => skill.skillID !== skillID));
      });
    },
    [requireAuthenticatedAction]
  );

  return {
    authState,
    loggedIn: authState === "authenticated",
    loginModalOpen,
    setLoginModalOpen,
    bootstrap: { ...bootstrap, counts },
    activePage,
    setActivePage: openPage,
    openPage,
    visibleNavigation,
    skills,
    marketSkills,
    installedSkills,
    selectedSkill,
    selectedSkillID,
    selectSkill,
    openSkill,
    tools,
    projects,
    scanTargets,
    notifications,
    offlineEvents,
    filters,
    setFilters,
    departments: departmentsFilter,
    compatibleTools,
    progress,
    clearProgress,
    authError,
    login,
    logout,
    refreshBootstrap,
    installOrUpdate,
    enableSkill,
    disableSkill,
    uninstallSkill,
    saveToolConfig,
    saveProjectConfig,
    toggleStar,
    markNotificationsRead,
    syncOfflineEvents,
    refreshTools,
    scanLocalTargets,
    validateTargetPath,
    requireAuth: queueLogin,
    apiBaseURL: p1Client.currentAPIBase(),
    currentUser: bootstrap.user,
    isAdminConnected,
    adminData: {
      departments,
      selectedDepartment,
      setSelectedDepartmentID,
      adminUsers,
      adminSkills,
      reviews,
      selectedReview,
      selectedReviewID,
      setSelectedReviewID,
      manageSection,
      setManageSection,
      refreshManageData,
      refreshReviews,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      createAdminUser,
      updateAdminUser,
      freezeAdminUser,
      unfreezeAdminUser,
      deleteAdminUser,
      delistAdminSkill,
      relistAdminSkill,
      archiveAdminSkill
    }
  };
}

export type P1WorkspaceState = ReturnType<typeof useP1Workspace>;
