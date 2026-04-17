import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AuthState, BootstrapContext, LocalBootstrap, LocalEvent, LocalNotification, ScanTargetSummary } from "../../domain/p1";
import { p1Client } from "../../services/p1Client";
import { desktopBridge } from "../../services/tauriBridge";
import { upsertNotifications } from "../p1WorkspaceHelpers";
import type { HandleRemoteError } from "./workspaceTypes";
import { emptyLocalNotifications } from "./workspaceTypes";

export function useWorkspaceLocalSyncState() {
  const [tools, setTools] = useState<LocalBootstrap["tools"]>([]);
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
  refreshLocalBootstrap: () => Promise<LocalBootstrap>;
  refreshLocalScans: () => Promise<ScanTargetSummary[]>;
  setNotifications: Dispatch<SetStateAction<LocalNotification[]>>;
  setProjects: Dispatch<SetStateAction<LocalBootstrap["projects"]>>;
  setTools: Dispatch<SetStateAction<LocalBootstrap["tools"]>>;
}) {
  const {
    authState,
    bootstrap,
    handleRemoteError,
    notifications,
    refreshLocalBootstrap,
    refreshLocalScans,
    setNotifications,
    setProjects,
    setTools
  } = input;

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

  const scanLocalTargets = useCallback(async () => {
    return refreshLocalScans();
  }, [refreshLocalScans]);

  const validateTargetPath = useCallback(async (targetPath: string) => {
    return desktopBridge.validateTargetPath(targetPath);
  }, []);

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

  return {
    markNotificationsRead,
    pickProjectDirectory,
    refreshTools,
    saveProjectConfig,
    saveToolConfig,
    scanLocalTargets,
    validateTargetPath
  };
}
