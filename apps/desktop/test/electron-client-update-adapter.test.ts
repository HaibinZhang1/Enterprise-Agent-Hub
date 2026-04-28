import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createElectronClientUpdateAdapter, type ClientUpdateArtifactInput, type InstallerLaunchPlan } from "../src-electron/client-updates/adapter.ts";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "eah-electron-update-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function fetchBytes(bytes: Uint8Array) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  });
}

function artifact(bytes: Uint8Array, overrides: Partial<ClientUpdateArtifactInput> = {}): ClientUpdateArtifactInput {
  return {
    releaseID: "release-123",
    version: "1.2.3",
    packageURL: "https://updates.example.test/Enterprise Agent Hub Setup.exe?ticket=abc",
    packageHash: sha256(bytes),
    packageSize: bytes.byteLength,
    fileName: "Enterprise Agent Hub Setup.exe",
    ...overrides
  };
}

test("Electron client update adapter downloads, hashes, writes metadata, verifies, and launches after confirmation", async () => {
  await withTempDir(async (dir) => {
    const bytes = Buffer.from("MZ-electron-update-package");
    let launchPlan: InstallerLaunchPlan | null = null;
    const adapter = createElectronClientUpdateAdapter({
      updateRoot: dir,
      packageVersion: "0.1.0",
      platform: "win32",
      arch: "x64",
      fetchImpl: fetchBytes(bytes),
      inspectSignature: async () => ({ signatureStatus: "valid", signatureDetails: "Valid: CN=Enterprise Agent Hub" }),
      launchInstaller: async (plan) => {
        launchPlan = plan;
      },
      now: () => new Date("2026-04-28T00:00:00.000Z")
    });

    assert.deepEqual(adapter.getClientAppVersion(), {
      currentVersion: "0.1.0",
      platform: "win32",
      arch: "x64",
      windowsX64Supported: true
    });

    const download = await adapter.downloadClientUpdate(artifact(bytes));
    assert.equal(download.fileName, "Enterprise-Agent-Hub-Setup.exe");
    assert.equal(download.hashVerified, true);
    assert.equal(download.signatureStatus, "pending");
    assert.equal(download.readyToInstall, false);

    const metadata = JSON.parse(await readFile(download.metadataPath, "utf8"));
    assert.equal(metadata.packageHash, sha256(bytes));
    assert.equal(metadata.verificationState, "downloaded");

    const verification = await adapter.verifyClientUpdate({ metadataPath: download.metadataPath });
    assert.equal(verification.hashVerified, true);
    assert.equal(verification.signatureStatus, "valid");
    assert.equal(verification.readyToInstall, true);

    await assert.rejects(
      () => adapter.launchClientInstaller({ metadataPath: download.metadataPath, userConfirmed: false }),
      /explicit user confirmation/
    );
    const launch = await adapter.launchClientInstaller({ metadataPath: download.metadataPath, userConfirmed: true });
    assert.equal(launch.readyToInstall, true);
    assert.deepEqual(launchPlan, {
      program: "cmd",
      args: ["/C", "start", "", download.stagedFilePath]
    });
  });
});

test("Electron client update adapter rejects size and hash mismatches before installer launch", async () => {
  await withTempDir(async (dir) => {
    const bytes = Buffer.from("MZ-package");
    const adapter = createElectronClientUpdateAdapter({
      updateRoot: dir,
      packageVersion: "0.1.0",
      fetchImpl: fetchBytes(bytes),
      inspectSignature: async () => ({ signatureStatus: "skipped_non_windows", signatureDetails: "non-windows" })
    });

    await assert.rejects(
      () => adapter.downloadClientUpdate(artifact(bytes, { packageSize: bytes.byteLength + 1 })),
      /size mismatch/
    );
    await assert.rejects(
      () => adapter.downloadClientUpdate(artifact(bytes, { packageHash: "sha256:deadbeef" })),
      /hash mismatch/
    );
  });
});

test("Electron client update adapter persists failed verification and blocks unready installers", async () => {
  await withTempDir(async (dir) => {
    const bytes = Buffer.from("MZ-original");
    const adapter = createElectronClientUpdateAdapter({
      updateRoot: dir,
      packageVersion: "0.1.0",
      platform: "linux",
      arch: "x64",
      fetchImpl: fetchBytes(bytes),
      inspectSignature: async () => ({ signatureStatus: "skipped_non_windows", signatureDetails: "Authenticode verification requires Windows." })
    });

    const download = await adapter.downloadClientUpdate(artifact(bytes));
    await writeFile(download.stagedFilePath, "tampered");

    const verification = await adapter.verifyClientUpdate({ metadataPath: download.metadataPath });
    assert.equal(verification.hashVerified, false);
    assert.equal(verification.signatureStatus, "skipped_non_windows");
    assert.equal(verification.readyToInstall, false);

    const metadata = JSON.parse(await readFile(download.metadataPath, "utf8"));
    assert.equal(metadata.verificationState, "failed");
    assert.equal(metadata.hashVerified, false);

    await assert.rejects(
      () => adapter.launchClientInstaller({ metadataPath: download.metadataPath, userConfirmed: true }),
      /not verified and ready/
    );
  });
});
