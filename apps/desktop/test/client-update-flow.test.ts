import assert from "node:assert/strict";
import test from "node:test";
import { launchPreparedClientUpdateInstall, prepareClientUpdateInstall } from "../src/services/clientUpdateFlow.ts";
import type { ClientUpdateArtifactInput, ClientUpdateDownloadResult, ClientUpdateVerificationResult } from "../src/services/tauriBridge/clientUpdates.ts";

const updateInput = {
  currentVersion: "1.5.0",
  latestVersion: "1.6.0",
  releaseID: "rel_01",
  deviceID: "device-001",
  packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
  sizeBytes: 124000000,
  sha256: "sha256:deadbeef"
};

function downloadTicket() {
  return {
    releaseID: updateInput.releaseID,
    version: updateInput.latestVersion,
    downloadURL: "https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
    expiresAt: "2026-04-22T12:15:00.000Z",
    packageName: updateInput.packageName,
    sizeBytes: updateInput.sizeBytes,
    sha256: updateInput.sha256,
    signatureStatus: "signed"
  };
}

function downloadResult(artifact: ClientUpdateArtifactInput): ClientUpdateDownloadResult {
  return {
    releaseID: artifact.releaseID,
    version: artifact.version,
    fileName: artifact.fileName ?? updateInput.packageName,
    stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
    metadataPath: "/tmp/client-updates/metadata.json",
    packageHash: artifact.packageHash,
    packageSize: artifact.packageSize,
    downloadedAt: "2026-04-22T12:01:00.000Z",
    hashVerified: true,
    signatureStatus: "pending",
    readyToInstall: false
  };
}

function verificationResult(metadataPath: string, overrides: Partial<ClientUpdateVerificationResult> = {}): ClientUpdateVerificationResult {
  return {
    releaseID: updateInput.releaseID,
    version: updateInput.latestVersion,
    stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
    metadataPath,
    expectedHash: updateInput.sha256,
    actualHash: updateInput.sha256,
    verifiedAt: "2026-04-22T12:02:00.000Z",
    hashVerified: true,
    signatureStatus: "valid",
    signatureDetails: null,
    readyToInstall: true,
    ...overrides
  };
}

test("prepare client update install requests ticket, downloads, verifies, and reports events in order", async () => {
  const calls: string[] = [];
  const events: string[] = [];
  const prepared = await prepareClientUpdateInstall(updateInput, {
    async requestClientUpdateDownloadTicket(releaseID) {
      calls.push(`ticket:${releaseID}`);
      return downloadTicket();
    },
    async reportClientUpdateEvent(event) {
      events.push(event.eventType);
      return { ok: true };
    },
    async downloadClientUpdate(artifact) {
      calls.push(`download:${artifact.packageURL}`);
      return downloadResult(artifact);
    },
    async verifyClientUpdate({ metadataPath }) {
      calls.push(`verify:${metadataPath}`);
      return verificationResult(metadataPath);
    }
  });

  assert.deepEqual(calls, [
    "ticket:rel_01",
    "download:https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
    "verify:/tmp/client-updates/metadata.json"
  ]);
  assert.deepEqual(events, ["download_started", "downloaded"]);
  assert.equal(prepared.downloadResult.metadataPath, "/tmp/client-updates/metadata.json");
  assert.equal(prepared.verificationResult.readyToInstall, true);
});

test("prepare client update install rejects stale download metadata before verification", async () => {
  const calls: string[] = [];
  const events: Array<{ eventType: string; errorCode?: string | null }> = [];

  await assert.rejects(
    () =>
      prepareClientUpdateInstall(updateInput, {
        async requestClientUpdateDownloadTicket() {
          return downloadTicket();
        },
        async reportClientUpdateEvent(event) {
          events.push({ eventType: event.eventType, errorCode: event.errorCode });
          return { ok: true };
        },
        async downloadClientUpdate(artifact) {
          calls.push("download");
          return {
            ...downloadResult(artifact),
            packageSize: artifact.packageSize - 1
          };
        },
        async verifyClientUpdate() {
          calls.push("verify");
          return verificationResult("/tmp/client-updates/metadata.json");
        }
      }),
    /大小校验失败/
  );

  assert.deepEqual(calls, ["download"]);
  assert.deepEqual(events.map((event) => event.eventType), ["download_started", "download_failed"]);
  assert.equal(events[1]?.errorCode, "size_mismatch:123999999");
});

