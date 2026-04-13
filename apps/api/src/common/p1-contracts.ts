export type ErrorCode =
  | 'unauthenticated'
  | 'permission_denied'
  | 'skill_not_found'
  | 'resource_not_found'
  | 'validation_failed'
  | 'skill_delisted'
  | 'scope_restricted'
  | 'package_unavailable'
  | 'package_too_large'
  | 'package_file_count_exceeded'
  | 'hash_mismatch'
  | 'conversion_failed'
  | 'server_unavailable';

export type SkillStatus = 'published' | 'delisted' | 'archived';
export type VisibilityLevel = 'private' | 'summary_visible' | 'detail_visible' | 'public_installable';
export type DetailAccess = 'none' | 'summary' | 'full';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type InstallState = 'not_installed' | 'installed' | 'enabled' | 'update_available' | 'blocked';
export type ConnectionStatus = 'connected' | 'connecting' | 'offline' | 'failed';
export type TargetType = 'tool' | 'project';
export type RequestedMode = 'symlink' | 'copy';
export type ResolvedMode = 'symlink' | 'copy';
export type MenuPermission =
  | 'home'
  | 'market'
  | 'my_installed'
  | 'review'
  | 'manage'
  | 'tools'
  | 'projects'
  | 'notifications'
  | 'settings';
export type NotificationType =
  | 'skill_update_available'
  | 'skill_scope_restricted'
  | 'local_copy_blocked'
  | 'connection_restored'
  | 'connection_failed'
  | 'target_path_invalid'
  | 'install_result'
  | 'update_result'
  | 'uninstall_result'
  | 'enable_result'
  | 'disable_result';
export type ReviewStatus = 'pending' | 'in_review' | 'reviewed';
export type ReviewType = 'publish' | 'update' | 'permission_change';
export type WorkflowState =
  | 'system_prechecking'
  | 'manual_precheck'
  | 'pending_review'
  | 'in_review'
  | 'returned_for_changes'
  | 'review_rejected'
  | 'withdrawn'
  | 'published';
export type PublishScopeType =
  | 'current_department'
  | 'department_tree'
  | 'selected_departments'
  | 'all_employees';
export type SubmissionType = ReviewType;
export type ReviewDecision = 'approve' | 'return_for_changes' | 'reject' | 'withdraw';
export type ReviewAction = 'claim' | 'pass_precheck' | 'approve' | 'return_for_changes' | 'reject' | 'withdraw';

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    detail: unknown;
    retryable: boolean;
  };
}

export interface UserSummary {
  userID: string;
  displayName: string;
  role: 'normal_user' | 'admin';
  adminLevel?: number;
  departmentID: string;
  departmentName: string;
  locale: string;
}

export interface SkillSummary {
  skillID: string;
  displayName: string;
  description: string;
  version: string;
  status: SkillStatus;
  visibilityLevel: VisibilityLevel;
  detailAccess: DetailAccess;
  canInstall: boolean;
  cannotInstallReason?: ErrorCode;
  installState: InstallState;
  authorName?: string;
  authorDepartment?: string;
  currentVersionUpdatedAt: string;
  compatibleTools: string[];
  compatibleSystems: string[];
  icon?: string;
  tags?: string[];
  category?: string;
  starCount: number;
  downloadCount: number;
  riskLevel?: RiskLevel;
}

export interface EnabledTarget {
  targetType: TargetType;
  targetID: string;
  targetName: string;
  targetPath: string;
  installMode: ResolvedMode;
  requestedMode: RequestedMode;
  resolvedMode: ResolvedMode;
  fallbackReason?: string;
  enabledAt: string;
  status: 'enabled' | 'disabled' | 'failed';
  lastError?: string;
}

export interface SkillDetail extends SkillSummary {
  readme?: string;
  usage?: string;
  screenshots?: string[];
  reviewSummary?: string;
  riskDescription?: string;
  versions?: Array<{ version: string; publishedAt: string }>;
  enabledTargets: EnabledTarget[];
  latestVersion: string;
  hasUpdate: boolean;
  canUpdate: boolean;
}

export interface DownloadTicketResponse {
  skillID: string;
  version: string;
  packageRef: string;
  packageURL: string;
  packageHash: string;
  packageSize: number;
  packageFileCount: number;
  expiresAt: string;
}

export interface NotificationDto {
  notificationID: string;
  type: NotificationType;
  title: string;
  summary: string;
  objectType?: 'skill' | 'tool' | 'project' | 'connection';
  objectID?: string;
  createdAt: string;
  read: boolean;
  action?: string;
}

