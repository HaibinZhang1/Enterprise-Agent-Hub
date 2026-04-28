import assert from "node:assert/strict";
import test from "node:test";
import { launchPreparedClientUpdateInstall, prepareClientUpdateInstall } from "../src/services/clientUpdateFlow.ts";

test("prepare client update install requests ticket, downloads, verifies, and reports events", async () => {
  const calls: string[] = [];
  const events: string[] = [];
  const prepared = await prepareClientUpdateInstall(
    {
      currentVersion: "1.5.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      deviceID: "device-001",
      packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
      sizeBytes: 124000000,
      sha256: "sha256:deadbeef"
    },
    {
      async requestClientUpdateDownloadTicket(releaseID) {
        calls.push(`ticket:${releaseID}`);
        return {
          releaseID,
          version: "1.6.0",
          downloadURL: "https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
          expiresAt: "2026-04-22T12:15:00.000Z",
          packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
          sizeBytes: 124000000,
          sha256: "sha256:deadbeef",
          signatureStatus: "signed"
        };
      },
      async reportClientUpdateEvent(event) {
        events.push(event.eventType);
        return { ok: true };
      },
      async downloadClientUpdate(artifact) {
        calls.push(`download:${artifact.packageURL}`);
        return {
          releaseID: artifact.releaseID,
          version: artifact.version,
          fileName: artifact.fileName ?? "EnterpriseAgentHub_1.6.0_x64-setup.exe",
          stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
          metadataPath: "/tmp/client-updates/metadata.json",
          packageHash: artifact.packageHash,
          packageSize: artifact.packageSize,
          downloadedAt: "2026-04-22T12:01:00.000Z",
          hashVerified: true,
          signatureStatus: "pending",
          readyToInstall: false
        };
      },
      async verifyClientUpdate({ metadataPath }) {
        calls.push(`verify:${metadataPath}`);
        return {
          releaseID: "rel_01",
          version: "1.6.0",
          stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
          metadataPath,
          expectedHash: "sha256:deadbeef",
          actualHash: "sha256:deadbeef",
          verifiedAt: "2026-04-22T12:02:00.000Z",
          hashVerified: true,
          signatureStatus: "valid",
          signatureDetails: null,
          readyToInstall: true
        };
      }
    }
  );

  assert.deepEqual(calls, [
    "ticket:rel_01",
    "download:https://updates.example.com/client-updates/releases/rel_01/download?ticket=ticket-123",
    "verify:/tmp/client-updates/metadata.json"
  ]);
  assert.deepEqual(events, ["download_started", "downloaded"]);
  assert.equal(prepared.downloadResult.metadataPath, "/tmp/client-updates/metadata.json");
});

test("launch prepared client update install starts installer and reports installer_started", async () => {
  const events: string[] = [];
  const result = await launchPreparedClientUpdateInstall(
    {
      currentVersion: "1.5.0",
      latestVersion: "1.6.0",
      releaseID: "rel_01",
      deviceID: "device-001",
      packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
      sizeBytes: 124000000,
      sha256: "sha256:deadbeef",
      downloadResult: {
        releaseID: "rel_01",
        version: "1.6.0",
        fileName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
        stagedFilePath: "/tmp/client-updates/EnterpriseAgentHub_1.6.0_x64-setup.exe",
        metadataPath: "/tmp/client-updates/metadata.json",
        packageHash: "sha256:deadbeef",
        packageSize: 124000000,
        downloadedAt: "2026-04-22T12:01:00.000Z",
        hashVerified: true,
        signatureStatus: "valid",
        readyToInstall: true
      }
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
          releaseID: "rel_01",
          version: "1.6.0",
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