test("prepare client update install reports hash and signature verification failures", async () => {
  const hashEvents: string[] = [];
  await assert.rejects(
    () =>
      prepareClientUpdateInstall(updateInput, {
        async requestClientUpdateDownloadTicket() {
          return downloadTicket();
        },
        async reportClientUpdateEvent(event) {
          hashEvents.push(event.eventType);
          return { ok: true };
        },
        async downloadClientUpdate(artifact) {
          return downloadResult(artifact);
        },
        async verifyClientUpdate({ metadataPath }) {
          return verificationResult(metadataPath, {
            actualHash: "sha256:badc0ffee",
            hashVerified: false,
            readyToInstall: false
          });
        }
      }),
    /哈希校验失败/
  );
  assert.deepEqual(hashEvents, ["download_started", "downloaded", "hash_failed"]);

  const signatureEvents: string[] = [];
  await assert.rejects(
    () =>
      prepareClientUpdateInstall(updateInput, {
        async requestClientUpdateDownloadTicket() {
          return downloadTicket();
        },
        async reportClientUpdateEvent(event) {
          signatureEvents.push(event.eventType);
          return { ok: true };
        },
        async downloadClientUpdate(artifact) {
          return downloadResult(artifact);
        },
        async verifyClientUpdate({ metadataPath }) {
          return verificationResult(metadataPath, {
            signatureStatus: "invalid",
            signatureDetails: "Invalid signer",
            readyToInstall: false
          });
        }
      }),
    /Invalid signer/
  );
  assert.deepEqual(signatureEvents, ["download_started", "downloaded", "signature_failed"]);
});

test("launch prepared client update install starts installer only after explicit user confirmation", async () => {
  const events: string[] = [];
  const result = await launchPreparedClientUpdateInstall(
    {
      ...updateInput,
      downloadResult: downloadResult({
        releaseID: updateInput.releaseID,
        version: updateInput.latestVersion,
        packageURL: "https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
        packageHash: updateInput.sha256,
        packageSize: updateInput.sizeBytes,
        fileName: updateInput.packageName
      }),
      userConfirmed: true
    },
    {
      async reportClientUpdateEvent(event) {
        events.push(event.eventType);
        return { ok: true };
      },
      async launchClientInstaller({ metadataPath, userConfirmed }) {
        assert.equal(metadataPath, "/tmp/client-updates/metadata.json");
        assert.equal(userConfirmed, true);
        return {
          releaseID: updateInput.releaseID,
          version: updateInput.latestVersion,
          stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
          metadataPath,
          launchedAt: "2026-04-22T12:03:00.000Z",
          readyToInstall: true
        };
      }
    }
  );

  assert.deepEqual(events, ["installer_started"]);
  assert.equal(result.launchedAt, "2026-04-22T12:03:00.000Z");
});

test("launch prepared client update install reports cancellation and does not invoke installer without confirmation", async () => {
  const events: string[] = [];
  let launchCalled = false;
  await assert.rejects(
    () =>
      launchPreparedClientUpdateInstall(
        {
          ...updateInput,
          downloadResult: downloadResult({
            releaseID: updateInput.releaseID,
            version: updateInput.latestVersion,
            packageURL: "https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
            packageHash: updateInput.sha256,
            packageSize: updateInput.sizeBytes,
            fileName: updateInput.packageName
          }),
          userConfirmed: false
        },
        {
          async reportClientUpdateEvent(event) {
            events.push(event.eventType);
            return { ok: true };
          },
          async launchClientInstaller() {
            launchCalled = true;
            throw new Error("should not launch");
          }
        }
      ),
    /用户明确确认/
  );

  assert.equal(launchCalled, false);
  assert.deepEqual(events, ["install_cancelled"]);
});
