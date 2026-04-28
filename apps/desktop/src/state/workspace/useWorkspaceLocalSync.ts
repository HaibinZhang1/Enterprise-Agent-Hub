import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AuthState, BootstrapContext, ExtensionInstall, LocalBootstrap, LocalEvent, LocalNotification, OperationProgress, RequestedMode, ScanTargetSummary, TargetType } from "../../domain/p1";
import { p1Client } from "../../services/p1Client.ts";
import { desktopBridge } from "../../services/desktopBridge.ts";
import { upsertNotifications } from "../p1WorkspaceHelpers.ts";
import { scanTargetsErrorMessage, scanTargetsSummaryMessage } from "./scanProgress.ts";
import type { HandleRemoteError } from "./workspaceTypes.ts";
import { emptyLocalNotifications } from "./workspaceTypes.ts";

interface SyncPendingOfflineEventsInput {
  authState: AuthState;
  connectionStatus: BootstrapContext["connection"]["status"];
  offlineEvents: LocalEvent[];
  handleRemoteError: HandleRemoteError;
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  setOfflineEvents: Dispatch<SetStateAction<LocalEvent[]>>;
  syncLocalEvents: typeof p1Client.syncLocalEvents;
  markOfflineEventsSynced: typeof desktopBridge.markOfflineEventsSynced;
}

export async function syncPendingOfflineEvents(input: SyncPendingOfflineEventsInput): Promise<boolean> {
  if (input.authState !== "authenticated" || input.connectionStatus !== "connected" || input.offlineEvents.length === 0) {
    return false;
  }

  try {
    const response = await input.syncLocalEvents(input.offlineEvents);
    if (response.acceptedEventIDs.length === 0) {
      return false;
    }
    const markedEventIDs = await input.markOfflineEventsSynced(response.acceptedEventIDs);
    const syncedEventIDs = new Set(markedEventIDs.length > 0 ? markedEventIDs : response.acceptedEventIDs);
    input.setOfflineEvents((current) => current.filter((event) => !syncedEventIDs.has(event.eventID)));
    await input.refreshLocalBootstrap();
    return true;
  } catch (error) {
    await input.handleRemoteError(error);
    return false;
  }
}

function localActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "本地命令执行失败，请稍后重试。";
}

export function useWorkspaceLocalSyncState() {
  const [tools, setTools] = useState<LocalBootstrap["tools"]>([]);
  const [extensions, setExtensions] = useState<ExtensionInstall[]>([]);
  const [projects, setProjects] = useState<LocalBootstrap["projects"]>([]);
  const [notifications, setNotifications] = useState<LocalNotification[]>(emptyLocalNotifications);
  const [offlineEvents, setOfflineEvents] = useState<LocalEvent[]>([]);
  const [localCentralStorePath, setLocalCentralStorePath] = useState("");
  const [scanTargets, setScanTargets] = useState<ScanTargetSummary[]>([]);

  const localBootstrapRef = useRef<LocalBootstrap | null>(null);
  const localNotificationsRef = useRef<LocalNotification[]>(emptyLocalNotifications);

  const refreshLocalBootstrap = useCallback(async () => {
    const localBootstrap = await desktopBridge.getLocalBootstrap();
    localBootstrapRef.current = localBootstrap;
    setTools(localBootstrap.tools);
    setExtensions(localBootstrap.extensions ?? []);
    setProjects(localBootstrap.projects);
    localNotificationsRef.current = localBootstrap.notifications;
    setOfflineEvents(localBootstrap.offlineEvents);
    setLocalCentralStorePath(localBootstrap.centralStorePath);
    return localBootstrap;
  }, []);

  const refreshLocalScans = useCallback(async () => {
    const summaries = await desktopBridge.scanLocalTargets();
    setScanTargets(summaries);
    return summaries;
  }, []);

  const persistNotifications = useCallback(async (incoming: LocalNotification[]) => {
    if (incoming.length === 0) {
      return;
    }
    setNotifications((current) => upsertNotifications(current, incoming));
    await desktopBridge.upsertLocalNotifications(incoming).catch(() => undefined);
  }, []);

  useEffect(() => {
    localNotificationsRef.current = notifications;
  }, [notifications]);

  return {
    extensions,
    localBootstrapRef,
    localCentralStorePath,
    localNotificationsRef,
    notifications,
    offlineEvents,
    persistNotifications,
    projects,
    refreshLocalBootstrap,
    refreshLocalScans,
    scanTargets,
    setLocalCentralStorePath,
    setNotifications,
    setOfflineEvents,
    setExtensions,
    setProjects,
    setScanTargets,
    setTools,
    tools
  };
}

