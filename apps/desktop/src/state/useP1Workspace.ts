import { useCallback, useMemo, useState } from "react";
import type {
  BootstrapContext,
  ConnectionStatus,
  LocalEvent,
  LocalNotification,
  MarketFilters,
  OperationProgress,
  PageID,
  ProjectConfig,
  RequestedMode,
  SkillSummary,
  TargetType,
  ToolConfig
} from "../domain/p1";
import { seedBootstrap, seedNotifications, seedOfflineEvents, seedProjects, seedSkills, seedTools } from "../fixtures/p1SeedData";
import { p1Client } from "../services/p1Client";
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

export function useP1Workspace() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [bootstrap, setBootstrap] = useState<BootstrapContext>(seedBootstrap);
  const [activePage, setActivePage] = useState<PageID>("home");
  const [skills, setSkills] = useState<SkillSummary[]>(seedSkills);
  const [tools, setTools] = useState<ToolConfig[]>(seedTools);
  const [projects, setProjects] = useState<ProjectConfig[]>(seedProjects);
  const [notifications, setNotifications] = useState<LocalNotification[]>(seedNotifications);
  const [offlineEvents, setOfflineEvents] = useState<LocalEvent[]>(seedOfflineEvents);
  const [filters, setFilters] = useState<MarketFilters>(defaultFilters);
  const [selectedSkillID, setSelectedSkillID] = useState(seedSkills[0]?.skillID ?? "");
  const [progress, setProgress] = useState<OperationProgress | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.skillID === selectedSkillID) ?? skills[0] ?? null,
    [selectedSkillID, skills]
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
    return [...skills]
      .filter((skill) => {
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
        const matchesInstalled = filters.installed === "all" || (filters.installed === "installed" ? skill.localVersion : !skill.localVersion);
        const matchesEnabled = filters.enabled === "all" || (filters.enabled === "enabled" ? skill.enabledTargets.length > 0 : skill.enabledTargets.length === 0);
        const matchesAccess = filters.accessScope === "include_public" || skill.detailAccess === "full";
        const matchesRisk = filters.riskLevel === "all" || skill.riskLevel === filters.riskLevel;
        return matchesQuery && matchesDepartment && matchesTool && matchesInstalled && matchesEnabled && matchesAccess && matchesRisk;
      })
      .sort((left, right) => {
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
  }, [filters, skills]);

  const installedSkills = useMemo(() => skills.filter((skill) => skill.localVersion !== null), [skills]);
  const departments = useMemo(() => [...new Set(skills.map((skill) => skill.authorDepartment).filter(Boolean))] as string[], [skills]);
  const compatibleTools = useMemo(() => [...new Set(skills.flatMap((skill) => skill.compatibleTools))], [skills]);

  const refreshBootstrap = useCallback(async () => {
    const [remoteBootstrap, localBootstrap] = await Promise.all([p1Client.bootstrap(), desktopBridge.getLocalBootstrap()]);
    setBootstrap(remoteBootstrap);
    setTools(localBootstrap.tools);
    setProjects(localBootstrap.projects);
  }, []);

  const login = useCallback(async (input: { username: string; password: string; serverURL: string }) => {
    setAuthError(null);
    try {
      const context = await p1Client.login(input);
      const localBootstrap = await desktopBridge.getLocalBootstrap();
      setBootstrap(context);
      setTools(localBootstrap.tools);
      setProjects(localBootstrap.projects);
      setLoggedIn(true);
      setActivePage("home");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "登录失败");
    }
  }, []);

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setBootstrap((current) => ({
      ...current,
      connection: {
        ...current.connection,
        status,
        lastError: status === "failed" ? "无法连接服务，请检查服务地址或网络。" : undefined
      }
    }));
  }, []);

  const selectSkill = useCallback((skillID: string) => {
    setSelectedSkillID(skillID);
  }, []);

  const openSkill = useCallback((skillID: string) => {
    setSelectedSkillID(skillID);
    setActivePage("market");
  }, []);

  const updateSkillProgress = useCallback((nextProgress: OperationProgress) => {
    setProgress(nextProgress);
  }, []);

  const installOrUpdate = useCallback(
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
      const result = operation === "install" ? await desktopBridge.installSkillPackage(skill) : await desktopBridge.updateSkillPackage(skill);
      setSkills((current) =>
        applySkill(current, skillID, (item) => ({
          ...item,
          localVersion: result.localVersion,
          installState: item.enabledTargets.length > 0 ? "enabled" : "installed",
          hasLocalHashDrift: false
        }))
      );
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
    [bootstrap.connection.status, skills, updateSkillProgress]
  );

  const enableSkill = useCallback(
    async (skillID: string, targetType: TargetType, targetID: string, requestedMode: RequestedMode = "symlink") => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill || !skill.localVersion || skill.isScopeRestricted) return;
      updateSkillProgress({ operation: "enable", skillID, stage: "目标转换与写入", result: "running", message: "正在调用 Tauri Adapter 启用 Skill。" });
      const result = await desktopBridge.enableSkill({ skill, targetType, targetID, requestedMode });
      setSkills((current) =>
        applySkill(current, skillID, (item) => ({
          ...item,
          installState: "enabled",
          enabledTargets: [...item.enabledTargets.filter((target) => target.targetID !== targetID), result.target],
          lastEnabledAt: result.target.enabledAt
        }))
      );
      setOfflineEvents((current) => [result.event, ...current]);
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
    [skills, updateSkillProgress]
  );

  const disableSkill = useCallback(
    async (skillID: string, targetID: string) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "disable", skillID, stage: "移除托管目标", result: "running", message: "正在停用目标；不会删除 Central Store。" });
      const result = await desktopBridge.disableSkill({ skill, targetID });
      setSkills((current) =>
        applySkill(current, skillID, (item) => {
          const enabledTargets = item.enabledTargets.filter((target) => target.targetID !== targetID);
          return { ...item, enabledTargets, installState: enabledTargets.length > 0 ? "enabled" : "installed" };
        })
      );
      setOfflineEvents((current) => [result.event, ...current]);
      const nextProgress: OperationProgress = { operation: "disable", skillID, stage: "完成", result: "success", message: `${skill.displayName} 已从目标停用。` };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress), ...current]);
    },
    [skills, updateSkillProgress]
  );

  const uninstallSkill = useCallback(
    async (skillID: string) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "uninstall", skillID, stage: "确认引用并删除", result: "running", message: "正在通过 Store 命令删除 Central Store 与托管目标。" });
      await desktopBridge.uninstallSkill(skillID);
      setSkills((current) =>
        applySkill(current, skillID, (item) => ({ ...item, localVersion: null, installState: "not_installed", enabledTargets: [], lastEnabledAt: null }))
      );
      const nextProgress: OperationProgress = { operation: "uninstall", skillID, stage: "完成", result: "success", message: `${skill.displayName} 已卸载。` };
      updateSkillProgress(nextProgress);
      setNotifications((current) => [notificationFromProgress(nextProgress), ...current]);
    },
    [skills, updateSkillProgress]
  );

  const toggleStar = useCallback(
    async (skillID: string) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      const result = await p1Client.star(skillID, !skill.starred);
      setSkills((current) => applySkill(current, skillID, (item) => ({ ...item, starred: result.starred, starCount: result.starCount })));
    },
    [skills]
  );

  const markNotificationsRead = useCallback(async (notificationIDs: string[] | "all") => {
    await p1Client.markNotificationsRead(notificationIDs);
    setNotifications((current) =>
      current.map((notification) =>
        notificationIDs === "all" || notificationIDs.includes(notification.notificationID) ? { ...notification, unread: false } : notification
      )
    );
  }, []);

  const syncOfflineEvents = useCallback(async () => {
    if (offlineEvents.length === 0 || bootstrap.connection.status !== "connected") return;
    const result = await p1Client.syncLocalEvents(offlineEvents);
    const accepted = new Set(result.acceptedEventIDs);
    setOfflineEvents((current) => current.filter((event) => !accepted.has(event.eventID)));
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
  }, [bootstrap.connection.status, offlineEvents]);

  const refreshTools = useCallback(async () => {
    setTools(await desktopBridge.refreshToolDetection());
  }, []);

  return {
    loggedIn,
    bootstrap: { ...bootstrap, counts },
    activePage,
    setActivePage,
    skills,
    marketSkills,
    installedSkills,
    selectedSkill,
    selectedSkillID,
    selectSkill,
    openSkill,
    tools,
    projects,
    notifications,
    offlineEvents,
    filters,
    setFilters,
    departments,
    compatibleTools,
    progress,
    authError,
    login,
    logout: () => setLoggedIn(false),
    refreshBootstrap,
    setConnectionStatus,
    installOrUpdate,
    enableSkill,
    disableSkill,
    uninstallSkill,
    toggleStar,
    markNotificationsRead,
    syncOfflineEvents,
    refreshTools
  };
}
