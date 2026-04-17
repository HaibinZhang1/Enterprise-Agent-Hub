import type {
  AdminSkill as SharedAdminSkill,
  AdminUser as SharedAdminUser,
  AdapterStatus as SharedAdapterStatus,
  ApiErrorCode,
  ConnectionStatus as SharedConnectionStatus,
  CurrentUser as SharedCurrentUser,
  DepartmentNode as SharedDepartmentNode,
  DesktopBootstrapResponse,
  DetailAccess as SharedDetailAccess,
  DetectionMethod as SharedDetectionMethod,
  DownloadTicketResponse as SharedDownloadTicket,
  EnabledTarget as SharedEnabledTarget,
  InstallState as SharedInstallState,
  LocalBootstrapResponse as SharedLocalBootstrapResponse,
  LocalNotification as SharedLocalNotification,
  LocalEvent as SharedLocalEvent,
  LocalSkillInstall as SharedLocalSkillInstall,
  NavigationItem as SharedMenuPermission,
  PackageFileContent as SharedPackageFileContent,
  PackageFileEntry as SharedPackageFileEntry,
  PackagePreviewFileType as SharedPackagePreviewFileType,
  PublishScopeType as SharedPublishScopeType,
  PublisherSkillSummary as SharedPublisherSkillSummary,
  PublisherStatusAction as SharedPublisherStatusAction,
  PublisherSubmissionDetail as SharedPublisherSubmissionDetail,
  RequestedMode as SharedRequestedMode,
  ResolvedMode as SharedResolvedMode,
  ReviewAction as SharedReviewAction,
  ReviewDecision as SharedReviewDecision,
  ReviewDetail as SharedReviewDetail,
  ReviewHistory as SharedReviewHistory,
  ReviewItem as SharedReviewItem,
  ReviewPrecheckItem as SharedReviewPrecheckItem,
  ReviewStatus as SharedReviewStatus,
  ReviewType as SharedReviewType,
  RiskLevel as SharedRiskLevel,
  ScanFindingKind as SharedScanFindingKind,
  SkillStatus as SharedSkillStatus,
  SkillSummary as SharedSkillSummary,
  SubmissionType as SharedSubmissionType,
  TargetType as SharedTargetType,
  VisibilityLevel as SharedVisibilityLevel,
  ProjectDirectorySelection as SharedProjectDirectorySelection,
  WorkflowState as SharedWorkflowState
} from "@enterprise-agent-hub/shared-contracts";

type MutableDeep<T> = T extends readonly (infer TItem)[]
  ? MutableDeep<TItem>[]
  : T extends object
    ? { -readonly [K in keyof T]: MutableDeep<T[K]> }
    : T;

export type SkillStatus = SharedSkillStatus;
export type VisibilityLevel = SharedVisibilityLevel;
export type DetailAccess = SharedDetailAccess;
export type RiskLevel = SharedRiskLevel;
export type InstallState = SharedInstallState;
export type ConnectionStatus = SharedConnectionStatus;
export type TargetType = SharedTargetType;
export type AdapterStatus = SharedAdapterStatus;
export type RequestedMode = SharedRequestedMode;
export type ResolvedMode = SharedResolvedMode;
export type DetectionMethod = SharedDetectionMethod;
export type ScanFindingKind = SharedScanFindingKind;
export type MenuPermission = SharedMenuPermission;
export type NavigationPageID = MenuPermission;
export type PageID = NavigationPageID | "detail";
export type NotificationType = SharedLocalEvent["eventType"];
export type ReviewStatus = SharedReviewStatus;
export type ReviewType = SharedReviewType;
export type WorkflowState = SharedWorkflowState;
export type PublishScopeType = SharedPublishScopeType;
export type SubmissionType = SharedSubmissionType;
export type ReviewDecision = SharedReviewDecision;
export type ReviewAction = SharedReviewAction;
export type PublisherStatusAction = SharedPublisherStatusAction;
export type PackagePreviewFileType = SharedPackagePreviewFileType;
export type AuthState = "guest" | "authenticated";
export type SettingsLanguage = "auto" | "zh-CN" | "en-US";
export type SettingsTheme = "classic" | "fresh" | "contrast";
export type NotificationListFilter = "all" | "unread";
export type ReviewBoardTab = "pending" | "in_review" | "reviewed";
export type PendingActionCode = "pending_backend" | "pending_local_command";

