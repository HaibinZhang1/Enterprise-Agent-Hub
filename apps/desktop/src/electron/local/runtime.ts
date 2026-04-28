import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AdapterStatus,
  P1_LOCAL_COMMANDS,
  type DownloadTicketResponse,
  type EnabledTarget,
  type ExtensionInstall,
  type ExtensionKind,
  type ExtensionType,
  type LocalBootstrapResponse,
  type LocalCommandName,
  type LocalCommandRequestMap,
  type LocalCommandResponseMap,
  type LocalEvent,
  type LocalNotification,
  type LocalSkillInstall,
  type PluginTarget,
  type ProjectConfig,
  type RequestedMode,
  type ScanTargetSummary,
  type TargetType,
  type ToolConfig
} from "@enterprise-agent-hub/shared-contracts";
import { getElectronLocalStatePaths, migrateLegacyUserData, type UserDataMigrationOptions } from "./dataMigration.ts";

type MutableDeep<T> = T extends readonly (infer Item)[]
  ? MutableDeep<Item>[]
  : T extends object
    ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
    : T;

interface PersistedLocalState {
  schemaVersion: 1;
  installs: MutableDeep<LocalSkillInstall>[];
  extensions: MutableDeep<ExtensionInstall>[];
  tools: MutableDeep<ToolConfig>[];
  projects: MutableDeep<ProjectConfig>[];
  notifications: MutableDeep<LocalNotification>[];
  offlineEvents: MutableDeep<LocalEvent>[];
}

export interface ElectronLocalRuntimeOptions {
  readonly electronUserDataDir: string;
  readonly legacyRoots?: readonly string[];
  readonly appVersion: string;
  readonly selectedProjectDirectory?: () => Promise<string | null>;
  readonly now?: () => Date;
  readonly productDataDirName?: string;
}

type LocalCommandHandlerMap = {
  readonly [K in LocalCommandName]: (args: LocalCommandRequestMap[K]) => Promise<LocalCommandResponseMap[K]>;
};

type SaveToolInput = { readonly tool?: LocalCommandRequestMap["save_tool_config"] } & LocalCommandRequestMap["save_tool_config"];
type SaveProjectInput = { readonly project?: LocalCommandRequestMap["save_project_config"] } & LocalCommandRequestMap["save_project_config"];

type ImportLocalSkillInput = LocalCommandRequestMap["import_local_skill"] | LocalCommandRequestMap["import_local_skill"]["input"];
type ImportLocalExtensionInput = LocalCommandRequestMap["import_local_extension"] | LocalCommandRequestMap["import_local_extension"]["input"];

const DEFAULT_TOOL_IDS = ["codex", "claude", "cursor", "windsurf", "opencode"] as const;
const DEFAULT_TRANSFORMS: Record<string, string> = {
  codex: "codex_skill",
  claude: "claude_skill",
  cursor: "cursor_rule",
  windsurf: "windsurf_rule",
  opencode: "opencode_skill"
};
const SAFE_LOCAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isoNow(now?: () => Date): string {
  return (now?.() ?? new Date()).toISOString();
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "local-project";
}

function hashString(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function hasPathTraversalSegment(value: string): boolean {
  return value.split(/[\\/]+/).some((segment) => segment === "..");
}

function validateLocalID(value: string, label: string): string {
  const trimmed = value.trim();
  if (!SAFE_LOCAL_ID_PATTERN.test(trimmed)) {
    throw new Error(`${label} must be a stable local identifier and cannot contain path separators or traversal segments.`);
  }
  return trimmed;
}

function validateRelativeInputPath(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) {
    throw new Error(`${label} must be a non-empty relative path.`);
  }
  if (path.isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
    throw new Error(`${label} must be relative to the selected local target.`);
  }
  if (hasPathTraversalSegment(trimmed)) {
    throw new Error(`${label} cannot contain traversal segments.`);
  }
  return trimmed;
}

