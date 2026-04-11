import { access, copyFile, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const desktopTargetRoot = resolve(
  repoRoot,
  process.env.VERIFY_PROD_DESKTOP_TARGET_ROOT ?? 'apps/desktop/src-tauri/target',
);
const desktopAppPath = resolve(
  repoRoot,
  process.env.VERIFY_PROD_DESKTOP_APP_PATH ?? 'apps/desktop/src-tauri/target/release/bundle/macos/Enterprise Agent Hub Desktop.app',
);
const desktopBinaryPath = resolve(
  repoRoot,
  process.env.VERIFY_PROD_DESKTOP_BINARY_PATH ?? 'apps/desktop/src-tauri/target/release/enterprise-agent-hub-desktop',
);
const composePath = resolve(repoRoot, 'infra/docker-compose.production.yml');
const envExamplePath = resolve(repoRoot, 'infra/.env.production.example');
const envExample = await readFile(envExamplePath, 'utf8');

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * @param {string | Buffer | null | undefined} value
 */
function text(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (!value) {
    return '';
  }
  return value.toString('utf8');
}

/**
 * @param {string} path
 */
async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} path
 */
function detectWindowsArtifactType(path) {
  const normalized = path.replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('.msi')) {
    return 'msi';
  }
  if (normalized.endsWith('.exe') || normalized.includes('/bundle/nsis/')) {
    return 'nsis-exe';
  }
  return extname(path).replace(/^\./, '') || 'unknown';
}

/**
 * @param {string} root
 * @param {string[]} extensions
 */
async function findArtifacts(root, extensions) {
  if (!(await pathExists(root))) {
    return [];
  }
  /** @type {string[]} */
  const matches = [];
  /**
   * @param {string} current
   */
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const next = resolve(current, entry.name);
      if (entry.isDirectory()) {
        await walk(next);
      } else if (extensions.includes(extname(entry.name).toLowerCase())) {
        matches.push(next);
      }
    }
  }
  await walk(root);
  return matches.sort();
}

function configuredWindowsArtifactPaths() {
  const raw = [process.env.WINDOWS_ARTIFACT_PATH, process.env.WINDOWS_ARTIFACT_PATHS]
    .filter(Boolean)
    .join(',');
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolve(repoRoot, entry));
}

/**
 * @param {string[]} paths
 */
async function buildWindowsArtifactMetadata(paths) {
  /** @type {Array<{ path: string, exists: true, type: string, sizeBytes: number, modifiedAt: string }>} */
  const artifacts = [];
  for (const path of paths) {
    if (!(await pathExists(path))) {
      continue;
    }
    const artifactStat = await stat(path);
    artifacts.push({
      path,
      exists: true,
      type: detectWindowsArtifactType(path),
      sizeBytes: artifactStat.size,
      modifiedAt: artifactStat.mtime.toISOString(),
    });
  }
  return artifacts;
}

const warnings = [];

const cargo = run('cargo', ['--version']);
const rustc = run('rustc', ['--version']);
const docker = run('docker', ['--version']);
const compose = run('docker', ['compose', 'version']);
const dockerInfo = run('docker', ['info']);

const tempDir = await mkdtemp(resolve(tmpdir(), 'enterprise-agent-hub-prod-verify-'));
const envPath = resolve(tempDir, '.env.production.test');
await copyFile(envExamplePath, envPath);
const composeConfig = run('docker', ['compose', '--env-file', envPath, '-f', composePath, 'config']);
await rm(tempDir, { recursive: true, force: true });

const appExists = await pathExists(desktopAppPath);
const binaryExists = await pathExists(desktopBinaryPath);
const appStat = appExists ? await stat(desktopAppPath) : null;
const binaryStat = binaryExists ? await stat(desktopBinaryPath) : null;
const discoveredWindowsArtifactPaths = await findArtifacts(desktopTargetRoot, ['.exe', '.msi']);
const windowsArtifactCandidates = await buildWindowsArtifactMetadata([
  ...new Set([...configuredWindowsArtifactPaths(), ...discoveredWindowsArtifactPaths]),
]);
const primaryWindowsArtifact = windowsArtifactCandidates[0] ?? null;
const windowsRuntimeValidated = process.env.WINDOWS_RUNTIME_VALIDATED === '1';
const windowsRuntimeValidationMode = windowsRuntimeValidated
  ? (process.env.WINDOWS_RUNTIME_VALIDATION_MODE || 'manual-smoke')
  : 'not-run';