export type P1User = MutableDeep<SharedCurrentUser>;
export type BootstrapContext = MutableDeep<DesktopBootstrapResponse>;

export interface EnabledTarget extends Omit<SharedEnabledTarget, "fallbackReason" | "status" | "lastError" | "installMode"> {
  id?: string;
  skillID?: string;
  installMode?: RequestedMode;
  fallbackReason: string | null;
  status?: "enabled" | "disabled" | "failed";
  lastError?: string | null;
}

export type DownloadTicket = SharedDownloadTicket;

export interface LocalSkillInstall extends Omit<SharedLocalSkillInstall, "enabledTargets" | "sourcePackageHash"> {
  sourcePackageHash: string;
  enabledTargets: EnabledTarget[];
}

export interface LocalBootstrap extends Omit<SharedLocalBootstrapResponse, "installs" | "tools" | "projects" | "notifications" | "offlineEvents"> {
  installs: LocalSkillInstall[];
  tools: ToolConfig[];
  projects: ProjectConfig[];
  notifications: LocalNotification[];
  offlineEvents: LocalEvent[];
}

export interface SkillSummary extends Omit<SharedSkillSummary, "cannotInstallReason"> {
  localVersion: string | null;
  canUpdate: boolean;
  cannotInstallReason?: ApiErrorCode | string;
  publishedAt: string;
  tags: string[];
  category: string;
  riskLevel: RiskLevel;
  starred: boolean;
  readme?: string;
  reviewSummary?: string;
  latestVersion?: string;
  isScopeRestricted: boolean;
  hasLocalHashDrift: boolean;
  enabledTargets: EnabledTarget[];
  lastEnabledAt: string | null;
}

export interface ToolConfig {
  toolID: string;
  name: string;
  displayName: string;
  configPath: string;
  detectedPath?: string | null;
  configuredPath?: string | null;
  skillsPath: string;
  enabled: boolean;
  status: AdapterStatus;
  adapterStatus: AdapterStatus;
  detectionMethod: DetectionMethod;
  transform: "codex_skill" | "claude_skill" | "cursor_rule" | "windsurf_rule" | "opencode_skill" | "generic_directory";
  transformStrategy: "codex_skill" | "claude_skill" | "cursor_rule" | "windsurf_rule" | "opencode_skill" | "generic_directory";
  enabledSkillCount: number;
  lastScannedAt?: string | null;
}

export interface ProjectConfig {
  projectID: string;
  name: string;
  displayName: string;
  projectPath: string;
  skillsPath: string;
  enabled: boolean;
  enabledSkillCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScanFinding {
  id: string;
  kind: ScanFindingKind;
  skillID: string | null;
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  relativePath: string;
  checksum?: string | null;
  message: string;
}

export interface ScanTargetSummary {
  id: string;
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  transformStrategy: ToolConfig["transformStrategy"] | "generic_directory";
  scannedAt: string;
  counts: {
    managed: number;
    unmanaged: number;
    conflict: number;
    orphan: number;
  };
  findings: ScanFinding[];
  lastError?: string | null;
}

export interface DiscoveredLocalSkillTarget {
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  relativePath: string;
  findingKind: Exclude<ScanFindingKind, "managed">;
  message: string;
}

export interface DiscoveredLocalSkill {
  skillID: string;
  displayName: string;
  description: string;
  sourceLabel: string;
  matchedMarketSkill: boolean;
  targets: DiscoveredLocalSkillTarget[];
}

export interface ValidateTargetPathResult {
  valid: boolean;
  writable: boolean;
  exists: boolean;
  canCreate: boolean;
  reason?: string | null;
}

export type LocalNotification = MutableDeep<SharedLocalNotification>;

export interface PublishDraftFile {
  name: string;
  relativePath: string;
  size: number;
  mimeType: string;
}

export interface PublishDraft {
  submissionType: SubmissionType;
  uploadMode: "none" | "zip" | "folder";
  packageName: string;
  skillID: string;
  displayName: string;
  description: string;
  version: string;
  scope: PublishScopeType;
  selectedDepartmentIDs: string[];
  visibility: VisibilityLevel;
  changelog: string;
  category: string;
  tags: string[];
  compatibleTools: string[];
  compatibleSystems: string[];
  files: PublishDraftFile[];
}

export interface PublishPrecheckItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "pending";
  message: string;
}

