import type { P1Client, ClientUpdateDownloadTicket } from "./p1Client.ts";
import type { DesktopBridge } from "./tauriBridge.ts";
import type {
  ClientUpdateArtifactInput,
  ClientUpdateDownloadResult,
  ClientUpdateLaunchResult,
  ClientUpdateVerificationResult
} from "./tauriBridge/clientUpdates.ts";

export interface ClientUpdateFlowInput {
  currentVersion: string;
  latestVersion: string;
  releaseID: string;
  deviceID: string;
  packageName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
}

export interface PreparedClientUpdateInstall {
  artifact: ClientUpdateArtifactInput;
  downloadTicket: ClientUpdateDownloadTicket;
  downloadResult: ClientUpdateDownloadResult;
  verificationResult: ClientUpdateVerificationResult;
}

function requireNonEmptyString(value: string | null | undefined, field: string): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  throw new Error(`客户端更新缺少 ${field}，请重新检查更新。`);
}

function requirePositiveNumber(value: number | null | undefined, field: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  throw new Error(`客户端更新缺少 ${field}，请重新检查更新。`);
}

async function reportClientUpdateEventSafe(
  p1Client: Pick<P1Client, "reportClientUpdateEvent">,
  input: {
    releaseID: string;
    eventType: string;
    deviceID: string;
    fromVersion: string;
    toVersion?: string | null;
    errorCode?: string | null;
  }
): Promise<void> {
  try {
    await p1Client.reportClientUpdateEvent(input);
  } catch {
    // Event reporting should not block the actual upgrade flow.
  }
}

function buildArtifactInput(
  input: ClientUpdateFlowInput,
  downloadTicket: ClientUpdateDownloadTicket
): ClientUpdateArtifactInput {
  return {
    releaseID: downloadTicket.releaseID || input.releaseID,
    version: downloadTicket.version || input.latestVersion,
    packageURL: requireNonEmptyString(downloadTicket.downloadURL, "下载地址"),
    packageHash: requireNonEmptyString(downloadTicket.sha256 ?? input.sha256, "SHA-256"),
    packageSize: requirePositiveNumber(downloadTicket.sizeBytes ?? input.sizeBytes, "包大小"),
    fileName: downloadTicket.packageName ?? input.packageName ?? undefined
  };
}

function verificationFailureMessage(result: ClientUpdateVerificationResult): string {
  if (!result.hashVerified) {
    return "客户端更新包哈希校验失败，请重新下载。";
  }
  return result.signatureDetails?.trim() || "客户端更新签名校验失败，请联系管理员重新发布安装包。";
}

export async function prepareClientUpdateInstall(
  input: ClientUpdateFlowInput,
  dependencies: Pick<P1Client, "requestClientUpdateDownloadTicket" | "reportClientUpdateEvent"> &
    Pick<DesktopBridge, "downloadClientUpdate" | "verifyClientUpdate">
): Promise<PreparedClientUpdateInstall> {
  const downloadTicket = await dependencies.requestClientUpdateDownloadTicket(input.releaseID);
  const artifact = buildArtifactInput(input, downloadTicket);

  await reportClientUpdateEventSafe(dependencies, {
    releaseID: input.releaseID,
    eventType: "download_started",
    deviceID: input.deviceID,
    fromVersion: input.currentVersion,
    toVersion: input.latestVersion
  });

  let downloadResult: ClientUpdateDownloadResult;
  try {
    downloadResult = await dependencies.downloadClientUpdate(artifact);
  } catch (error) {
    await reportClientUpdateEventSafe(dependencies, {
      releaseID: input.releaseID,
      eventType: "download_failed",
      deviceID: input.deviceID,
      fromVersion: input.currentVersion,
      toVersion: input.latestVersion,
      errorCode: error instanceof Error ? error.message : "download_failed"
    });
    throw error;
  }

  await reportClientUpdateEventSafe(dependencies, {
    releaseID: input.releaseID,
    eventType: "downloaded",
    deviceID: input.deviceID,
    fromVersion: input.currentVersion,
    toVersion: input.latestVersion
  });

  const verificationResult = await dependencies.verifyClientUpdate({ metadataPath: downloadResult.metadataPath });
  if (!verificationResult.hashVerified) {
    await reportClientUpdateEventSafe(dependencies, {
      releaseID: input.releaseID,
      eventType: "hash_failed",
      deviceID: input.deviceID,
      fromVersion: input.currentVersion,
      toVersion: input.latestVersion,
      errorCode: verificationResult.actualHash || "hash_failed"
    });
    throw new Error(verificationFailureMessage(verificationResult));
  }

  if (!verificationResult.readyToInstall) {
    await reportClientUpdateEventSafe(dependencies, {
      releaseID: input.releaseID,
      eventType: "signature_failed",
      deviceID: input.deviceID,
      fromVersion: input.currentVersion,
      toVersion: input.latestVersion,
      errorCode: verificationResult.signatureStatus
    });
    throw new Error(verificationFailureMessage(verificationResult));
  }

  return {
    artifact,
    downloadTicket,
    downloadResult,
    verificationResult
  };
}

export async function launchPreparedClientUpdateInstall(
  input: ClientUpdateFlowInput & Pick<PreparedClientUpdateInstall, "downloadResult">,
  dependencies: Pick<P1Client, "reportClientUpdateEvent"> & Pick<DesktopBridge, "launchClientInstaller">
): Promise<ClientUpdateLaunchResult> {
  const launchResult = await dependencies.launchClientInstaller({
    metadataPath: input.downloadResult.metadataPath,
    userConfirmed: true
  });

  await reportClientUpdateEventSafe(dependencies, {
    releaseID: input.releaseID,
    eventType: "installer_started",
    deviceID: input.deviceID,
    fromVersion: input.currentVersion,
    toVersion: input.latestVersion
  });

  return launchResult;
}
