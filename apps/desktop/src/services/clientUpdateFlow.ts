import type { P1Client, ClientUpdateDownloadTicket } from "./p1Client.ts";
import type { DesktopBridge } from "./desktopBridge.ts";
import type {
  ClientUpdateArtifactInput,
  ClientUpdateDownloadResult,
  ClientUpdateLaunchResult,
  ClientUpdateVerificationResult
} from "./desktopBridge/clientUpdates.ts";

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

export interface LaunchPreparedClientUpdateInstallInput extends ClientUpdateFlowInput {
  downloadResult: ClientUpdateDownloadResult;
  userConfirmed: boolean;
}

type ClientUpdateEventInput = Parameters<P1Client["reportClientUpdateEvent"]>[0];

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
  input: ClientUpdateEventInput
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

function clientUpdateEvent(
  input: ClientUpdateFlowInput,
  eventType: ClientUpdateEventInput["eventType"],
  errorCode?: string | null
): ClientUpdateEventInput {
  return {
    releaseID: input.releaseID,
    eventType,
    deviceID: input.deviceID,
    fromVersion: input.currentVersion,
    toVersion: input.latestVersion,
    errorCode
  };
}

function hashesMatch(expected: string, actual: string): boolean {
  return expected.trim().trimStart().replace(/^sha256:/i, "").toLowerCase() ===
    actual.trim().trimStart().replace(/^sha256:/i, "").toLowerCase();
}

function validateDownloadResult(
  artifact: ClientUpdateArtifactInput,
  result: ClientUpdateDownloadResult
): { eventType: ClientUpdateEventInput["eventType"]; errorCode: string; message: string } | null {
  if (!result.metadataPath.trim()) {
    return {
      eventType: "download_failed",
      errorCode: "metadata_path_missing",
      message: "客户端更新元数据路径缺失，请重新下载。"
    };
  }
  if (result.packageSize !== artifact.packageSize) {
    return {
      eventType: "download_failed",
      errorCode: `size_mismatch:${result.packageSize}`,
      message: "客户端更新包大小校验失败，请重新下载。"
    };
  }
  if (!result.hashVerified || !hashesMatch(artifact.packageHash, result.packageHash)) {
    return {
      eventType: "hash_failed",
      errorCode: result.packageHash || "hash_failed",
      message: "客户端更新包哈希校验失败，请重新下载。"
    };
  }
  return null;
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

  await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "download_started"));

  let downloadResult: ClientUpdateDownloadResult;
  try {
    downloadResult = await dependencies.downloadClientUpdate(artifact);
  } catch (error) {
    await reportClientUpdateEventSafe(
      dependencies,
      clientUpdateEvent(input, "download_failed", error instanceof Error ? error.message : "download_failed")
    );
    throw error;
  }

  const downloadFailure = validateDownloadResult(artifact, downloadResult);
  if (downloadFailure) {
    await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, downloadFailure.eventType, downloadFailure.errorCode));
    throw new Error(downloadFailure.message);
  }

  await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "downloaded"));

  let verificationResult: ClientUpdateVerificationResult;
  try {
    verificationResult = await dependencies.verifyClientUpdate({ metadataPath: downloadResult.metadataPath });
  } catch (error) {
    await reportClientUpdateEventSafe(
      dependencies,
      clientUpdateEvent(input, "signature_failed", error instanceof Error ? error.message : "verification_failed")
    );
    throw error;
  }
  if (!verificationResult.hashVerified) {
    await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "hash_failed", verificationResult.actualHash || "hash_failed"));
    throw new Error(verificationFailureMessage(verificationResult));
  }

  if (!verificationResult.readyToInstall) {
    await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "signature_failed", verificationResult.signatureStatus));
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
  input: LaunchPreparedClientUpdateInstallInput,
  dependencies: Pick<P1Client, "reportClientUpdateEvent"> & Pick<DesktopBridge, "launchClientInstaller">
): Promise<ClientUpdateLaunchResult> {
  if (!input.userConfirmed) {
    await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "install_cancelled", "user_not_confirmed"));
    throw new Error("启动安装程序需要用户明确确认。");
  }

  const launchResult = await dependencies.launchClientInstaller({
    metadataPath: input.downloadResult.metadataPath,
    userConfirmed: true
  });

  await reportClientUpdateEventSafe(dependencies, clientUpdateEvent(input, "installer_started"));

  return launchResult;
}
