import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

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

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface InstallerLaunchPlan {
  program: string;
  args: string[];
}

export interface SignatureInspection {
  signatureStatus: ClientUpdateSignatureStatus;
  signatureDetails: string | null;
}

export interface ElectronClientUpdateAdapterOptions {
  updateRoot: string;
  packageVersion: string;
  platform?: NodeJS.Platform;
  arch?: string;
  fetchImpl?: FetchLike;
  inspectSignature?: (installerPath: string) => Promise<SignatureInspection>;
  launchInstaller?: (plan: InstallerLaunchPlan) => Promise<void>;
  now?: () => Date;
}

interface ClientUpdateMetadata {
  releaseID: string;
  version: string;
  fileName: string;
  stagedFilePath: string;
  packageURL: string;
  packageHash: string;
  packageSize: number;
  downloadedAt: string;
  actualHash: string;
  hashVerified: boolean;
  verificationState: "downloaded" | "verified" | "failed";
  lastVerifiedAt: string | null;
  signatureStatus: ClientUpdateSignatureStatus;
  signatureDetails: string | null;
}

const CLIENT_UPDATE_METADATA_FILE = "metadata.json";

export function createElectronClientUpdateAdapter(options: ElectronClientUpdateAdapterOptions) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const now = options.now ?? (() => new Date());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const inspectSignature = options.inspectSignature ?? ((installerPath: string) => inspectInstallerSignature(installerPath, platform));
  const launchInstaller = options.launchInstaller ?? launchInstallerDetached;

  if (!fetchImpl) {
    throw new Error("Electron client update adapter requires a fetch implementation.");
  }

  return {
    getClientAppVersion(): ClientAppVersionInfo {
      return {
        currentVersion: options.packageVersion,
        platform,
        arch,
        windowsX64Supported: platform === "win32" && arch === "x64"
      };
    },

    async downloadClientUpdate(input: ClientUpdateArtifactInput): Promise<ClientUpdateDownloadResult> {
      validateDownloadRequest(input);
      const releaseDir = stagingDir(options.updateRoot, input.releaseID, input.version);
      await mkdir(releaseDir, { recursive: true });

      const fileName = resolveFileName(input.fileName, input.packageURL, input.version);
      const stagedFilePath = join(releaseDir, fileName);
      const metadataPath = join(releaseDir, CLIENT_UPDATE_METADATA_FILE);
      const response = await fetchImpl(input.packageURL);
      if (!response.ok) {
        throw new Error(`download client update package: HTTP ${response.status} ${response.statusText}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());

      if (bytes.byteLength !== input.packageSize) {
        throw new Error(`downloaded installer size mismatch: expected ${input.packageSize}, actual ${bytes.byteLength}`);
      }

      const actualHash = `sha256:${sha256Hex(bytes)}`;
      if (!hashesMatch(input.packageHash, actualHash)) {
        throw new Error(`downloaded installer hash mismatch: expected ${input.packageHash}, actual ${actualHash}`);
      }

      await writeFile(stagedFilePath, bytes);
      const metadata: ClientUpdateMetadata = {
        releaseID: input.releaseID,
        version: input.version,
        fileName,
        stagedFilePath,
        packageURL: input.packageURL,
        packageHash: input.packageHash,
        packageSize: input.packageSize,
        downloadedAt: stamp(now()),
        actualHash,
        hashVerified: true,
        verificationState: "downloaded",
        lastVerifiedAt: null,
        signatureStatus: "pending",
        signatureDetails: null
      };
      await writeMetadata(metadataPath, metadata);
      return buildDownloadResult(metadata, metadataPath);
    },

    async verifyClientUpdate(input: ClientUpdateVerifyInput): Promise<ClientUpdateVerificationResult> {
      const metadata = await readMetadata(input.metadataPath);
      await assertFileExists(metadata.stagedFilePath, "staged installer");
      const actualHash = `sha256:${await sha256FileHex(metadata.stagedFilePath)}`;
      const hashVerified = hashesMatch(metadata.packageHash, actualHash);
      const signature = await inspectSignature(metadata.stagedFilePath);
      const verifiedAt = stamp(now());
      const nextMetadata: ClientUpdateMetadata = {
        ...metadata,
        actualHash,
        hashVerified,
        verificationState: hashVerified ? "verified" : "failed",
        lastVerifiedAt: verifiedAt,
        signatureStatus: signature.signatureStatus,
        signatureDetails: signature.signatureDetails
      };
      await writeMetadata(input.metadataPath, nextMetadata);
      return {
        releaseID: nextMetadata.releaseID,
        version: nextMetadata.version,
        stagedFilePath: nextMetadata.stagedFilePath,
        metadataPath: input.metadataPath,
        expectedHash: nextMetadata.packageHash,
        actualHash,
        verifiedAt,
        hashVerified,
        signatureStatus: nextMetadata.signatureStatus,
        signatureDetails: nextMetadata.signatureDetails,
        readyToInstall: isReadyToInstall(nextMetadata)
      };
    },

    async launchClientInstaller(input: ClientUpdateLaunchInput): Promise<ClientUpdateLaunchResult> {
      const metadata = await readMetadata(input.metadataPath);
      if (!input.userConfirmed) {
        throw new Error("installer launch requires explicit user confirmation");
      }
      if (!isReadyToInstall(metadata)) {
        throw new Error(`staged installer is not verified and ready to install: ${metadata.stagedFilePath}`);
      }
      const plan = await prepareInstallerLaunch(metadata.stagedFilePath, platform);
      await launchInstaller(plan);
      return {
        releaseID: metadata.releaseID,
        version: metadata.version,
        stagedFilePath: metadata.stagedFilePath,
        metadataPath: input.metadataPath,
        launchedAt: stamp(now()),
        readyToInstall: true
      };
    }
  };
}

export function clientUpdatesRoot(userDataPath: string): string {
  return join(userDataPath, "EnterpriseAgentHub", "client-updates");
}

export function isReadyToInstall(metadata: Pick<ClientUpdateMetadata, "hashVerified" | "verificationState" | "signatureStatus">): boolean {
  return metadata.hashVerified && metadata.verificationState === "verified" && (metadata.signatureStatus === "valid" || metadata.signatureStatus === "skipped_non_windows");
}

async function inspectInstallerSignature(installerPath: string, platform: NodeJS.Platform): Promise<SignatureInspection> {
  if (platform !== "win32") {
    return {
      signatureStatus: "skipped_non_windows",
      signatureDetails: `Authenticode verification requires Windows; staged installer retained at ${installerPath} for real-machine validation.`
    };
  }

  return new Promise((resolve) => {
    const child = spawn(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$sig = Get-AuthenticodeSignature -LiteralPath $args[0]; Write-Output ([string]$sig.Status); if ($sig.SignerCertificate) { Write-Output $sig.SignerCertificate.Subject }",
        installerPath
      ],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => {
      resolve({ signatureStatus: "check_failed", signatureDetails: `spawn signature verifier: ${error.message}` });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({ signatureStatus: "check_failed", signatureDetails: `Get-AuthenticodeSignature failed: ${stderr.trim()}` });
        return;
      }
      const lines = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
      const rawStatus = lines[0] ?? "Unknown";
      const signer = lines[1] ?? "";
      resolve({
        signatureStatus: rawStatus.toLowerCase() === "valid" ? "valid" : "invalid",
        signatureDetails: signer ? `${rawStatus}: ${signer}` : rawStatus
      });
    });
  });
}

async function prepareInstallerLaunch(installerPath: string, platform: NodeJS.Platform): Promise<InstallerLaunchPlan> {
  await assertFileExists(installerPath, "installer executable");
  if (platform === "win32") {
    if (!installerPath.toLowerCase().endsWith(".exe")) {
      throw new Error("client update installer must be a .exe file");
    }
    return { program: "cmd", args: ["/C", "start", "", installerPath] };
  }
  if (platform === "darwin") {
    return { program: "open", args: [installerPath] };
  }
  return { program: "xdg-open", args: [installerPath] };
}

async function launchInstallerDetached(plan: InstallerLaunchPlan): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.program, plan.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function validateDownloadRequest(input: ClientUpdateArtifactInput): void {
  if (!input.releaseID.trim()) throw new Error("releaseID cannot be empty");
  if (!input.version.trim()) throw new Error("version cannot be empty");
  if (!input.packageURL.trim()) throw new Error("packageURL cannot be empty");
  const url = new URL(input.packageURL);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("packageURL must use http or https");
  }
  if (!input.packageHash.trim()) throw new Error("packageHash cannot be empty");
  if (!Number.isFinite(input.packageSize) || input.packageSize <= 0) {
    throw new Error("packageSize must be greater than zero");
  }
}

function resolveFileName(fileName: string | null | undefined, packageURL: string, version: string): string {
  const fromURL = basename(new URL(packageURL).pathname);
  const candidate = (fileName?.trim() || fromURL || `EnterpriseAgentHubSetup-${version}.exe`);
  const sanitized = sanitizeSegment(candidate);
  return sanitized.toLowerCase().endsWith(".exe") ? sanitized : `${sanitized}.exe`;
}

function stagingDir(root: string, releaseID: string, version: string): string {
  return join(root, sanitizeSegment(releaseID), sanitizeSegment(version));
}

function sanitizeSegment(value: string): string {
  const sanitized = [...value].map((ch) => /[A-Za-z0-9._-]/u.test(ch) ? ch : "-").join("").replace(/^-+|-+$/gu, "");
  return sanitized || "client-update";
}

async function writeMetadata(path: string, metadata: ClientUpdateMetadata): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

async function readMetadata(path: string): Promise<ClientUpdateMetadata> {
  return JSON.parse(await readFile(path, "utf8")) as ClientUpdateMetadata;
}

async function assertFileExists(path: string, label: string): Promise<void> {
  const fileStat = await stat(path).catch(() => null);
  if (!fileStat?.isFile()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

function buildDownloadResult(metadata: ClientUpdateMetadata, metadataPath: string): ClientUpdateDownloadResult {
  return {
    releaseID: metadata.releaseID,
    version: metadata.version,
    fileName: metadata.fileName,
    stagedFilePath: metadata.stagedFilePath,
    metadataPath,
    packageHash: metadata.packageHash,
    packageSize: metadata.packageSize,
    downloadedAt: metadata.downloadedAt,
    hashVerified: metadata.hashVerified,
    signatureStatus: metadata.signatureStatus,
    readyToInstall: isReadyToInstall(metadata)
  };
}

function hashesMatch(expected: string, actual: string): boolean {
  return stripSha256Prefix(expected).toLowerCase() === stripSha256Prefix(actual).toLowerCase();
}

function stripSha256Prefix(value: string): string {
  return value.trim().replace(/^sha256:/iu, "");
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256FileHex(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function stamp(date: Date): string {
  return date.toISOString();
}
