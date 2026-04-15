import type { DownloadTicket, EnabledTarget, LocalBootstrap, LocalEvent, LocalNotification, LocalSkillInstall, ProjectConfig, ProjectDirectorySelection, RequestedMode, ScanTargetSummary, SkillSummary, TargetType, ToolConfig, ValidateTargetPathResult } from "../domain/p1.ts";
import { getLocalBootstrap, listLocalInstalls } from "./tauriBridge/bootstrap.ts";
import { saveProjectConfig, saveToolConfig, pickProjectDirectory } from "./tauriBridge/configOps.ts";
import { disableSkill, enableSkill, installSkillPackage, uninstallSkill, updateSkillPackage } from "./tauriBridge/packageOps.ts";
import { markLocalNotificationsRead, markOfflineEventsSynced, upsertLocalNotifications } from "./tauriBridge/notificationOps.ts";
import { refreshToolDetection, scanLocalTargets, validateTargetPath } from "./tauriBridge/scanOps.ts";

export interface DesktopBridge {
  getLocalBootstrap(): Promise<LocalBootstrap>;
  installSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
  updateSkillPackage(downloadTicket: DownloadTicket): Promise<LocalSkillInstall>;
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
  getLocalBootstrap,
  installSkillPackage,
  updateSkillPackage,
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