export interface LocalEventDto {
  eventID: string;
  eventType: NotificationType;
  skillID?: string;
  version?: string;
  targetType?: TargetType;
  targetID?: string;
  targetPath?: string;
  requestedMode?: RequestedMode;
  resolvedMode?: ResolvedMode;
  fallbackReason?: string;
  occurredAt: string;
  result: 'success' | 'failed';
}

export interface DepartmentNodeDto {
  departmentID: string;
  parentDepartmentID: string | null;
  name: string;
  path: string;
  level: number;
  status: string;
  userCount: number;
  skillCount: number;
  children: DepartmentNodeDto[];
}

export interface AdminUserDto {
  userID: string;
  username: string;
  displayName: string;
  departmentID: string;
  departmentName: string;
  role: 'normal_user' | 'admin';
  adminLevel: number | null;
  status: 'active' | 'frozen' | 'deleted';
  publishedSkillCount: number;
  starCount: number;
}

export interface AdminSkillDto {
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

export interface ReviewHistoryDto {
  historyID: string;
  action: string;
  actorName: string;
  comment: string | null;
  createdAt: string;
}

export interface ReviewPrecheckItemDto {
  id: string;
  label: string;
  status: 'pass' | 'warn';
  message: string;
}

export interface ReviewItemDto {
  reviewID: string;
  skillID: string;
  skillDisplayName: string;
  submitterName: string;
  submitterDepartmentName: string;
  reviewType: ReviewType;
  reviewStatus: ReviewStatus;
  workflowState: WorkflowState;
  riskLevel: RiskLevel;
  summary: string;
  lockState: 'unlocked' | 'locked';
  lockOwnerID?: string;
  currentReviewerName?: string;
  requestedVersion?: string;
  requestedVisibilityLevel?: VisibilityLevel;
  requestedScopeType?: PublishScopeType;
  decision?: ReviewDecision;
  availableActions: ReviewAction[];
  submittedAt: string;
  updatedAt: string;
}

export interface ReviewDetailDto extends ReviewItemDto {
  description: string;
  reviewSummary?: string;
  currentVersion?: string;
  currentVisibilityLevel?: VisibilityLevel;
  currentScopeType?: PublishScopeType;
  requestedDepartmentIDs: string[];
  precheckResults: ReviewPrecheckItemDto[];
  packageRef?: string;
  packageURL?: string;
  packageHash?: string;
  packageSize?: number;
  packageFileCount?: number;
  history: ReviewHistoryDto[];
}

export interface PublisherSkillSummaryDto {
  skillID: string;
  displayName: string;
  publishedSkillExists: boolean;
  currentVersion?: string | null;
  currentStatus?: SkillStatus | null;
  currentVisibilityLevel?: VisibilityLevel | null;
  currentScopeType?: PublishScopeType | null;
  latestSubmissionID?: string | null;
  latestSubmissionType?: SubmissionType | null;
  latestWorkflowState?: WorkflowState | null;
  latestReviewStatus?: ReviewStatus | null;
  latestDecision?: ReviewDecision | null;
  latestRequestedVersion?: string | null;
  latestRequestedVisibilityLevel?: VisibilityLevel | null;
  latestRequestedScopeType?: PublishScopeType | null;
  latestReviewSummary?: string | null;
  submittedAt?: string | null;
  updatedAt: string;
  canWithdraw: boolean;
}

export interface PublisherSubmissionDetailDto {
  submissionID: string;
  submissionType: SubmissionType;
  workflowState: WorkflowState;
  reviewStatus: ReviewStatus;
  decision?: ReviewDecision;
  skillID: string;
  displayName: string;
  description: string;
  changelog: string;
  version: string;
  currentVersion?: string | null;
  visibilityLevel: VisibilityLevel;
  currentVisibilityLevel?: VisibilityLevel | null;
  scopeType: PublishScopeType;
  currentScopeType?: PublishScopeType | null;
  selectedDepartmentIDs: string[];
  reviewSummary?: string | null;
  precheckResults: ReviewPrecheckItemDto[];
  packageRef?: string;
  packageURL?: string;
  packageHash?: string;
  packageSize?: number;
  packageFileCount?: number;
  submittedAt: string;
  updatedAt: string;
  canWithdraw: boolean;
  history: ReviewHistoryDto[];
}

export interface BootstrapContextDto {
  user: UserSummary;
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
    enabledCount?: number;
    updateAvailableCount: number;
    unreadNotificationCount: number;
  };
  navigation: MenuPermission[];
  menuPermissions: MenuPermission[];
}

export function pageOf<T>(items: T[], page: number, pageSize: number, total = items.length): PageResponse<T> {
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}

export function errorBody(code: ErrorCode, message: string, retryable = false, detail: unknown = null): ApiErrorBody {
  return { error: { code, message, detail, retryable } };
}
