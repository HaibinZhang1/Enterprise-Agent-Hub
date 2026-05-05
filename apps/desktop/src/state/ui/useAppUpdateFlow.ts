import packageInfo from "../../../package.json" with { type: "json" };
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { prepareClientUpdateInstall, launchPreparedClientUpdateInstall } from "../../services/clientUpdateFlow.ts";
import { desktopBridge } from "../../services/desktopBridge.ts";
import { clearRemoteWriteGuardStatus, p1Client, setRemoteWriteGuardStatus } from "../../services/p1Client.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";
import {
  cacheClientUpdateCheck,
  deriveAppUpdateState,
  dismissOptionalClientUpdate,
  extractServerAppUpdateNotification,
  readClientUpdateCache,
  resolveCompletedClientUpdateInstall,
  resolveClientUpdateDeviceID,
  shouldUseCachedClientUpdate,
  writeClientUpdateCache,
  type ClientUpdateCache
} from "./clientUpdates.ts";
import type { FlashMessage } from "./feedback.ts";
import type { ConfirmModalState } from "./modalPresentation.ts";

interface UseAppUpdateFlowInput {
  readonly workspace: P1WorkspaceState;
  readonly closeModal: () => void;
  readonly presentBlockingConfirm: (nextConfirm: ConfirmModalState | null) => void;
  readonly setFlash: Dispatch<SetStateAction<FlashMessage | null>>;
}

export function useAppUpdateFlow(input: UseAppUpdateFlowInput) {
  const { closeModal, presentBlockingConfirm, setFlash, workspace } = input;
  const [clientUpdateCache, setClientUpdateCache] = useState<ClientUpdateCache | null>(() => readClientUpdateCache());
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [processingAppUpdate, setProcessingAppUpdate] = useState(false);
  const [appUpdateError, setAppUpdateError] = useState<string | null>(null);

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

    let cancelled = false;

    async function syncClientUpdateState() {
      const completedInstall = resolveCompletedClientUpdateInstall(clientUpdateCache, packageInfo.version);
      if (completedInstall) {
        try {
          await p1Client.reportClientUpdateEvent({
            releaseID: completedInstall.releaseID,
            eventType: "installed",
            deviceID: resolveClientUpdateDeviceID(),
            fromVersion: completedInstall.fromVersion,
            toVersion: completedInstall.toVersion
          });
        } catch (error) {
          if (!cancelled) {
            setAppUpdateError(error instanceof Error ? error.message : "上报客户端更新完成状态失败，请稍后重试。");
          }
          return;
        }

        if (cancelled) return;
        setClientUpdateCache(null);
        writeClientUpdateCache(null);
        setAppUpdateError(null);

        try {
          await workspace.refreshBootstrap();
        } catch (error) {
          if (!cancelled) {
            setAppUpdateError(error instanceof Error ? error.message : "刷新客户端更新通知失败，请稍后重试。");
          }
        }

        if (cancelled) return;
      }

      await refreshAppUpdate({ force: Boolean(completedInstall) });
    }

    void syncClientUpdateState();
    return () => {
      cancelled = true;
    };
  }, [clientUpdateCache, refreshAppUpdate, workspace.bootstrap.connection.status, workspace.loggedIn, workspace.refreshBootstrap]);

  useEffect(() => {
    if (workspace.loggedIn && workspace.bootstrap.connection.status === "connected" && (appUpdate.status === "mandatory_update" || appUpdate.status === "unsupported_version")) {
      setRemoteWriteGuardStatus(appUpdate.status);
      return;
    }
    clearRemoteWriteGuardStatus();
  }, [appUpdate.status, workspace.bootstrap.connection.status, workspace.loggedIn]);

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
                downloadResult: prepared.downloadResult,
                userConfirmed: true
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
    presentBlockingConfirm,
    processingAppUpdate,
    setFlash
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
  }, [appUpdateError, refreshAppUpdate, setFlash]);

  return {
    appUpdate,
    dismissOptionalAppUpdate,
    recheckAppUpdate,
    viewAppUpdate
  };
}
