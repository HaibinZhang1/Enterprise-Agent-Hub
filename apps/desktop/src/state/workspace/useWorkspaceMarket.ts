import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  BootstrapContext,
  DiscoveredLocalSkill,
  LocalBootstrap,
  LocalNotification,
  OperationProgress,
  RequestedMode,
  ScanTargetSummary,
  SkillLeaderboardsResponse,
  SkillSummary,
  TargetType
} from "../../domain/p1";
import { isPermissionError, isUnauthenticatedError, p1Client } from "../../services/p1Client";
import { desktopBridge } from "../../services/tauriBridge";
import {
  applyLocalInstallToSkill,
  applySkill,
  notificationFromProgress
} from "../p1WorkspaceHelpers";
import type { RequireAuthenticatedAction } from "./workspaceTypes";
import { defaultFilters } from "./workspaceTypes";

function actionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "本地命令执行失败，请稍后重试。";
}

export type CommunityLeaderboardsState = SkillLeaderboardsResponse | null;

export function useWorkspaceMarketState() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [leaderboards, setLeaderboards] = useState<CommunityLeaderboardsState>(null);
  const [leaderboardsLoading, setLeaderboardsLoading] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedSkillID, setSelectedSkillID] = useState("");
  const [progress, setProgress] = useState<OperationProgress | null>(null);

  const selectSkill = useCallback((skillID: string) => {
    setSelectedSkillID(skillID);
  }, []);

  const updateSkillProgress = useCallback((nextProgress: OperationProgress) => {
    setProgress(nextProgress);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    clearProgress,
    filters,
    leaderboards,
    leaderboardsLoading,
    progress,
    selectSkill,
    selectedSkillID,
    setFilters,
    setLeaderboards,
    setLeaderboardsLoading,
    setProgress,
    setSelectedSkillID,
    setSkills,
    skills,
    updateSkillProgress
  };
}