const windowsRuntimeResidualRiskReason = windowsRuntimeValidated
  ? null
  : (process.env.WINDOWS_RUNTIME_RESIDUAL_RISK ||
      'Artifact-only residual risk: real Windows install/start runtime smoke was not performed in this environment, so Windows runtime readiness is not fully proven.');

const baseImageInspect = run('docker', ['image', 'inspect', 'node:24-alpine']);
if (baseImageInspect.status !== 0) {
  warnings.push('Base image node:24-alpine is not cached locally; docker build still depends on registry reachability.');
}

if (!appExists) {
  warnings.push('Desktop .app artifact is missing; run `pnpm --filter @enterprise-agent-hub/desktop tauri:build` first.');
}

if (!primaryWindowsArtifact) {
  warnings.push('Windows Desktop installer artifact is missing; expected NSIS .exe or MSI .msi evidence from a Windows runner/VM.');
}

if (windowsRuntimeResidualRiskReason) {
  warnings.push(windowsRuntimeResidualRiskReason);
}

const summary = {
  ok:
    cargo.status === 0 &&
    rustc.status === 0 &&
    docker.status === 0 &&
    compose.status === 0 &&
    dockerInfo.status === 0 &&
    composeConfig.status === 0 &&
    appExists &&
    binaryExists,
  desktopArtifact: {
    appPath: desktopAppPath,
    appExists,
    binaryPath: desktopBinaryPath,
    binaryExists,
    binarySizeBytes: binaryStat?.size ?? null,
    appModifiedAt: appStat?.mtime?.toISOString?.() ?? null,
    role: 'macOS supporting artifact only; not Windows release proof',
  },
  windowsArtifact: {
    exists: Boolean(primaryWindowsArtifact),
    path: primaryWindowsArtifact?.path ?? null,
    type: primaryWindowsArtifact?.type ?? null,
    sizeBytes: primaryWindowsArtifact?.sizeBytes ?? null,
    modifiedAt: primaryWindowsArtifact?.modifiedAt ?? null,
    buildCommand:
      process.env.WINDOWS_BUILD_COMMAND ??
      'pnpm --filter @enterprise-agent-hub/desktop tauri:build:windows',
    buildRunner: process.env.WINDOWS_BUILD_RUNNER ?? 'windows-runner-or-vm',
    artifacts: windowsArtifactCandidates,
  },
  releaseGate: {
    ok: Boolean(primaryWindowsArtifact),
    windowsArtifactRequired: true,
    windowsRuntimePreferred: true,
  },
  windowsRuntimeValidated,
  windowsRuntimeValidationMode,
  windowsRuntimeResidualRiskReason,
  toolchain: {
    cargo: text(cargo.stdout).trim() || text(cargo.stderr).trim(),
    rustc: text(rustc.stdout).trim() || text(rustc.stderr).trim(),
    docker: text(docker.stdout).trim() || text(docker.stderr).trim(),
    compose: text(compose.stdout).trim() || text(compose.stderr).trim(),
  },
  deployReadiness: {
    dockerInfoOk: dockerInfo.status === 0,
    composeConfigOk: composeConfig.status === 0,
    composeServiceCount:
      composeConfig.status === 0
        ? (text(composeConfig.stdout).match(/^[ ]{2}[a-z0-9_-]+:\n/gim) ?? []).length
        : 0,
    baseImageCached: baseImageInspect.status === 0,
    defaultBaseImage: (envExample.match(/^API_BASE_IMAGE=(.+)$/m)?.[1] ?? 'node:24-alpine'),
    defaultNginxImage: (envExample.match(/^NGINX_IMAGE=(.+)$/m)?.[1] ?? 'nginx:1.29-alpine'),
    defaultPostgresImage: (envExample.match(/^POSTGRES_IMAGE=(.+)$/m)?.[1] ?? 'postgres:17-alpine'),
    defaultNodeRuntimeImage: (envExample.match(/^NODE_RUNTIME_IMAGE=(.+)$/m)?.[1] ?? 'node:24-alpine'),
    defaultApiHasPostgresClient: (envExample.match(/^API_HAS_POSTGRES_CLIENT=(.+)$/m)?.[1] ?? '0'),
    defaultApiOfflineWorkspace: (envExample.match(/^API_OFFLINE_WORKSPACE=(.+)$/m)?.[1] ?? '0'),
    defaultSkipMigrations: (envExample.match(/^SKIP_MIGRATIONS=(.+)$/m)?.[1] ?? '0'),
    defaultPnpmRegistryUrl: (envExample.match(/^PNPM_REGISTRY_URL=(.+)$/m)?.[1] ?? 'https://registry.npmjs.org'),
  },
  warnings,
};

console.log(JSON.stringify(summary, null, 2));