export function useWorkspaceLocalSyncActions(input: {
  authState: AuthState;
  bootstrap: BootstrapContext;
  handleRemoteError: HandleRemoteError;
  notifications: LocalNotification[];
  offlineEvents: LocalEvent[];
  extensions: ExtensionInstall[];
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  refreshLocalScans: () => Promise<ScanTargetSummary[]>;
  setExtensions: Dispatch<SetStateAction<ExtensionInstall[]>>;
  setNotifications: Dispatch<SetStateAction<LocalNotification[]>>;
  setOfflineEvents: Dispatch<SetStateAction<LocalEvent[]>>;
  setProjects: Dispatch<SetStateAction<LocalBootstrap["projects"]>>;
  setTools: Dispatch<SetStateAction<LocalBootstrap["tools"]>>;
  updateSkillProgress: (nextProgress: OperationProgress) => void;
}) {
  const {
    authState,
    bootstrap,
    handleRemoteError,
    notifications,
    offlineEvents,
    extensions,
    refreshLocalBootstrap,
    refreshLocalScans,
    setExtensions,
    setNotifications,
    setOfflineEvents,
    setProjects,
    setTools,
    updateSkillProgress
  } = input;
  const offlineEventsSyncingRef = useRef(false);

  const syncOfflineEvents = useCallback(async () => {
    if (offlineEventsSyncingRef.current) {
      return false;
    }
    offlineEventsSyncingRef.current = true;
    try {
      return await syncPendingOfflineEvents({
        authState,
        connectionStatus: bootstrap.connection.status,
        offlineEvents,
        handleRemoteError,
        refreshLocalBootstrap,
        setOfflineEvents,
        syncLocalEvents: p1Client.syncLocalEvents,
        markOfflineEventsSynced: desktopBridge.markOfflineEventsSynced
      });
    } finally {
      offlineEventsSyncingRef.current = false;
    }
  }, [authState, bootstrap.connection.status, handleRemoteError, offlineEvents, refreshLocalBootstrap, setOfflineEvents]);

  const markNotificationsRead = useCallback(
    async (notificationIDs: string[] | "all") => {
      const selectedNotifications =
        notificationIDs === "all" ? notifications : notifications.filter((notification) => notificationIDs.includes(notification.notificationID));
      const selectedIDs = new Set(selectedNotifications.map((notification) => notification.notificationID));
      const serverNotificationIDs = selectedNotifications
        .filter((notification) => notification.source === "server")
        .map((notification) => notification.notificationID);

      if (authState === "authenticated" && bootstrap.connection.status === "connected") {
        if (notificationIDs === "all" ? notifications.some((notification) => notification.source === "server") : serverNotificationIDs.length > 0) {
          try {
            await p1Client.markNotificationsRead(notificationIDs === "all" ? "all" : serverNotificationIDs);
          } catch (error) {
            await handleRemoteError(error);
            return;
          }
        }
      }

      await desktopBridge.markLocalNotificationsRead(
        notificationIDs === "all" ? "all" : selectedNotifications.map((notification) => notification.notificationID)
      );
      setNotifications((current) =>
        current.map((notification) =>
          notificationIDs === "all" || selectedIDs.has(notification.notificationID) ? { ...notification, unread: false } : notification
        )
      );
    },
    [authState, bootstrap.connection.status, handleRemoteError, notifications, setNotifications]
  );

  const refreshTools = useCallback(async () => {
    const detectedTools = await desktopBridge.refreshToolDetection();
    setTools(detectedTools);
    await refreshLocalScans();
  }, [refreshLocalScans, setTools]);

  const saveToolConfig = useCallback(
    async (tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }) => {
      const saved = await desktopBridge.saveToolConfig(tool);
      const localBootstrap = await refreshLocalBootstrap();
      setTools(localBootstrap.tools);
      await refreshLocalScans();
      return saved;
    },
    [refreshLocalBootstrap, refreshLocalScans, setTools]
  );

  const deleteToolConfig = useCallback(
    async (toolID: string) => {
      await desktopBridge.deleteToolConfig(toolID);
      const localBootstrap = await refreshLocalBootstrap();
      setTools(localBootstrap.tools);
      await refreshLocalScans();
    },
    [refreshLocalBootstrap, refreshLocalScans, setTools]
  );

  const scanLocalTargets = useCallback(async () => {
    updateSkillProgress({
      operation: "scan",
      skillID: "local-targets",
      stage: "启动扫描",
      result: "running",
      message: "正在扫描工具与项目目录。"
    });
    try {
      updateSkillProgress({
        operation: "scan",
        skillID: "local-targets",
        stage: "读取工具和项目目录",
        result: "running",
        message: "正在读取已配置工具和项目的 Skills 路径。"
      });
      const summaries = await refreshLocalScans();
      updateSkillProgress({
        operation: "scan",
        skillID: "local-targets",
        stage: "完成",
        result: "success",
        message: scanTargetsSummaryMessage(summaries)
      });
      return summaries;
    } catch (error) {
      updateSkillProgress({
        operation: "scan",
        skillID: "local-targets",
        stage: "失败",
        result: "failed",
        message: scanTargetsErrorMessage(error)
      });
      throw error;
    }
  }, [refreshLocalScans, updateSkillProgress]);

  const validateTargetPath = useCallback(async (targetPath: string) => {
    return desktopBridge.validateTargetPath(targetPath);
  }, []);

  const enableExtension = useCallback(
    async (extensionID: string, targetType: TargetType, targetID: string, requestedMode: RequestedMode = "symlink", allowOverwrite = false) => {
      const extension = extensions.find((item) => item.extensionID === extensionID);
      if (!extension) return;
      updateSkillProgress({
        operation: "enable",
        skillID: extensionID,
        stage: "Extension 写入门禁",
        result: "running",
        message: "正在通过 Extension 门禁调用本地 Adapter。"
      });
      try {
        const target = await desktopBridge.enableExtension({
          extension,
          targetType,
          targetID,
          requestedMode,
          allowOverwrite
        });
        const localBootstrap = await refreshLocalBootstrap();
        await refreshLocalScans();
        setExtensions(localBootstrap.extensions ?? []);
        setOfflineEvents(localBootstrap.offlineEvents);
        updateSkillProgress({
          operation: "enable",
          skillID: extensionID,
          stage: "完成",
          result: "success",
          message: `${extension.displayName} 已启用到 ${target.targetName}`
        });
      } catch (error) {
        const localBootstrap = await refreshLocalBootstrap().catch(() => null);
        if (localBootstrap) {
          setExtensions(localBootstrap.extensions ?? []);
          setOfflineEvents(localBootstrap.offlineEvents);
        }
        await refreshLocalScans().catch(() => undefined);
        const message = `${extension.displayName} 启用失败：${localActionErrorMessage(error)}`;
        updateSkillProgress({
          operation: "enable",
          skillID: extensionID,
          stage: "失败",
          result: "failed",
          message
        });
        throw new Error(message);
      }
    },
    [extensions, refreshLocalBootstrap, refreshLocalScans, setExtensions, setOfflineEvents, updateSkillProgress]
  );

  const disableExtension = useCallback(
    async (extensionID: string, targetID: string, targetType?: TargetType) => {
      const extension = extensions.find((item) => item.extensionID === extensionID);
      if (!extension) return;
      updateSkillProgress({
        operation: "disable",
        skillID: extensionID,
        stage: "移除 Extension 目标",
        result: "running",
        message: "正在停用托管 Extension 目标。"
      });
      try {
        const target = await desktopBridge.disableExtension({ extension, targetID, targetType });
        const localBootstrap = await refreshLocalBootstrap();
        await refreshLocalScans();
        setExtensions(localBootstrap.extensions ?? []);
        setOfflineEvents(localBootstrap.offlineEvents);
        updateSkillProgress({
          operation: "disable",
          skillID: extensionID,
          stage: "完成",
          result: "success",
          message: `${extension.displayName} 已从 ${target.targetName} 停用。`
        });
      } catch (error) {
        const localBootstrap = await refreshLocalBootstrap().catch(() => null);
        if (localBootstrap) {
          setExtensions(localBootstrap.extensions ?? []);
          setOfflineEvents(localBootstrap.offlineEvents);
        }
        await refreshLocalScans().catch(() => undefined);
        const message = `${extension.displayName} 停用失败：${localActionErrorMessage(error)}`;
        updateSkillProgress({
          operation: "disable",
          skillID: extensionID,
          stage: "失败",
          result: "failed",
          message
        });
        throw new Error(message);
      }
    },
    [extensions, refreshLocalBootstrap, refreshLocalScans, setExtensions, setOfflineEvents, updateSkillProgress]
  );

  const pickProjectDirectory = useCallback(async () => {
    return desktopBridge.pickProjectDirectory();
  }, []);

  const saveProjectConfig = useCallback(
    async (project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }) => {
      const saved = await desktopBridge.saveProjectConfig(project);
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setProjects(localBootstrap.projects);
      return saved;
    },
    [refreshLocalBootstrap, refreshLocalScans, setProjects]
  );

  const deleteProjectConfig = useCallback(
    async (projectID: string) => {
      await desktopBridge.deleteProjectConfig(projectID);
      const localBootstrap = await refreshLocalBootstrap();
      await refreshLocalScans();
      setProjects(localBootstrap.projects);
    },
    [refreshLocalBootstrap, refreshLocalScans, setProjects]
  );

  return {
    deleteProjectConfig,
    deleteToolConfig,
    disableExtension,
    enableExtension,
    markNotificationsRead,
    pickProjectDirectory,
    refreshTools,
    saveProjectConfig,
    saveToolConfig,
    scanLocalTargets,
    syncOfflineEvents,
    validateTargetPath
  };
}
