import packageInfo from "../../../package.json" with { type: "json" };
import { detectDesktopPlatform } from "../../utils/platformPaths.ts";
import { localCommandErrorMessage, pendingLocalCommand } from "./common.ts";
import { allowDesktopMocks, getInvoke, invokeWithTimeout, isBrowserPreviewMode, mockWait, requireInvoke, type DesktopInvoker } from "./runtime.ts";

export const CLIENT_UPDATE_LOCAL_COMMANDS = {
  getClientAppVersion: "get_client_app_version",
  downloadClientUpdate: "download_client_update",
  verifyClientUpdate: "verify_client_update",
  launchClientInstaller: "launch_client_installer"
} as const;

export type ClientUpdateSignatureStatus = "pending" | "valid" | "invalid" | "skipped_non_windows" | "check_failed";

export interface ClientAppVersionInfo {
  currentVersion: string;
  platform: string;
  arch: string;
  windowsX64Supported: boolean;
}

export interface ClientUpdateArtifactInput {
  releaseID: string;
  version: string;
  packageURL: string;
  packageHash: string;
  packageSize: number;
  fileName?: string | null;
}

export interface ClientUpdateDownloadResult {
  releaseID: string;
  version: string;
  fileName: string;
  stagedFilePath: string;
  metadataPath: string;
  packageHash: string;
  packageSize: number;
  downloadedAt: string;
  hashVerified: boolean;
  signatureStatus: ClientUpdateSignatureStatus;
  readyToInstall: boolean;
}

export interface ClientUpdateVerifyInput {
  metadataPath: string;
}

export interface ClientUpdateVerificationResult {
  releaseID: string;
  version: string;
  stagedFilePath: string;
  metadataPath: string;
  expectedHash: string;
  actualHash: string;
  verifiedAt: string;
  hashVerified: boolean;
  signatureStatus: ClientUpdateSignatureStatus;
  signatureDetails: string | null;
  readyToInstall: boolean;
}

export interface ClientUpdateLaunchInput {
  metadataPath: string;
  userConfirmed: boolean;
}

export interface ClientUpdateLaunchResult {
  releaseID: string;
  version: string;
  stagedFilePath: string;
  metadataPath: string;
  launchedAt: string;
  readyToInstall: boolean;
}

async function callClientUpdateCommand<T>(
  invoke: DesktopInvoker,
  command: string,
  args: Record<string, unknown> | undefined,
  actionLabel: string,
  timeoutMs?: number
): Promise<T> {
  try {
    return await invokeWithTimeout<T>(invoke, command, args, timeoutMs);
  } catch (error) {
    throw new Error(localCommandErrorMessage(error, actionLabel));
  }
}

const CLIENT_UPDATE_COMMAND_TIMEOUT_MS = {
  download: 10 * 60_000,
  verify: 5 * 60_000,
  launch: 60_000
} as const;

function previewVersionInfo(): ClientAppVersionInfo {
  const platform = detectDesktopPlatform();
  return {
    currentVersion: packageInfo.version,
    platform,
    arch: platform === "windows" ? "x86_64" : "unknown",
    windowsX64Supported: platform === "windows"
  };
}

function mockDownloadResult(input: ClientUpdateArtifactInput): ClientUpdateDownloadResult {
  const fileName = input.fileName?.trim() || `EnterpriseAgentHubSetup-${input.version}.exe`;
  const basePath = `preview://client-updates/${input.releaseID}/${input.version}`;
  return {
    releaseID: input.releaseID,
    version: input.version,
    fileName,
    stagedFilePath: `${basePath}/${fileName}`,
    metadataPath: `${basePath}/metadata.json`,
    packageHash: input.packageHash,
    packageSize: input.packageSize,
    downloadedAt: new Date().toISOString(),
    hashVerified: true,
    signatureStatus: "pending",
    readyToInstall: false
  };
}

function mockVerificationResult(input: ClientUpdateVerifyInput): ClientUpdateVerificationResult {
  const versionInfo = previewVersionInfo();
  const signatureStatus: ClientUpdateSignatureStatus = versionInfo.windowsX64Supported ? "check_failed" : "skipped_non_windows";
  return {
    releaseID: "preview-release",
    version: packageInfo.version,
    stagedFilePath: input.metadataPath.replace(/metadata\.json$/u, `EnterpriseAgentHubSetup-${packageInfo.version}.exe`),
    metadataPath: input.metadataPath,
    expectedHash: "sha256:preview",
    actualHash: "sha256:preview",
    verifiedAt: new Date().toISOString(),
    hashVerified: true,
    signatureStatus,
    signatureDetails: signatureStatus === "skipped_non_windows" ? "Authenticode verification requires Windows." : "Preview mode does not run native signature verification.",
    readyToInstall: signatureStatus === "skipped_non_windows"
  };
}

export async function getClientAppVersion(): Promise<ClientAppVersionInfo> {
  const invoke = getInvoke();
  if (invoke) {
    return callClientUpdateCommand<ClientAppVersionInfo>(
      invoke,
      CLIENT_UPDATE_LOCAL_COMMANDS.getClientAppVersion,
      undefined,
      "读取客户端版本"
    );
  }
  if (isBrowserPreviewMode()) {
    return previewVersionInfo();
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(60);
  return previewVersionInfo();
}

export async function downloadClientUpdate(input: ClientUpdateArtifactInput): Promise<ClientUpdateDownloadResult> {
  const invoke = getInvoke();
  if (invoke) {
    return callClientUpdateCommand<ClientUpdateDownloadResult>(
      invoke,
      CLIENT_UPDATE_LOCAL_COMMANDS.downloadClientUpdate,
      { input },
      "下载客户端更新",
      CLIENT_UPDATE_COMMAND_TIMEOUT_MS.download
    );
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("download_client_update");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(220);
  return mockDownloadResult(input);
}

export async function verifyClientUpdate(input: ClientUpdateVerifyInput): Promise<ClientUpdateVerificationResult> {
  const invoke = getInvoke();
  if (invoke) {
    return callClientUpdateCommand<ClientUpdateVerificationResult>(
      invoke,
      CLIENT_UPDATE_LOCAL_COMMANDS.verifyClientUpdate,
      { input },
      "校验客户端更新",
      CLIENT_UPDATE_COMMAND_TIMEOUT_MS.verify
    );
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("verify_client_update");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(180);
  return mockVerificationResult(input);
}

export async function launchClientInstaller(input: ClientUpdateLaunchInput): Promise<ClientUpdateLaunchResult> {
  const invoke = getInvoke();
  if (invoke) {
    return callClientUpdateCommand<ClientUpdateLaunchResult>(
      invoke,
      CLIENT_UPDATE_LOCAL_COMMANDS.launchClientInstaller,
      { input },
      "启动安装程序",
      CLIENT_UPDATE_COMMAND_TIMEOUT_MS.launch
    );
  }
  if (isBrowserPreviewMode()) {
    throw pendingLocalCommand("launch_client_installer");
  }
  if (!allowDesktopMocks) {
    await requireInvoke();
  }
  await mockWait(120);
  return {
    releaseID: "preview-release",
    version: packageInfo.version,
    stagedFilePath: input.metadataPath.replace(/metadata\.json$/u, `EnterpriseAgentHubSetup-${packageInfo.version}.exe`),
    metadataPath: input.metadataPath,
    launchedAt: new Date().toISOString(),
    readyToInstall: true
  };
}
