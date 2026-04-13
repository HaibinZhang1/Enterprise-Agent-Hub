export type SkillStatus = "published" | "delisted" | "archived";
export type VisibilityLevel = "private" | "summary_visible" | "detail_visible" | "public_installable";
export type DetailAccess = "none" | "summary" | "full";
export type RiskLevel = "low" | "medium" | "high" | "unknown";
export type InstallState = "not_installed" | "installed" | "enabled" | "update_available" | "blocked";
export type ConnectionStatus = "connected" | "connecting" | "offline" | "failed";
export type TargetType = "tool" | "project";
export type AdapterStatus = "detected" | "manual" | "missing" | "invalid" | "disabled";
export type RequestedMode = "symlink" | "copy";
export type ResolvedMode = "symlink" | "copy";
export type DetectionMethod = "registry" | "default_path" | "manual";
export type ScanFindingKind = "managed" | "unmanaged" | "conflict" | "orphan";
export type MenuPermission =
  | "home"
  | "market"
  | "my_installed"
  | "review"
  | "manage"
  | "tools"
  | "projects"
  | "notifications"
  | "settings";
export type NavigationPageID = MenuPermission;
export type PageID = NavigationPageID | "detail";
export type NotificationType =
  | "skill_update_available"
  | "skill_scope_restricted"
  | "local_copy_blocked"
  | "connection_restored"
  | "connection_failed"
  | "target_path_invalid"
  | "install_result"
  | "update_result"
  | "uninstall_result"
  | "enable_result"
  | "disable_result";
export type ReviewStatus = "pending" | "in_review" | "reviewed";
export type ReviewType = "publish" | "update" | "permission_change";
export type AuthState = "guest" | "authenticated";
export type SettingsLanguage = "auto" | "zh-CN" | "en-US";
export type SettingsTheme = "classic" | "fresh" | "contrast";
export type NotificationListFilter = "all" | "unread";
export type ReviewBoardTab = "pending" | "in_review" | "reviewed";
export type PendingActionCode = "pending_backend" | "pending_local_command";

export interface P1User {
  userID: string;
  displayName: string;
  role: string;
  adminLevel?: number;
  departmentID: string;
  departmentName: string;
  locale: string;
}

export interface BootstrapContext {
  user: P1User;
  connection: {
    status: ConnectionStatus;
    serverTime: string;
    apiVersion: string;
    lastError?: string;
  };
  features: {
    p1Desktop: boolean;
    publishSkill: boolean;
    reviewWorkbench: boolean;
    adminManage: boolean;
    mcpManage: boolean;
    pluginManage: boolean;
  };
  counts: {
    installedCount: number;
    enabledCount: number;
    updateAvailableCount: number;
    unreadNotificationCount: number;
  };
  navigation: MenuPermission[];
  menuPermissions: MenuPermission[];
}

export interface EnabledTarget {
  id?: string;
  skillID?: string;
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  installMode?: RequestedMode;
  requestedMode: RequestedMode;
  resolvedMode: ResolvedMode;
  fallbackReason: string | null;
  enabledAt: string;
  status?: "enabled" | "disabled" | "failed";
  lastError?: string | null;
}

export interface DownloadTicket {
  skillID: string;
  version: string;
  packageRef: string;
  packageURL: string;
  packageHash: `sha256:${string}`;
  packageSize: number;
  packageFileCount: number;
  expiresAt: string;
}

export interface LocalSkillInstall {
  skillID: string;
  displayName: string;
  localVersion: string;
  localHash: string;
  sourcePackageHash: string;
  installedAt: string;
  updatedAt: string;
  localStatus: "installed" | "enabled" | "partially_failed";
  centralStorePath: string;
  enabledTargets: EnabledTarget[];
  hasUpdate: boolean;
  isScopeRestricted: boolean;
  canUpdate: boolean;
}

