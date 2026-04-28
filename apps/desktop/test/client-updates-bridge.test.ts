import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_UPDATE_LOCAL_COMMANDS,
  downloadClientUpdate,
  getClientAppVersion,
  launchClientInstaller,
  verifyClientUpdate,
  type ClientUpdateArtifactInput
} from "../src/services/electronBridge/clientUpdates.ts";

type InvokeCall = {
  command: string;
  args: Record<string, unknown> | undefined;
};

function installWindow(
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
) {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __TAURI__: {
        core: {
          invoke
        }
      },
      setTimeout,
      clearTimeout
    }
  });
  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow
    });
  };
}

test("client update bridge invokes native commands with the expected payloads", async () => {
  const calls: InvokeCall[] = [];
  const artifact: ClientUpdateArtifactInput = {
    releaseID: "release-123",
    version: "1.2.3",
    packageURL: "https://example.com/EnterpriseAgentHubSetup-1.2.3.exe",
    packageHash: "sha256:deadbeef",
    packageSize: 4_096,
    fileName: "EnterpriseAgentHubSetup-1.2.3.exe"
  };
  const restoreWindow = installWindow(async (command, args) => {
    calls.push({ command, args });
    switch (command) {
      case CLIENT_UPDATE_LOCAL_COMMANDS.getClientAppVersion:
        return {
          currentVersion: "0.1.0",
          platform: "windows",
          arch: "x86_64",
          windowsX64Supported: true
        };
      case CLIENT_UPDATE_LOCAL_COMMANDS.downloadClientUpdate:
        return {
          releaseID: artifact.releaseID,
          version: artifact.version,
          fileName: artifact.fileName,
          stagedFilePath: "C:\\updates\\EnterpriseAgentHubSetup-1.2.3.exe",
          metadataPath: "C:\\updates\\metadata.json",
          packageHash: artifact.packageHash,
          packageSize: artifact.packageSize,
          downloadedAt: "2026-04-22T15:00:00.000Z",
          hashVerified: true,
          signatureStatus: "pending",
          readyToInstall: false
        };
      case CLIENT_UPDATE_LOCAL_COMMANDS.verifyClientUpdate:
        return {
          releaseID: artifact.releaseID,
          version: artifact.version,
          stagedFilePath: "C:\\updates\\EnterpriseAgentHubSetup-1.2.3.exe",
          metadataPath: "C:\\updates\\metadata.json",
          expectedHash: artifact.packageHash,
          actualHash: artifact.packageHash,
          verifiedAt: "2026-04-22T15:01:00.000Z",
          hashVerified: true,
          signatureStatus: "skipped_non_windows",
          signatureDetails: "Authenticode verification requires Windows.",
          readyToInstall: true
        };
      case CLIENT_UPDATE_LOCAL_COMMANDS.launchClientInstaller:
        return {
          releaseID: artifact.releaseID,
          version: artifact.version,
          stagedFilePath: "C:\\updates\\EnterpriseAgentHubSetup-1.2.3.exe",
          metadataPath: "C:\\updates\\metadata.json",
          launchedAt: "2026-04-22T15:02:00.000Z",
          readyToInstall: true
        };
      default:
        throw new Error(`unexpected command: ${command}`);
    }
  });

  try {
    const versionInfo = await getClientAppVersion();
    const download = await downloadClientUpdate(artifact);
    const verification = await verifyClientUpdate({ metadataPath: download.metadataPath });
    const launch = await launchClientInstaller({ metadataPath: download.metadataPath, userConfirmed: true });

    assert.deepEqual(versionInfo, {
      currentVersion: "0.1.0",
      platform: "windows",
      arch: "x86_64",
      windowsX64Supported: true
    });
    assert.equal(download.releaseID, artifact.releaseID);
    assert.equal(verification.readyToInstall, true);
    assert.equal(launch.readyToInstall, true);

    assert.deepEqual(calls, [
      {
        command: CLIENT_UPDATE_LOCAL_COMMANDS.getClientAppVersion,
        args: undefined
      },
      {
        command: CLIENT_UPDATE_LOCAL_COMMANDS.downloadClientUpdate,
        args: { input: artifact }
      },
      {
        command: CLIENT_UPDATE_LOCAL_COMMANDS.verifyClientUpdate,
        args: { input: { metadataPath: "C:\\updates\\metadata.json" } }
      },
      {
        command: CLIENT_UPDATE_LOCAL_COMMANDS.launchClientInstaller,
        args: { input: { metadataPath: "C:\\updates\\metadata.json", userConfirmed: true } }
      }
    ]);
  } finally {
    restoreWindow();
  }
});

test("client update bridge normalizes native command failures into user-facing errors", async () => {
  const restoreWindow = installWindow(async () => {
    throw new Error("signature verification failed");
  });

  try {
    await assert.rejects(
      () => verifyClientUpdate({ metadataPath: "/tmp/client-update/metadata.json" }),
      /signature verification failed/
    );
  } finally {
    restoreWindow();
  }
});
