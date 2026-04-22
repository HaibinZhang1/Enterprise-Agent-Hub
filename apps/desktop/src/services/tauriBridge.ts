import type { DownloadTicket, EnabledTarget, LocalBootstrap, LocalEvent, LocalNotification, LocalSkillInstall, ProjectConfig, ProjectDirectorySelection, RequestedMode, ScanTargetSummary, SkillSummary, TargetType, ToolConfig, ValidateTargetPathResult } from "../domain/p1.ts";
import { getLocalBootstrap, listLocalInstalls } from "./tauriBridge/bootstrap.ts";
import type {
  ClientAppVersionInfo,
  ClientUpdateArtifactInput,
  ClientUpdateDownloadResult,
  ClientUpdateLaunchInput,
  ClientUpdateLaunchResult,
  ClientUpdateVerificationResult,
  ClientUpdateVerifyInput
} from "./tauriBridge/clientUpdates.ts";
import { downloadClientUpdate, getClientAppVersion, launchClientInstaller, verifyClientUpdate } from "./tauriBridge/clientUpdates.ts";
import { saveProjectConfig, saveToolConfig, pickProjectDirectory } from "./tauriBridge/configOps.ts";
import { disableSkill, enableSkill, importLocalSkill, installSkillPackage, uninstallSkill, updateSkillPackage } from "./tauriBridge/packageOps.ts";
import { markLocalNotificationsRead, markOfflineEventsSynced, upsertLocalNotifications } from "./tauriBridge/notificationOps.ts";
import { refreshToolDetection, scanLocalTargets, validateTargetPath } from "./tauriBridge/scanOps.ts";

export interface DesktopBridge {
  getClientAppVersion(): Promise<ClientAppVersionInfo>;
  downloadClientUpdate(input: ClientUpdateArtifactInput): Promise<ClientUpdateDownloadResult>;
  verifyClientUpdate(input: ClientUpdateVerifyInput): Promise<ClientUpdateVerificationResult>;
  launchClientInstaller(input: ClientUpdateLaunchInput): Promise<ClientUpdateLaunchResult>;
  getLocalBootstrap(): Promise<LocalBootstrap>;
  installSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  importLocalSkill(input: { targetType: TargetType; targetID: string; relativePath: string; skillID: string; conflictStrategy: "rename" | "replace" }): Promise<LocalSkillInstall>;
  saveToolConfig(tool: { toolID: string; name?: string; configPath: string; skillsPath: string; enabled?: boolean }): Promise<ToolConfig>;
  saveProjectConfig(project: { projectID?: string; name: string; projectPath: string; skillsPath: string; enabled?: boolean }): Promise<ProjectConfig>;
  uninstallSkill(skillID: string): Promise<{ removedTargetIDs: string[]; failedTargetIDs: string[]; event: LocalEvent }>;
  enableSkill(input: { skill: SkillSummary; targetType: TargetType; targetID: string; requestedMode: RequestedMode; allowOverwrite?: boolean }): Promise<{ target: EnabledTarget; event: LocalEvent }>;
  disableSkill(input: { skill: SkillSummary; targetID: string; targetType?: TargetType }): Promise<{ event: LocalEvent }>;
  upsertLocalNotifications(notifications: LocalNotification[]): Promise<void>;
  markLocalNotificationsRead(notificationIDs: string[] | "all"): Promise<void>;
  markOfflineEventsSynced(eventIDs: string[]): Promise<string[]>;
  listLocalInstalls(): Promise<LocalSkillInstall[]>;
  refreshToolDetection(): Promise<ToolConfig[]>;
  scanLocalTargets(): Promise<ScanTargetSummary[]>;
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
  saveToolConfig,
  saveProjectConfig,
  uninstallSkill,
  enableSkill,
  disableSkill,
  upsertLocalNotifications,
  markLocalNotificationsRead,
  markOfflineEventsSynced,
  listLocalInstalls,
  refreshToolDetection,
  scanLocalTargets,
  validateTargetPath,
  pickProjectDirectory,
};
