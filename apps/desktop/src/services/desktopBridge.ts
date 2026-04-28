import type { DownloadTicket, EnabledTarget, ExtensionInstall, ExtensionKind, ExtensionType, LocalBootstrap, LocalEvent, LocalNotification, LocalSkillInstall, PluginTarget, ProjectConfig, ProjectDirectorySelection, RequestedMode, ScanTargetSummary, SkillSummary, TargetType, ToolConfig, ValidateTargetPathResult } from "../domain/p1.ts";
import { getLocalBootstrap, listLocalExtensions, listLocalInstalls } from "./desktopBridge/bootstrap.ts";
import type {
  ClientAppVersionInfo,
  ClientUpdateArtifactInput,
  ClientUpdateDownloadResult,
  ClientUpdateLaunchInput,
  ClientUpdateLaunchResult,
  ClientUpdateVerificationResult,
  ClientUpdateVerifyInput
} from "./desktopBridge/clientUpdates.ts";
import { downloadClientUpdate, getClientAppVersion, launchClientInstaller, verifyClientUpdate } from "./desktopBridge/clientUpdates.ts";
import { deleteProjectConfig, deleteToolConfig, saveProjectConfig, saveToolConfig, pickProjectDirectory } from "./desktopBridge/configOps.ts";
import { disableExtension, disableSkill, enableExtension, enableSkill, importLocalExtension, importLocalSkill, installSkillPackage, uninstallSkill, updateSkillPackage } from "./desktopBridge/packageOps.ts";
import { markLocalNotificationsRead, markOfflineEventsSynced, upsertLocalNotifications } from "./desktopBridge/notificationOps.ts";
import { refreshToolDetection, scanExtensionTargets, scanLocalTargets, validateTargetPath } from "./desktopBridge/scanOps.ts";

export interface DesktopBridge {
  getClientAppVersion(): Promise<ClientAppVersionInfo>;
  downloadClientUpdate(input: ClientUpdateArtifactInput): Promise<ClientUpdateDownloadResult>;
  verifyClientUpdate(input: ClientUpdateVerifyInput): Promise<ClientUpdateVerificationResult>;
  launchClientInstaller(input: ClientUpdateLaunchInput): Promise<ClientUpdateLaunchResult>;
  getLocalBootstrap(): Promise<LocalBootstrap>;
  installSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  importLocalSkill(input: { targetType: TargetType; targetID: string; relativePath: string; skillID: string; conflictStrategy: "rename" | "replace" }): Promise<LocalSkillInstall>;
  listLocalExtensions(): Promise<ExtensionInstall[]>;
  importLocalExtension(input: { extensionID: string; extensionType: ExtensionType; extensionKind: ExtensionKind; targetType: TargetType; targetID: string; relativePath: string; conflictStrategy: "rename" | "replace" }): Promise<ExtensionInstall>;
  enableExtension(input: { extension: ExtensionInstall; targetType: TargetType; targetID: string; requestedMode: RequestedMode; allowOverwrite?: boolean }): Promise<PluginTarget>;
  disableExtension(input: { extension: ExtensionInstall; targetID: string; targetType?: TargetType }): Promise<PluginTarget>;
  saveToolConfig(tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }): Promise<ToolConfig>;
  deleteToolConfig(toolID: string): Promise<void>;
  saveProjectConfig(project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }): Promise<ProjectConfig>;
  deleteProjectConfig(projectID: string): Promise<void>;
  uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[]; failedTargetIDs: string[]; event: LocalEvent }>;
  enableSkill(input: { skill: SkillSummary; targetType: TargetType; targetID: string; requestedMode: RequestedMode; allowOverwrite?: boolean }): Promise<{ target: EnabledTarget; event: LocalEvent }>;
  disableSkill(input: { skill: SkillSummary; targetID: string; targetType?: TargetType }): Promise<{ event: LocalEvent }>;
  upsertLocalNotifications(notifications: LocalNotification[]): Promise<void>;
  markLocalNotificationsRead(notificationIDs: string[] | "all"): Promise<void>;
  markOfflineEventsSynced(eventIDs: string[]): Promise<string[]>;
  listLocalInstalls(): Promise<LocalSkillInstall[]>;
  refreshToolDetection(): Promise<ToolConfig[]>;
  scanLocalTargets(): Promise<ScanTargetSummary[]>;
  scanExtensionTargets(): Promise<ScanTargetSummary[]>;
  validateTargetPath(targetPath: string): Promise<ValidateTargetPathResult>;
  pickProjectDirectory(): Promise<ProjectDirectorySelection | null>;
}

export const desktopBridge: DesktopBridge = {
  getClientAppVersion,
  downloadClientUpdate,
  verifyClientUpdate,
  launchClientInstaller,
  getLocalBootstrap,
  installSkillPackage,
  updateSkillPackage,
  importLocalSkill,
  listLocalExtensions,
  importLocalExtension,
  enableExtension,
  disableExtension,
  saveToolConfig,
  deleteToolConfig,
  saveProjectConfig,
  deleteProjectConfig,
  uninstallSkill,
  enableSkill,
  disableSkill,
  upsertLocalNotifications,
  markLocalNotificationsRead,
  markOfflineEventsSynced,
  listLocalInstalls,
  refreshToolDetection,
  scanLocalTargets,
  scanExtensionTargets,
  validateTargetPath,
  pickProjectDirectory,
};