export interface PublishPrecheckResult {
  items: PublishPrecheckItem[];
  canSubmit: boolean;
}

export interface ReviewDecisionDraft {
  reviewID: string;
  decision: Extract<ReviewDecision, "approve" | "return_for_changes" | "reject">;
  comment: string;
}

export interface PreferenceState {
  language: SettingsLanguage;
  autoDetectLanguage: boolean;
  theme: SettingsTheme;
  showInstallResults: boolean;
  syncLocalEvents: boolean;
}

export interface ToolDraft {
  toolID?: string;
  name: string;
  configPath: string;
  skillsPath: string;
  enabled: boolean;
}

export interface ProjectDraft {
  projectID?: string;
  name: string;
  projectPath: string;
  skillsPath: string;
  enabled: boolean;
}

export type ProjectDirectorySelection = MutableDeep<SharedProjectDirectorySelection>;

export interface ActionAvailability {
  kind: "live" | PendingActionCode;
  label: string;
  reason: string;
}

export interface TargetDraft {
  key: string;
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  disabled: boolean;
  statusLabel: string;
  selected: boolean;
  availability: ActionAvailability;
}

export type DesktopModalState =
  | { type: "none" }
  | {
      type: "confirm";
      title: string;
      body: string;
      confirmLabel: string;
      tone: "primary" | "danger";
      detailLines?: string[];
    }
  | {
      type: "targets";
      skillID: string;
    }
  | {
      type: "tool_editor";
    }
  | {
      type: "project_editor";
    }
  | {
      type: "connection_status";
    }
  | {
      type: "app_update";
    }
  | {
      type: "settings";
    };

export interface LocalEvent extends Omit<SharedLocalEvent, "fallbackReason" | "result"> {
  eventType: Extract<NotificationType, "enable_result" | "disable_result" | "uninstall_result" | "target_path_invalid" | "local_copy_blocked">;
  fallbackReason: string | null;
  result: "success" | "failed";
}

export interface OperationProgress {
  operation: "install" | "update" | "enable" | "disable" | "uninstall";
  skillID: string;
  stage: string;
  result: "running" | "success" | "failed";
  message: string;
}

export interface MarketFilters {
  query: string;
  department: string;
  compatibleTool: string;
  installed: "all" | "installed" | "not_installed";
  enabled: "all" | "enabled" | "not_enabled";
  accessScope: "include_public" | "authorized_only";
  category: string;
  riskLevel: "all" | RiskLevel;
  publishedWithin: "all" | "7d" | "30d" | "90d";
  updatedWithin: "all" | "7d" | "30d" | "90d";
  sort: "composite" | "latest_published" | "recently_updated" | "download_count" | "star_count" | "relevance";
}

export type DepartmentNode = MutableDeep<SharedDepartmentNode>;
export type AdminUser = MutableDeep<SharedAdminUser>;
export type AdminSkill = MutableDeep<SharedAdminSkill>;
export type ReviewItem = MutableDeep<SharedReviewItem>;
export type ReviewHistory = MutableDeep<SharedReviewHistory>;
export type PackageFileEntry = MutableDeep<SharedPackageFileEntry>;
export type PackageFileContent = MutableDeep<SharedPackageFileContent>;
export type ReviewPrecheckItem = MutableDeep<SharedReviewPrecheckItem>;
export type ReviewDetail = MutableDeep<SharedReviewDetail>;
export type PublisherSkillSummary = MutableDeep<SharedPublisherSkillSummary>;
export type PublisherSubmissionDetail = MutableDeep<SharedPublisherSubmissionDetail>;

class PendingActionError extends Error {
  readonly code: PendingActionCode;
  readonly action: string;

  constructor(code: PendingActionCode, action: string, message: string) {
    super(message);
    this.name = code === "pending_backend" ? "PendingBackendError" : "PendingLocalCommandError";
    this.code = code;
    this.action = action;
  }
}

export class PendingBackendError extends PendingActionError {
  constructor(action: string, message = "后端接口待接入，当前前端仅保留真实表单与提交占位。") {
    super("pending_backend", action, message);
  }
}

export class PendingLocalCommandError extends PendingActionError {
  constructor(action: string, message = "本地 Tauri 命令待接入，当前前端仅保留真实交互与命令占位。") {
    super("pending_local_command", action, message);
  }
}
