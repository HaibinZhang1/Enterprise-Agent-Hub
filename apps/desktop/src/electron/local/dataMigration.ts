import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PRODUCT_DATA_DIR = "EnterpriseAgentHub";
const LEGACY_PRODUCT_DIR_CANDIDATES = [
  DEFAULT_PRODUCT_DATA_DIR,
  "com.enterpriseagenthub.desktop",
  "enterprise-agent-hub",
  "Enterprise Agent Hub"
] as const;

export type MigrationStatus =
  | "source_missing"
  | "copied"
  | "idempotent"
  | "conflict"
  | "failed";

export interface LegacyDataCandidate {
  readonly sourceRoot: string;
  readonly reason: string;
}

export interface UserDataMigrationManifest {
  readonly schemaVersion: 1;
  readonly status: MigrationStatus;
  readonly sourceRoot: string | null;
  readonly targetRoot: string;
  readonly copiedItems: readonly string[];
  readonly skippedItems: readonly string[];
  readonly conflictItems: readonly string[];
  readonly errors: readonly string[];
  readonly appVersion: string;
  readonly migratedAt: string;
}

export interface UserDataMigrationOptions {
  readonly electronUserDataDir: string;
  readonly legacyRoots: readonly string[];
  readonly appVersion: string;
  readonly productDataDirName?: string;
  readonly now?: () => Date;
  /** Test seam used to prove recoverable partial-copy failure handling. */
  readonly copyItem?: (source: string, target: string) => Promise<void>;
}

export interface UserDataMigrationResult {
  readonly manifest: UserDataMigrationManifest;
  readonly manifestPath: string;
  readonly dataRoot: string;
  readonly centralStorePath: string;
  readonly skillsDbPath: string;
}

export function getElectronProductDataRoot(
  electronUserDataDir: string,
  productDataDirName = DEFAULT_PRODUCT_DATA_DIR
): string {
  return path.join(electronUserDataDir, productDataDirName);
}

export function getElectronLocalStatePaths(electronUserDataDir: string, productDataDirName = DEFAULT_PRODUCT_DATA_DIR) {
  const dataRoot = getElectronProductDataRoot(electronUserDataDir, productDataDirName);
  return {
    dataRoot,
    centralStorePath: path.join(dataRoot, "central-store"),
    skillsDbPath: path.join(dataRoot, "skills.db"),
    manifestPath: path.join(dataRoot, "electron-migration-manifest.json")
  } as const;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasLegacyPayload(candidateRoot: string): Promise<boolean> {
  return (await exists(path.join(candidateRoot, "skills.db"))) || (await exists(path.join(candidateRoot, "central-store")));
}

export async function findLegacyDataCandidate(legacyRoots: readonly string[]): Promise<LegacyDataCandidate | null> {
  const seen = new Set<string>();
  for (const root of legacyRoots) {
    const normalizedRoot = path.resolve(root);
    const candidates = [
      normalizedRoot,
      ...LEGACY_PRODUCT_DIR_CANDIDATES.map((dirName) => path.join(normalizedRoot, dirName))
    ];
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (await hasLegacyPayload(candidate)) {
        return {
          sourceRoot: candidate,
          reason: candidate === normalizedRoot ? "direct_legacy_root" : "product_child_candidate"
        };
      }
    }
  }
  return null;
}

async function hashPath(targetPath: string): Promise<string> {
  const targetStat = await stat(targetPath);
  const hash = createHash("sha256");
  hash.update(targetStat.isDirectory() ? "dir" : "file");
  hash.update(path.basename(targetPath));

  if (targetStat.isDirectory()) {
    const entries = await readdir(targetPath);
    for (const entry of entries.sort()) {
      hash.update(entry);
      hash.update(await hashPath(path.join(targetPath, entry)));
    }
  } else {
    hash.update(await readFile(targetPath));
  }

  return hash.digest("hex");
}

async function isEmptyDirectory(targetPath: string): Promise<boolean> {
  if (!(await exists(targetPath))) return true;
  const entries = await readdir(targetPath);
  return entries.length === 0;
}

async function defaultCopyItem(source: string, target: string): Promise<void> {
  await cp(source, target, { recursive: true, errorOnExist: false, force: true, preserveTimestamps: true });
}

async function buildManifest(
  options: UserDataMigrationOptions,
  status: MigrationStatus,
  sourceRoot: string | null,
  copiedItems: readonly string[],
  skippedItems: readonly string[],
  conflictItems: readonly string[],
  errors: readonly string[]
): Promise<UserDataMigrationManifest> {
  const paths = getElectronLocalStatePaths(options.electronUserDataDir, options.productDataDirName);
  return {
    schemaVersion: 1,
    status,
    sourceRoot,
    targetRoot: paths.dataRoot,
    copiedItems,
    skippedItems,
    conflictItems,
    errors,
    appVersion: options.appVersion,
    migratedAt: (options.now?.() ?? new Date()).toISOString()
  };
}

async function writeManifest(manifestPath: string, manifest: UserDataMigrationManifest): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function migrateLegacyUserData(options: UserDataMigrationOptions): Promise<UserDataMigrationResult> {
  const paths = getElectronLocalStatePaths(options.electronUserDataDir, options.productDataDirName);
  await mkdir(paths.dataRoot, { recursive: true });

  const source = await findLegacyDataCandidate(options.legacyRoots);
  if (!source) {
    const manifest = await buildManifest(options, "source_missing", null, [], [], [], []);
    await writeManifest(paths.manifestPath, manifest);
    await mkdir(paths.centralStorePath, { recursive: true });
    return { ...paths, manifest };
  }

  const items = ["skills.db", "central-store"] as const;
  const availableItems: string[] = [];
  const skippedItems: string[] = [];
  const conflictItems: string[] = [];
  const copiedItems: string[] = [];
  const errors: string[] = [];

  for (const item of items) {
    if (await exists(path.join(source.sourceRoot, item))) {
      availableItems.push(item);
    } else {
      skippedItems.push(item);
    }
  }

  if (!(await isEmptyDirectory(paths.dataRoot))) {
    for (const item of availableItems) {
      const sourceItem = path.join(source.sourceRoot, item);
      const targetItem = path.join(paths.dataRoot, item);
      if (!(await exists(targetItem))) {
        conflictItems.push(item);
        continue;
      }
      if ((await hashPath(sourceItem)) === (await hashPath(targetItem))) {
        skippedItems.push(item);
      } else {
        conflictItems.push(item);
      }
    }

    const manifest = await buildManifest(
      options,
      conflictItems.length > 0 ? "conflict" : "idempotent",
      source.sourceRoot,
      [],
      skippedItems,
      conflictItems,
      []
    );
    await writeManifest(paths.manifestPath, manifest);
    await mkdir(paths.centralStorePath, { recursive: true });
    return { ...paths, manifest };
  }

  const copyItem = options.copyItem ?? defaultCopyItem;
  for (const item of availableItems) {
    const sourceItem = path.join(source.sourceRoot, item);
    const targetItem = path.join(paths.dataRoot, item);
    try {
      await copyItem(sourceItem, targetItem);
      copiedItems.push(item);
    } catch (error) {
      errors.push(`${item}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const manifest = await buildManifest(
    options,
    errors.length > 0 ? "failed" : "copied",
    source.sourceRoot,
    copiedItems,
    skippedItems,
    conflictItems,
    errors
  );
  await writeManifest(paths.manifestPath, manifest);
  await mkdir(paths.centralStorePath, { recursive: true });
  return { ...paths, manifest };
}