export interface LocalBootstrap {
  installs: LocalSkillInstall[];
  tools: ToolConfig[];
  projects: ProjectConfig[];
  offlineEvents: LocalEvent[];
  pendingOfflineEventCount: number;
  unreadLocalNotificationCount: number;
  centralStorePath: string;
}

export interface SkillSummary {
  skillID: string;
  displayName: string;
  description: string;
  version: string;
  localVersion: string | null;
  status: SkillStatus;
  visibilityLevel: VisibilityLevel;
  detailAccess: DetailAccess;
  canInstall: boolean;
  canUpdate: boolean;
  cannotInstallReason?: string;
  installState: InstallState;
  authorName?: string;
  authorDepartment?: string;
  currentVersionUpdatedAt: string;
  publishedAt: string;
  compatibleTools: string[];
  compatibleSystems: string[];
  tags: string[];
  category: string;
  riskLevel: RiskLevel;
  starCount: number;
  downloadCount: number;
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

export interface ValidateTargetPathResult {
  valid: boolean;
  writable: boolean;
  exists: boolean;
  canCreate: boolean;
  reason?: string | null;
}

export interface LocalNotification {
  notificationID: string;
  type: NotificationType;
  title: string;
  summary: string;
  relatedSkillID: string | null;
  targetPage: PageID;
  occurredAt: string;
  unread: boolean;
  source: "server" | "local" | "sync";
}

export interface PublishDraftFile {
  name: string;
  size: number;
  mimeType: string;
}

export interface PublishDraft {
  uploadMode: "none" | "zip" | "folder";
  packageName: string;
  skillID: string;
  displayName: string;
  version: string;
  scope: "current_department" | "department_tree" | "selected_departments" | "all_employees";
  visibility: VisibilityLevel;
  changelog: string;
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
  decision: "approve" | "return_for_changes" | "reject";
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
    };

export interface LocalEvent {
  eventID: string;
  eventType: Extract<NotificationType, "enable_result" | "disable_result" | "uninstall_result" | "target_path_invalid" | "local_copy_blocked">;
  skillID: string;
  version: string;
  targetType: TargetType;
  targetID: string;
  targetPath: string;
  requestedMode: RequestedMode;
  resolvedMode: ResolvedMode;
  fallbackReason: string | null;
  occurredAt: string;
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
  riskLevel: "all" | RiskLevel;
  sort: "composite" | "latest_published" | "recently_updated" | "download_count" | "star_count" | "relevance";
}

export interface DepartmentNode {
  departmentID: string;
  parentDepartmentID: string | null;
  name: string;
  path: string;
  level: number;
  status: string;
  userCount: number;
  skillCount: number;
  children: DepartmentNode[];
}

export interface AdminUser {
  userID: string;
  username: string;
  displayName: string;
  departmentID: string;
  departmentName: string;
  role: "normal_user" | "admin";
  adminLevel: number | null;
  status: "active" | "frozen" | "deleted";
  publishedSkillCount: number;
  starCount: number;
}

export interface AdminSkill {
  skillID: string;
  displayName: string;
  publisherName: string;
  departmentID: string;
  departmentName: string;
  version: string;
  status: SkillStatus;
  visibilityLevel: VisibilityLevel;
  starCount: number;
  downloadCount: number;
  updatedAt: string;
}

export interface ReviewItem {
  reviewID: string;
  skillID: string;
  skillDisplayName: string;
  submitterName: string;
  submitterDepartmentName: string;
  reviewType: ReviewType;
  reviewStatus: ReviewStatus;
  riskLevel: RiskLevel;
  summary: string;
  lockState: "unlocked" | "locked";
  currentReviewerName?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface ReviewHistory {
  historyID: string;
  action: string;
  actorName: string;
  comment: string | null;
  createdAt: string;
}

export interface ReviewDetail extends ReviewItem {
  description: string;
  reviewSummary?: string;
  history: ReviewHistory[];
}

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