export function useWorkspaceMarketActions(input: {
  bootstrap: BootstrapContext;
  persistNotifications: (incoming: LocalNotification[]) => Promise<void>;
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  refreshLocalScans: () => Promise<ScanTargetSummary[]>;
  requireAuthenticatedAction: RequireAuthenticatedAction;
  setLeaderboards: Dispatch<SetStateAction<CommunityLeaderboardsState>>;
  setLeaderboardsLoading: Dispatch<SetStateAction<boolean>>;
  setOfflineEvents: Dispatch<SetStateAction<LocalBootstrap["offlineEvents"]>>;
  setSkills: Dispatch<SetStateAction<SkillSummary[]>>;
  skills: SkillSummary[];
  updateSkillProgress: (nextProgress: OperationProgress) => void;
}) {
  const {
    bootstrap,
    persistNotifications,
    refreshLocalBootstrap,
    refreshLocalScans,
    requireAuthenticatedAction,
    setLeaderboards,
    setLeaderboardsLoading,
    setOfflineEvents,
    setSkills,
    skills,
    updateSkillProgress
  } = input;

  const refreshLeaderboards = useCallback(async () => {
    if (bootstrap.connection.status !== "connected") return;
    setLeaderboardsLoading(true);
    try {
      setLeaderboards(await p1Client.listSkillLeaderboards());
    } finally {
      setLeaderboardsLoading(false);
    }
  }, [bootstrap.connection.status, setLeaderboards, setLeaderboardsLoading]);

  const refreshLocalRuntime = useCallback(async () => {
    const [localBootstrapResult] = await Promise.allSettled([
      refreshLocalBootstrap(),
      refreshLocalScans()
    ]);
    if (localBootstrapResult.status === "fulfilled") {
      setOfflineEvents(localBootstrapResult.value.offlineEvents);
    }
  }, [refreshLocalBootstrap, refreshLocalScans, setOfflineEvents]);

  const performInstallOrUpdate = useCallback(
    async (skillID: string, operation: "install" | "update") => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      if (bootstrap.connection.status !== "connected") {
        updateSkillProgress({ operation, skillID, stage: "blocked_offline", result: "failed", message: "离线模式下不能安装或更新市场 Skill。" });
        return;
      }
      try {
        const stages = ["获取下载凭证", "下载包", "校验大小和文件数", "校验 SHA-256", "写入 Central Store"];
        for (const stage of stages) {
          updateSkillProgress({ operation, skillID, stage, result: "running", message: stage });
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
        const downloadTicket = await p1Client.downloadTicket(skill, operation);
        const result = operation === "install" ? await desktopBridge.installSkillPackage(downloadTicket) : await desktopBridge.updateSkillPackage(downloadTicket);
        const refreshedSkill = await p1Client.getSkill(skillID).catch(() => null);
        const localBootstrap = await refreshLocalBootstrap();
        await refreshLocalScans();
        setSkills((current) =>
          applySkill(current, skillID, (item) => {
            const remoteBase = refreshedSkill
              ? {
                  ...item,
                  ...refreshedSkill,
                  localVersion: item.localVersion,
                  installState: item.installState,
                  enabledTargets: item.enabledTargets,
                  lastEnabledAt: item.lastEnabledAt,
                  hasLocalHashDrift: item.hasLocalHashDrift
                }
              : item;
            return applyLocalInstallToSkill(remoteBase, result);
          })
        );
        setOfflineEvents(localBootstrap.offlineEvents);
        await refreshLeaderboards().catch(() => undefined);
        const nextProgress: OperationProgress = {
          operation,
          skillID,
          stage: "完成",
          result: "success",
          message: `${skill.displayName} 已写入 Central Store，原启用位置不会被自动覆盖。`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
      } catch (error) {
        if (isUnauthenticatedError(error) || isPermissionError(error)) {
          throw error;
        }
        await refreshLocalRuntime();
        const nextProgress: OperationProgress = {
          operation,
          skillID,
          stage: "失败",
          result: "failed",
          message: `${skill.displayName} ${operation === "install" ? "安装" : "更新"}失败：${actionErrorMessage(error)}`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
      }
    },
    [bootstrap.connection.status, persistNotifications, refreshLeaderboards, refreshLocalBootstrap, refreshLocalRuntime, refreshLocalScans, setOfflineEvents, setSkills, skills, updateSkillProgress]
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
    async (skillID: string, targetType: TargetType, targetID: string, requestedMode: RequestedMode = "symlink", allowOverwrite = false) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill || !skill.localVersion || skill.isScopeRestricted) return;
      updateSkillProgress({ operation: "enable", skillID, stage: "目标转换与写入", result: "running", message: "正在调用 Tauri Adapter 启用 Skill。" });
      try {
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
        await persistNotifications([notificationFromProgress(nextProgress, result.target.fallbackReason)]);
      } catch (error) {
        await refreshLocalRuntime();
        const nextProgress: OperationProgress = {
          operation: "enable",
          skillID,
          stage: "失败",
          result: "failed",
          message: `${skill.displayName} 启用失败：${actionErrorMessage(error)}`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
        throw new Error(nextProgress.message);
      }
    },
    [persistNotifications, refreshLocalBootstrap, refreshLocalRuntime, refreshLocalScans, setOfflineEvents, setSkills, skills, updateSkillProgress]
  );

  const disableSkill = useCallback(
    async (skillID: string, targetID: string, targetType?: TargetType) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "disable", skillID, stage: "移除托管目标", result: "running", message: "正在停用目标；不会删除 Central Store。" });
      try {
        await desktopBridge.disableSkill({ skill, targetID, targetType });
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
        await persistNotifications([notificationFromProgress(nextProgress)]);
      } catch (error) {
        await refreshLocalRuntime();
        const nextProgress: OperationProgress = {
          operation: "disable",
          skillID,
          stage: "失败",
          result: "failed",
          message: `${skill.displayName} 停用失败：${actionErrorMessage(error)}`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
        throw new Error(nextProgress.message);
      }
    },
    [persistNotifications, refreshLocalBootstrap, refreshLocalRuntime, refreshLocalScans, setOfflineEvents, setSkills, skills, updateSkillProgress]
  );

  const uninstallSkill = useCallback(
    async (skillID: string) => {
      const skill = skills.find((item) => item.skillID === skillID);
      if (!skill) return;
      updateSkillProgress({ operation: "uninstall", skillID, stage: "确认引用并删除", result: "running", message: "正在通过 Store 命令删除 Central Store 与托管目标。" });
      try {
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
          message:
            result.failedTargetIDs.length === 0
              ? `${skill.displayName} 已卸载。`
              : `${skill.displayName} 已卸载，但仍有 ${result.failedTargetIDs.length} 个目标需要手动清理。`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
      } catch (error) {
        await refreshLocalRuntime();
        const nextProgress: OperationProgress = {
          operation: "uninstall",
          skillID,
          stage: "失败",
          result: "failed",
          message: `${skill.displayName} 卸载失败：${actionErrorMessage(error)}`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
      }
    },
    [persistNotifications, refreshLocalBootstrap, refreshLocalRuntime, refreshLocalScans, setOfflineEvents, setSkills, skills, updateSkillProgress]
  );

  const importLocalSkill = useCallback(
    async (skill: DiscoveredLocalSkill, finalSkillID: string, conflictStrategy: "rename" | "replace" = "rename") => {
      const primaryTarget = skill.targets[0];
      if (!primaryTarget) return;
      updateSkillProgress({
        operation: "import",
        skillID: finalSkillID,
        stage: "校验来源",
        result: "running",
        message: "正在校验本地 Skill 来源目录。"
      });
      try {
        updateSkillProgress({
          operation: "import",
          skillID: finalSkillID,
          stage: "写入 Central Store",
          result: "running",
          message: "正在复制到本机 Central Store，并认领原启用路径。"
        });
        const result = await desktopBridge.importLocalSkill({
          targetType: primaryTarget.targetType,
          targetID: primaryTarget.targetID,
          relativePath: primaryTarget.relativePath,
          skillID: finalSkillID,
          conflictStrategy
        });
        const localBootstrap = await refreshLocalBootstrap();
        await refreshLocalScans();
        setSkills((current) => {
          const exists = current.some((item) => item.skillID === finalSkillID);
          const nextSkill = applyLocalInstallToSkill(
            exists ? current.find((item) => item.skillID === finalSkillID)! : {
              skillID: finalSkillID,
              displayName: result.displayName,
              description: "从本地工具或项目目录纳入 Central Store 管理的 Skill。",
              version: result.localVersion,
              localVersion: result.localVersion,
              latestVersion: result.localVersion,
              status: "published",
              visibilityLevel: "detail_visible",
              detailAccess: "summary",
              canInstall: false,
              canUpdate: false,
              installState: "installed",
              currentVersionUpdatedAt: result.updatedAt,
              publishedAt: result.installedAt,
              compatibleTools: [],
              compatibleSystems: [],
              tags: ["本地托管"],
              category: "本地",
              riskLevel: "unknown",
              starCount: 0,
              downloadCount: 0,
              starred: false,
              isScopeRestricted: false,
              hasLocalHashDrift: false,
              enabledTargets: [],
              lastEnabledAt: null
            },
            result
          );
          return exists ? current.map((item) => (item.skillID === finalSkillID ? nextSkill : item)) : [nextSkill, ...current];
        });
        setOfflineEvents(localBootstrap.offlineEvents);
        const nextProgress: OperationProgress = {
          operation: "import",
          skillID: finalSkillID,
          stage: "完成",
          result: "success",
          message: `${result.displayName} 已纳入 Central Store 管理。`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
      } catch (error) {
        await refreshLocalRuntime();
        const nextProgress: OperationProgress = {
          operation: "import",
          skillID: finalSkillID,
          stage: "失败",
          result: "failed",
          message: `${skill.displayName} 纳入管理失败：${actionErrorMessage(error)}`
        };
        updateSkillProgress(nextProgress);
        await persistNotifications([notificationFromProgress(nextProgress)]);
        throw new Error(nextProgress.message);
      }
    },
    [persistNotifications, refreshLocalBootstrap, refreshLocalRuntime, refreshLocalScans, setOfflineEvents, setSkills, updateSkillProgress]
  );

  const toggleStar = useCallback(
    async (skillID: string) => {
      requireAuthenticatedAction("market", async () => {
        const skill = skills.find((item) => item.skillID === skillID);
        if (!skill) return;
        const result = await p1Client.star(skillID, !skill.starred);
        setSkills((current) => applySkill(current, skillID, (item) => ({ ...item, starred: result.starred, starCount: result.starCount })));
        await refreshLeaderboards().catch(() => undefined);
      });
    },
    [refreshLeaderboards, requireAuthenticatedAction, setSkills, skills]
  );

  return {
    disableSkill,
    importLocalSkill,
    enableSkill,
    installOrUpdate,
    performInstallOrUpdate,
    refreshLeaderboards,
    toggleStar,
    uninstallSkill
  };
}