function assertContainedPath(root: string, candidate: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the Electron Central Store root.`);
  }
  return resolvedCandidate;
}

function centralStoreItemPath(root: string, id: string, label: string): string {
  const safeID = validateLocalID(id, label);
  return assertContainedPath(root, path.join(root, safeID), label);
}

function isAbsolutePathLike(value: string): boolean {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}

function targetName(targetType: TargetType, targetID: string, state: PersistedLocalState): string {
  if (targetType === "tool") {
    return state.tools.find((tool) => tool.toolID === targetID)?.displayName ?? targetID;
  }
  return state.projects.find((project) => project.projectID === targetID)?.displayName ?? targetID;
}

function targetPath(targetType: TargetType, targetID: string, state: PersistedLocalState): string {
  if (targetType === "tool") {
    return state.tools.find((tool) => tool.toolID === targetID)?.skillsPath ?? "";
  }
  return state.projects.find((project) => project.projectID === targetID)?.skillsPath ?? "";
}

function makeEnabledTarget(input: {
  readonly skillID: string;
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly requestedMode: RequestedMode;
  readonly state: PersistedLocalState;
  readonly now: string;
}): EnabledTarget {
  const basePath = targetPath(input.targetType, input.targetID, input.state);
  return {
    targetType: input.targetType,
    targetID: input.targetID,
    targetName: targetName(input.targetType, input.targetID, input.state),
    targetPath: basePath,
    installMode: input.requestedMode,
    requestedMode: input.requestedMode,
    resolvedMode: input.requestedMode,
    enabledAt: input.now,
    status: "enabled"
  };
}

function makeLocalEvent(input: {
  readonly eventType: LocalEvent["eventType"];
  readonly skillID: string;
  readonly extensionID?: string | null;
  readonly extensionType?: ExtensionType | null;
  readonly extensionKind?: ExtensionKind | null;
  readonly version: string;
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly targetPath: string;
  readonly requestedMode: RequestedMode;
  readonly resolvedMode: RequestedMode;
  readonly occurredAt: string;
  readonly result?: LocalEvent["result"];
}): LocalEvent {
  return {
    eventID: `electron-local-${createHash("sha1").update(`${input.eventType}:${input.skillID}:${input.targetType}:${input.targetID}:${input.occurredAt}`).digest("hex")}`,
    eventType: input.eventType,
    skillID: input.skillID,
    extensionID: input.extensionID ?? null,
    extensionType: input.extensionType ?? null,
    extensionKind: input.extensionKind ?? null,
    version: input.version,
    targetType: input.targetType,
    targetID: input.targetID,
    targetPath: input.targetPath,
    requestedMode: input.requestedMode,
    resolvedMode: input.resolvedMode,
    occurredAt: input.occurredAt,
    result: input.result ?? "success"
  };
}

function makeDefaultTools(dataRoot: string, now: string): ToolConfig[] {
  return DEFAULT_TOOL_IDS.map((toolID) => ({
    toolID,
    displayName: toolID === "opencode" ? "opencode" : `${toolID.slice(0, 1).toUpperCase()}${toolID.slice(1)}`,
    adapterStatus: AdapterStatus.Manual,
    configPath: path.join(dataRoot, "targets", toolID, "config"),
    skillsPath: path.join(dataRoot, "targets", toolID, "skills"),
    enabled: true,
    detectionMethod: "manual",
    transformStrategy: DEFAULT_TRANSFORMS[toolID],
    lastScannedAt: now
  }));
}

function makeEmptyState(dataRoot: string, now: string): PersistedLocalState {
  return {
    schemaVersion: 1,
    installs: [],
    extensions: [],
    tools: makeDefaultTools(dataRoot, now),
    projects: [],
    notifications: [],
    offlineEvents: []
  };
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeSaveToolInput(args: LocalCommandRequestMap["save_tool_config"]): LocalCommandRequestMap["save_tool_config"] {
  const input = args as SaveToolInput;
  return input.tool ?? args;
}

function normalizeSaveProjectInput(args: LocalCommandRequestMap["save_project_config"]): LocalCommandRequestMap["save_project_config"] {
  const input = args as SaveProjectInput;
  return input.project ?? args;
}

function normalizeImportSkillInput(args: ImportLocalSkillInput): LocalCommandRequestMap["import_local_skill"]["input"] {
  return "input" in args ? args.input : args;
}

function normalizeImportExtensionInput(args: ImportLocalExtensionInput): LocalCommandRequestMap["import_local_extension"]["input"] {
  return "input" in args ? args.input : args;
}

function emptyBootstrap(centralStorePath: string, state: PersistedLocalState): LocalBootstrapResponse {
  return {
    installs: state.installs,
    extensions: state.extensions,
    tools: state.tools,
    projects: state.projects,
    notifications: state.notifications,
    offlineEvents: state.offlineEvents,
    pendingOfflineEventCount: state.offlineEvents.length,
    unreadLocalNotificationCount: state.notifications.filter((notification) => notification.unread).length,
    centralStorePath
  };
}

export class ElectronLocalRuntime {
  readonly #options: ElectronLocalRuntimeOptions;
  readonly #paths: ReturnType<typeof getElectronLocalStatePaths> & { readonly statePath: string };
  #initialized = false;

  public readonly handlers: LocalCommandHandlerMap;

  constructor(options: ElectronLocalRuntimeOptions) {
    this.#options = options;
    const basePaths = getElectronLocalStatePaths(options.electronUserDataDir, options.productDataDirName);
    this.#paths = {
      ...basePaths,
      statePath: path.join(basePaths.dataRoot, "electron-local-state.json")
    };
    this.handlers = this.#buildHandlers();
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    const migrationOptions: UserDataMigrationOptions = {
      electronUserDataDir: this.#options.electronUserDataDir,
      legacyRoots: this.#options.legacyRoots ?? [],
      appVersion: this.#options.appVersion,
      productDataDirName: this.#options.productDataDirName,
      now: this.#options.now
    };
    await migrateLegacyUserData(migrationOptions);
    await mkdir(this.#paths.centralStorePath, { recursive: true });
    await mkdir(path.dirname(this.#paths.statePath), { recursive: true });
    if (!(await exists(this.#paths.statePath))) {
      await this.#saveState(makeEmptyState(this.#paths.dataRoot, isoNow(this.#options.now)));
    }
    this.#initialized = true;
  }

  async invoke<K extends LocalCommandName>(command: K, args: LocalCommandRequestMap[K]): Promise<LocalCommandResponseMap[K]> {
    const handler = this.handlers[command];
    if (!handler) {
      throw new Error(`Unknown Electron local command: ${command}`);
    }
    return handler(args) as Promise<LocalCommandResponseMap[K]>;
  }

  async #loadState(): Promise<PersistedLocalState> {
    await this.initialize();
    return JSON.parse(await readFile(this.#paths.statePath, "utf8")) as PersistedLocalState;
  }

  async #saveState(state: PersistedLocalState): Promise<void> {
    await mkdir(path.dirname(this.#paths.statePath), { recursive: true });
    await writeFile(this.#paths.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async #mutateState<T>(mutator: (state: PersistedLocalState) => T | Promise<T>): Promise<T> {
    const state = await this.#loadState();
    const result = await mutator(state);
    await this.#saveState(state);
    return result;
  }

  #buildHandlers(): LocalCommandHandlerMap {
    return {
      [P1_LOCAL_COMMANDS.getLocalBootstrap]: async () => {
        const state = await this.#loadState();
        return emptyBootstrap(this.#paths.centralStorePath, state);
      },
      [P1_LOCAL_COMMANDS.detectTools]: async () => {
        const state = await this.#loadState();
        return state.tools;
      },
      [P1_LOCAL_COMMANDS.saveToolConfig]: async (args) => this.#saveToolConfig(args),
      [P1_LOCAL_COMMANDS.deleteToolConfig]: async (args) => {
        await this.#mutateState((state) => {
          state.tools = state.tools.filter((tool) => tool.toolID !== args.toolID);
        });
      },
      [P1_LOCAL_COMMANDS.saveProjectConfig]: async (args) => this.#saveProjectConfig(args),
      [P1_LOCAL_COMMANDS.deleteProjectConfig]: async (args) => {
        await this.#mutateState((state) => {
          state.projects = state.projects.filter((project) => project.projectID !== args.projectID);
        });
      },
      [P1_LOCAL_COMMANDS.validateTargetPath]: async (args) => this.#validateTargetPath(args.targetPath),
      [P1_LOCAL_COMMANDS.installSkillPackage]: async (args) => this.#upsertPackageInstall(args.downloadTicket, "remote"),
      [P1_LOCAL_COMMANDS.updateSkillPackage]: async (args) => this.#upsertPackageInstall(args.downloadTicket, "remote"),
      [P1_LOCAL_COMMANDS.importLocalSkill]: async (args) => this.#importLocalSkill(args),
      [P1_LOCAL_COMMANDS.enableSkill]: async (args) => this.#enableSkill(args),
      [P1_LOCAL_COMMANDS.disableSkill]: async (args) => this.#disableSkill(args),
      [P1_LOCAL_COMMANDS.uninstallSkill]: async (args) => this.#uninstallSkill(args.skillId),
      [P1_LOCAL_COMMANDS.listLocalExtensions]: async () => (await this.#loadState()).extensions,
      [P1_LOCAL_COMMANDS.scanExtensionTargets]: async () => this.#scanTargets(true),
      [P1_LOCAL_COMMANDS.importLocalExtension]: async (args) => this.#importLocalExtension(args),
      [P1_LOCAL_COMMANDS.enableExtension]: async (args) => this.#enableExtension(args),
      [P1_LOCAL_COMMANDS.disableExtension]: async (args) => this.#disableExtension(args),
      [P1_LOCAL_COMMANDS.upsertLocalNotifications]: async (args) => {
        await this.#mutateState((state) => {
          const byID = new Map(state.notifications.map((notification) => [notification.notificationID, notification]));
          for (const notification of args.notifications) byID.set(notification.notificationID, notification);
          state.notifications = [...byID.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        });
      },
      [P1_LOCAL_COMMANDS.markLocalNotificationsRead]: async (args) => {
        await this.#mutateState((state) => {
          state.notifications = state.notifications.map((notification) => {
            if (args.all || args.notificationIds.includes(notification.notificationID)) {
              return { ...notification, unread: false };
            }
            return notification;
          });
        });
      },
      [P1_LOCAL_COMMANDS.markOfflineEventsSynced]: async (args) => {
        await this.#mutateState((state) => {
          state.offlineEvents = state.offlineEvents.filter((event) => !args.eventIds.includes(event.eventID));
        });
        return { syncedEventIDs: [...args.eventIds] };
      },
      [P1_LOCAL_COMMANDS.scanLocalTargets]: async () => this.#scanTargets(false),
      [P1_LOCAL_COMMANDS.listLocalInstalls]: async () => (await this.#loadState()).installs,
      [P1_LOCAL_COMMANDS.pickProjectDirectory]: async () => {
        const projectPath = await this.#options.selectedProjectDirectory?.();
        return projectPath ? { projectPath } : null;
      }
    };
  }

  async #saveToolConfig(args: LocalCommandRequestMap["save_tool_config"]): Promise<ToolConfig> {
    const input = normalizeSaveToolInput(args);
    const now = isoNow(this.#options.now);
    const saved: ToolConfig = {
      toolID: input.toolID,
      displayName: input.name ?? input.toolID,
      adapterStatus: AdapterStatus.Manual,
      configuredPath: input.configPath,
      configPath: input.configPath,
      skillsPath: input.skillsPath,
      enabled: input.enabled ?? true,
      detectionMethod: "manual",
      transformStrategy: DEFAULT_TRANSFORMS[input.toolID] ?? "generic_directory",
      lastScannedAt: now
    };
    await this.#mutateState((state) => {
      state.tools = [...state.tools.filter((tool) => tool.toolID !== saved.toolID), saved];
    });
    return saved;
  }

  async #saveProjectConfig(args: LocalCommandRequestMap["save_project_config"]): Promise<ProjectConfig> {
    const input = normalizeSaveProjectInput(args);
    const now = isoNow(this.#options.now);
    const saved: ProjectConfig = {
      projectID: input.projectID ?? slugify(input.name),
      displayName: input.name,
      projectPath: input.projectPath,
      skillsPath: input.skillsPath,
      projectPathStatus: "valid",
      projectPathStatusReason: null,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now
    };
    await this.#mutateState((state) => {
      const previous = state.projects.find((project) => project.projectID === saved.projectID);
      state.projects = [
        ...state.projects.filter((project) => project.projectID !== saved.projectID),
        previous ? { ...saved, createdAt: previous.createdAt, updatedAt: now } : saved
      ];
    });
    return saved;
  }

  async #validateTargetPath(targetPath: string): Promise<LocalCommandResponseMap["validate_target_path"]> {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      return { valid: false, writable: false, exists: false, canCreate: false, reason: "路径不能为空" };
    }
    try {
      const targetStat = await stat(trimmed);
      return { valid: targetStat.isDirectory(), writable: true, exists: true, canCreate: false, reason: targetStat.isDirectory() ? undefined : "目标路径不是目录" };
    } catch {
      return { valid: true, writable: true, exists: false, canCreate: true };
    }
  }

  async #upsertPackageInstall(downloadTicket: DownloadTicketResponse, sourceType: LocalSkillInstall["sourceType"]): Promise<LocalSkillInstall> {
    const now = isoNow(this.#options.now);
    const install: MutableDeep<LocalSkillInstall> = {
      skillID: downloadTicket.skillID,
      displayName: downloadTicket.skillID,
      localVersion: downloadTicket.version,
      localHash: downloadTicket.packageHash,
      sourcePackageHash: downloadTicket.packageHash,
      sourceType,
      installedAt: now,
      updatedAt: now,
      localStatus: "installed",
      centralStorePath: path.join(this.#paths.centralStorePath, downloadTicket.skillID),
      enabledTargets: [],
      hasUpdate: false,
      isScopeRestricted: false,
      canUpdate: true
    };
    await this.#mutateState((state) => {
      const previous = state.installs.find((item) => item.skillID === install.skillID);
      state.installs = [
        ...state.installs.filter((item) => item.skillID !== install.skillID),
        previous ? { ...install, installedAt: previous.installedAt, enabledTargets: previous.enabledTargets } : install
      ];
    });
    await mkdir(install.centralStorePath, { recursive: true });
    return install;
  }

  async #importLocalSkill(args: ImportLocalSkillInput): Promise<LocalSkillInstall> {
    const input = normalizeImportSkillInput(args);
    const now = isoNow(this.#options.now);
    const sourceHash = hashString(`${input.targetType}:${input.targetID}:${input.relativePath}:${input.skillID}`);
    const target = makeEnabledTarget({ skillID: input.skillID, targetType: input.targetType, targetID: input.targetID, requestedMode: "copy", state: await this.#loadState(), now });
    const install: MutableDeep<LocalSkillInstall> = {
      skillID: input.skillID,
      displayName: input.skillID,
      localVersion: "0.0.0-local",
      localHash: sourceHash,
      sourcePackageHash: sourceHash,
      sourceType: "local_import",
      installedAt: now,
      updatedAt: now,
      localStatus: "enabled",
      centralStorePath: path.join(this.#paths.centralStorePath, input.skillID),
      enabledTargets: [target],
      hasUpdate: false,
      isScopeRestricted: false,
      canUpdate: false
    };
    await this.#mutateState((state) => {
      state.installs = [...state.installs.filter((item) => item.skillID !== install.skillID), install];
    });
    return install;
  }

  async #enableSkill(args: LocalCommandRequestMap["enable_skill"]): Promise<EnabledTarget> {
    const now = isoNow(this.#options.now);
    const target = await this.#mutateState((state) => {
      const skillID = args.skillId;
      const install = state.installs.find((item) => item.skillID === skillID);
      const enabledTarget = makeEnabledTarget({
        skillID,
        targetType: args.targetType,
        targetID: args.targetId,
        requestedMode: args.preferredMode ?? "copy",
        state,
        now
      });
      if (install) {
        install.enabledTargets = [
          ...install.enabledTargets.filter((item) => !(item.targetType === args.targetType && item.targetID === args.targetId)),
          enabledTarget
        ];
        install.localStatus = "enabled";
        install.updatedAt = now;
      }
      state.offlineEvents.push(makeLocalEvent({
        eventType: "enable_result",
        skillID,
        version: args.version,
        targetType: args.targetType,
        targetID: args.targetId,
        targetPath: enabledTarget.targetPath,
        requestedMode: enabledTarget.requestedMode,
        resolvedMode: enabledTarget.resolvedMode,
        occurredAt: now
      }));
      return enabledTarget;
    });
    return target;
  }

  async #disableSkill(args: LocalCommandRequestMap["disable_skill"]): Promise<EnabledTarget> {
    const now = isoNow(this.#options.now);
    return this.#mutateState((state) => {
      const install = state.installs.find((item) => item.skillID === args.skillId);
      const existing = install?.enabledTargets.find((target) => target.targetType === args.targetType && target.targetID === args.targetId)
        ?? makeEnabledTarget({ skillID: args.skillId, targetType: args.targetType, targetID: args.targetId, requestedMode: "copy", state, now });
      const disabled: EnabledTarget = { ...existing, status: "disabled" };
      if (install) {
        install.enabledTargets = install.enabledTargets.filter((target) => !(target.targetType === args.targetType && target.targetID === args.targetId));
        install.localStatus = install.enabledTargets.length > 0 ? "enabled" : "installed";
        install.updatedAt = now;
      }
      state.offlineEvents.push(makeLocalEvent({
        eventType: "disable_result",
        skillID: args.skillId,
        version: install?.localVersion ?? "0.0.0-local",
        targetType: args.targetType,
        targetID: args.targetId,
        targetPath: disabled.targetPath,
        requestedMode: disabled.requestedMode,
        resolvedMode: disabled.resolvedMode,
        occurredAt: now
      }));
      return disabled;
    });
  }

  async #uninstallSkill(skillID: string): Promise<LocalCommandResponseMap["uninstall_skill"]> {
    return this.#mutateState(async (state) => {
      const install = state.installs.find((item) => item.skillID === skillID);
      state.installs = state.installs.filter((item) => item.skillID !== skillID);
      await rm(path.join(this.#paths.centralStorePath, skillID), { recursive: true, force: true });
      return {
        skillID,
        removedCentralStorePath: true,
        removedTargets: install?.enabledTargets ?? [],
        failedTargets: []
      };
    });
  }

  async #importLocalExtension(args: ImportLocalExtensionInput): Promise<ExtensionInstall> {
    const input = normalizeImportExtensionInput(args);
    const now = isoNow(this.#options.now);
    const install: MutableDeep<ExtensionInstall> = {
      extensionID: input.extensionID,
      extensionType: input.extensionType,
      extensionKind: input.extensionKind,
      displayName: input.extensionID,
      localVersion: "0.0.0-local",
      localHash: hashString(`${input.extensionType}:${input.extensionID}:${input.relativePath}`),
      sourceType: "local_import",
      sourceURI: input.relativePath,
      manifest: {
        extensionID: input.extensionID,
        extensionType: input.extensionType,
        extensionKind: input.extensionKind,
        displayName: input.extensionID,
        version: "0.0.0-local",
        permissions: [],
        riskLevel: "unknown",
        auditStatus: "unknown"
      },
      permissions: [],
      riskLevel: "unknown",
      auditStatus: "unknown",
      enterpriseStatus: "allowed",
      centralStorePath: input.extensionKind === "file_backed" ? path.join(this.#paths.centralStorePath, input.extensionID) : null,
      installedAt: now,
      updatedAt: now,
      writeCapability: input.extensionKind === "file_backed",
      targets: []
    };
    await this.#mutateState((state) => {
      state.extensions = [...state.extensions.filter((item) => item.extensionID !== install.extensionID), install];
    });
    return install;
  }

  async #enableExtension(args: LocalCommandRequestMap["enable_extension"]): Promise<PluginTarget> {
    const now = isoNow(this.#options.now);
    return this.#mutateState((state) => {
      const extension = state.extensions.find((item) => item.extensionID === args.extensionID);
      const target: PluginTarget = {
        id: `${args.extensionID}:${args.targetType}:${args.targetID}`,
        extensionID: args.extensionID,
        extensionType: args.extensionType,
        extensionKind: args.extensionKind,
        targetType: args.targetType,
        targetAgent: args.targetID,
        targetID: args.targetID,
        targetName: targetName(args.targetType, args.targetID, state),
        targetPath: targetPath(args.targetType, args.targetID, state),
        requestedMode: args.requestedMode ?? args.preferredMode ?? "copy",
        resolvedMode: args.requestedMode ?? args.preferredMode ?? "copy",
        status: extension?.writeCapability === false ? "read_only" : "enabled",
        denialReason: extension?.writeCapability === false ? "P0 read-only extension inventory cannot be written." : null,
        enabledAt: now,
        updatedAt: now
      };
      if (extension) {
        extension.targets = [...extension.targets.filter((item) => item.id !== target.id), target];
        extension.updatedAt = now;
      }
      return target;
    });
  }

  async #disableExtension(args: LocalCommandRequestMap["disable_extension"]): Promise<PluginTarget> {
    const now = isoNow(this.#options.now);
    return this.#mutateState((state) => {
      const extension = state.extensions.find((item) => item.extensionID === args.extensionID);
      const existing = extension?.targets.find((target) => target.targetType === args.targetType && target.targetID === args.targetID);
      const disabled: PluginTarget = {
        ...(existing ?? {
          id: `${args.extensionID}:${args.targetType}:${args.targetID}`,
          extensionID: args.extensionID,
          extensionType: args.extensionType,
          extensionKind: args.extensionKind,
          targetType: args.targetType,
          targetAgent: args.targetID,
          targetID: args.targetID,
          targetName: targetName(args.targetType, args.targetID, state),
          targetPath: targetPath(args.targetType, args.targetID, state)
        }),
        status: "disabled",
        updatedAt: now
      };
      if (extension) {
        extension.targets = [...extension.targets.filter((target) => target.id !== disabled.id), disabled];
        extension.updatedAt = now;
      }
      return disabled;
    });
  }

  async #scanTargets(includeReadOnlyExtensions: boolean): Promise<ScanTargetSummary[]> {
    const state = await this.#loadState();
    const now = isoNow(this.#options.now);
    const targets = [
      ...state.tools.map((tool) => ({ targetType: "tool" as const, targetID: tool.toolID, targetName: tool.displayName, targetPath: tool.skillsPath, transformStrategy: tool.transformStrategy })),
      ...state.projects.map((project) => ({ targetType: "project" as const, targetID: project.projectID, targetName: project.displayName, targetPath: project.skillsPath, transformStrategy: "generic_directory" }))
    ];
    return targets.map((target) => {
      const managedFindings = state.installs.flatMap((install) => install.enabledTargets
        .filter((enabled) => enabled.targetType === target.targetType && enabled.targetID === target.targetID)
        .map((enabled) => ({
          id: `${target.targetType}:${target.targetID}:${install.skillID}`,
          kind: "managed" as const,
          skillID: install.skillID,
          extensionID: install.skillID,
          extensionType: "skill" as const,
          extensionKind: "file_backed" as const,
          writeCapability: true,
          enterpriseStatus: "allowed" as const,
          targetType: target.targetType,
          targetID: target.targetID,
          targetName: target.targetName,
          targetPath: target.targetPath,
          relativePath: install.skillID,
          checksum: install.localHash,
          canImport: false,
          importDisplayName: install.displayName,
          importVersion: install.localVersion,
          message: "已由 Electron 本地 Store 管理。"
        })));
      const readOnlyFindings = includeReadOnlyExtensions ? ["mcp_server", "plugin", "hook", "agent_cli"].map((extensionType) => ({
        id: `${target.targetType}:${target.targetID}:p0-${extensionType}-precheck`,
        kind: "unmanaged" as const,
        skillID: null,
        extensionID: `p0-${extensionType}-precheck`,
        extensionType: extensionType as ExtensionType,
        extensionKind: extensionType === "agent_cli" ? "agent_cli" as const : "config_backed" as const,
        writeCapability: false,
        enterpriseStatus: "allowed" as const,
        targetType: target.targetType,
        targetID: target.targetID,
        targetName: target.targetName,
        targetPath: target.targetPath,
        relativePath: `.${extensionType}`,
        checksum: null,
        canImport: false,
        importDisplayName: `P0 ${extensionType} precheck`,
        importVersion: "0.0.0-policy",
        message: "P0 仅审计/预检，不写入非 file-backed Extension。"
      })) : [];
      return {
        id: `${target.targetType}:${target.targetID}`,
        targetType: target.targetType,
        targetID: target.targetID,
        targetName: target.targetName,
        targetPath: target.targetPath,
        transformStrategy: target.transformStrategy,
        scannedAt: now,
        counts: {
          managed: managedFindings.length,
          unmanaged: readOnlyFindings.length,
          conflict: 0,
          orphan: 0
        },
        findings: [...managedFindings, ...readOnlyFindings],
        lastError: null
      } satisfies ScanTargetSummary;
    });
  }
}

export function createElectronLocalRuntime(options: ElectronLocalRuntimeOptions): ElectronLocalRuntime {
  return new ElectronLocalRuntime(options);
}
