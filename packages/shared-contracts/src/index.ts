export type ISODateTimeString = string;
export type SemVerString = string;
export type SkillID = string;
export type UserID = string;
export type DepartmentID = string;
export type DeviceID = string;

export const SKILL_CATEGORIES = [
  "开发",
  "测试",
  "文档",
  "设计",
  "运维",
  "安全",
  "集成",
  "自动化",
  "数据",
  "知识",
  "其他"
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_TAGS = [
  "代码",
  "审查",
  "重构",
  "提示",
  "规范",
  "清单",
  "文档",
  "写作",
  "测试",
  "验收",
  "前端",
  "可访问",
  "设计",
  "运维",
  "值班",
  "事故",
  "安全",
  "权限",
  "集成",
  "适配",
  "自动化",
  "发布",
  "数据",
  "分析",
  "入门",
  "培训"
] as const;
export type SkillTag = (typeof SKILL_TAGS)[number];

export const SkillStatus = {
  Published: "published",
  Delisted: "delisted",
  Archived: "archived"
} as const;
export type SkillStatus = (typeof SkillStatus)[keyof typeof SkillStatus];

export const VisibilityLevel = {
  Private: "private",
  SummaryVisible: "summary_visible",
  DetailVisible: "detail_visible",
  PublicInstallable: "public_installable"
} as const;
export type VisibilityLevel = (typeof VisibilityLevel)[keyof typeof VisibilityLevel];

export const DetailAccess = {
  None: "none",
  Summary: "summary",
  Full: "full"
} as const;
export type DetailAccess = (typeof DetailAccess)[keyof typeof DetailAccess];

export const RiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Unknown: "unknown"
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const InstallState = {
  NotInstalled: "not_installed",
  Installed: "installed",
  Enabled: "enabled",
  UpdateAvailable: "update_available",
  Blocked: "blocked"
} as const;
export type InstallState = (typeof InstallState)[keyof typeof InstallState];

export const LocalStatus = {
  Installed: "installed",
  Enabled: "enabled",
  PartiallyFailed: "partially_failed"
} as const;
export type LocalStatus = (typeof LocalStatus)[keyof typeof LocalStatus];

export const ConnectionStatus = {
  Connected: "connected",
  Connecting: "connecting",
  Offline: "offline",
  Failed: "failed"
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const TargetType = {
  Tool: "tool",
  Project: "project"
} as const;
export type TargetType = (typeof TargetType)[keyof typeof TargetType];

export const AdapterStatus = {
  Detected: "detected",
  Manual: "manual",
  Missing: "missing",
  Invalid: "invalid",
  Disabled: "disabled"
} as const;
export type AdapterStatus = (typeof AdapterStatus)[keyof typeof AdapterStatus];

export const InstallMode = {
  Symlink: "symlink",
  Copy: "copy"
} as const;
export type InstallMode = (typeof InstallMode)[keyof typeof InstallMode];
export type RequestedMode = InstallMode;
export type ResolvedMode = InstallMode;

export const NotificationType = {
  SkillUpdateAvailable: "skill_update_available",
  ClientUpdate: "client_update",
  SkillScopeRestricted: "skill_scope_restricted",
  LocalCopyBlocked: "local_copy_blocked",
  ConnectionRestored: "connection_restored",
  ConnectionFailed: "connection_failed",
  TargetPathInvalid: "target_path_invalid",
  InstallResult: "install_result",
  UpdateResult: "update_result",
  UninstallResult: "uninstall_result",
  EnableResult: "enable_result",
  DisableResult: "disable_result"
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const ClientReleasePlatform = {
  Windows: "windows"
} as const;
export type ClientReleasePlatform = (typeof ClientReleasePlatform)[keyof typeof ClientReleasePlatform];

export const ClientReleaseArch = {
  X64: "x64"
} as const;
export type ClientReleaseArch = (typeof ClientReleaseArch)[keyof typeof ClientReleaseArch];

export const ClientReleaseChannel = {
  Stable: "stable",
  Internal: "internal",
  Beta: "beta"
} as const;
export type ClientReleaseChannel = (typeof ClientReleaseChannel)[keyof typeof ClientReleaseChannel];

export const ClientReleaseStatus = {
  Draft: "draft",
  Published: "published",
  Paused: "paused",
  Yanked: "yanked"
} as const;
export type ClientReleaseStatus = (typeof ClientReleaseStatus)[keyof typeof ClientReleaseStatus];

export const ClientUpdateCheckStatus = {
  UpToDate: "up_to_date",
  UpdateAvailable: "update_available",
  MandatoryUpdate: "mandatory_update",
  UnsupportedVersion: "unsupported_version"
} as const;
export type ClientUpdateCheckStatus = (typeof ClientUpdateCheckStatus)[keyof typeof ClientUpdateCheckStatus];

export const ClientArtifactSignatureStatus = {
  Signed: "signed",
  Unsigned: "unsigned",
  Unknown: "unknown"
} as const;
export type ClientArtifactSignatureStatus = (typeof ClientArtifactSignatureStatus)[keyof typeof ClientArtifactSignatureStatus];

export const ClientUpdateEventType = {
  Prompted: "prompted",
  Dismissed: "dismissed",
  DownloadStarted: "download_started",
  DownloadFailed: "download_failed",
  Downloaded: "downloaded",
  HashFailed: "hash_failed",
  SignatureFailed: "signature_failed",
  InstallerStarted: "installer_started",
  InstallCancelled: "install_cancelled",
  Installed: "installed"
} as const;
export type ClientUpdateEventType = (typeof ClientUpdateEventType)[keyof typeof ClientUpdateEventType];

export const ReviewStatus = {
  Pending: "pending",
  InReview: "in_review",
  Reviewed: "reviewed"
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const ReviewType = {
  Publish: "publish",
  Update: "update",
  PermissionChange: "permission_change"
} as const;
export type ReviewType = (typeof ReviewType)[keyof typeof ReviewType];

export const WorkflowState = {
  SystemPrechecking: "system_prechecking",
  ManualPrecheck: "manual_precheck",
  PendingReview: "pending_review",
  InReview: "in_review",
  ReturnedForChanges: "returned_for_changes",
  ReviewRejected: "review_rejected",
  Withdrawn: "withdrawn",
  Published: "published"
} as const;
export type WorkflowState = (typeof WorkflowState)[keyof typeof WorkflowState];

export const PublishScopeType = {
  CurrentDepartment: "current_department",
  DepartmentTree: "department_tree",
  SelectedDepartments: "selected_departments",
  AllEmployees: "all_employees"
} as const;
export type PublishScopeType = (typeof PublishScopeType)[keyof typeof PublishScopeType];
export type SubmissionType = ReviewType;

export const ReviewDecision = {
  Approve: "approve",
  ReturnForChanges: "return_for_changes",
  Reject: "reject",
  Withdraw: "withdraw"
} as const;
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision];

export const ReviewAction = {
  Claim: "claim",
  PassPrecheck: "pass_precheck",
  Approve: "approve",
  ReturnForChanges: "return_for_changes",
  Reject: "reject",
  Withdraw: "withdraw"
} as const;
export type ReviewAction = (typeof ReviewAction)[keyof typeof ReviewAction];

export const PublisherStatusAction = {
  Delist: "delist",
  Relist: "relist",
  Archive: "archive"
} as const;
export type PublisherStatusAction = (typeof PublisherStatusAction)[keyof typeof PublisherStatusAction];

export const PackagePreviewFileType = {
  Markdown: "markdown",
  Text: "text",
  Other: "other"
} as const;
export type PackagePreviewFileType = (typeof PackagePreviewFileType)[keyof typeof PackagePreviewFileType];

export const ApiErrorCode = {
  Unauthenticated: "unauthenticated",
  PermissionDenied: "permission_denied",
  SkillNotFound: "skill_not_found",
  ResourceNotFound: "resource_not_found",
  ValidationFailed: "validation_failed",
  SkillDelisted: "skill_delisted",
  ScopeRestricted: "scope_restricted",
  PackageUnavailable: "package_unavailable",
  PackageTooLarge: "package_too_large",
  PackageFileCountExceeded: "package_file_count_exceeded",
  HashMismatch: "hash_mismatch",
  ConversionFailed: "conversion_failed",
  ServerUnavailable: "server_unavailable"
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const NavigationItem = {
  Home: "home",
  Market: "market",
  MyInstalled: "my_installed",
  Publisher: "publisher",
  TargetManagement: "target_management",
  Review: "review",
  AdminDepartments: "admin_departments",
  AdminUsers: "admin_users",
  AdminSkills: "admin_skills",
  Notifications: "notifications",
} as const;
export type NavigationItem = (typeof NavigationItem)[keyof typeof NavigationItem];

export const SortOption = {
  Composite: "composite",
  LatestPublished: "latest_published",
  RecentlyUpdated: "recently_updated",
  DownloadCount: "download_count",
  StarCount: "star_count",
  Relevance: "relevance"
} as const;
export type SortOption = (typeof SortOption)[keyof typeof SortOption];

export const AccessScope = {
  AuthorizedOnly: "authorized_only",
  IncludePublic: "include_public"
} as const;
export type AccessScope = (typeof AccessScope)[keyof typeof AccessScope];

export const DetectionMethod = {
  Registry: "registry",
  DefaultPath: "default_path",
  Manual: "manual"
} as const;
export type DetectionMethod = (typeof DetectionMethod)[keyof typeof DetectionMethod];

export const ScanFindingKind = {
  Managed: "managed",
  Unmanaged: "unmanaged",
  Conflict: "conflict",
  Orphan: "orphan"
} as const;
export type ScanFindingKind = (typeof ScanFindingKind)[keyof typeof ScanFindingKind];

export const LocalEventResult = {
  Success: "success",
  Failed: "failed"
} as const;
export type LocalEventResult = (typeof LocalEventResult)[keyof typeof LocalEventResult];

export const EnabledTargetStatus = {
  Enabled: "enabled",
  Disabled: "disabled",
  Failed: "failed"
} as const;
export type EnabledTargetStatus = (typeof EnabledTargetStatus)[keyof typeof EnabledTargetStatus];

export interface PaginatedResponse<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasMore: boolean;
}

export interface PaginationQuery {
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ApiErrorBody<TDetail = unknown> {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly detail: TDetail | null;
  readonly retryable: boolean;
}

export interface ApiErrorResponse<TDetail = unknown> {
  readonly error: ApiErrorBody<TDetail>;
}

export interface CurrentUser {
  readonly username: string;
  readonly phoneNumber: string;
  readonly role: string;
  readonly adminLevel?: number;
  readonly departmentID: DepartmentID;
  readonly departmentName: string;
  readonly locale: string;
}

export interface ConnectionInfo {
  readonly status: ConnectionStatus;
  readonly serverTime: ISODateTimeString;
  readonly apiVersion: string;
  readonly lastError?: string;
}

export interface FeatureFlags {
  readonly p1Desktop: boolean;
  readonly publishSkill: boolean;
  readonly reviewWorkbench: boolean;
  readonly adminManage: boolean;
  readonly mcpManage: boolean;
  readonly pluginManage: boolean;
}

export interface BootstrapCounts {
  readonly installedCount: number;
  readonly enabledCount: number;
  readonly updateAvailableCount: number;
  readonly unreadNotificationCount: number;
}

export interface DesktopBootstrapResponse {
  readonly user: CurrentUser;
  readonly connection: ConnectionInfo;
  readonly features: FeatureFlags;
  readonly counts: BootstrapCounts;
  readonly navigation: readonly NavigationItem[];
  readonly menuPermissions: readonly NavigationItem[];
}

export interface LoginRequest {
  readonly phoneNumber: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly user: CurrentUser;
  readonly expiresAt: ISODateTimeString;
  readonly expiresIn: number;
  readonly menuPermissions: readonly NavigationItem[];
}

export interface SkillSummary {
  readonly skillID: SkillID;
  readonly displayName: string;
  readonly description: string;
  readonly version: SemVerString;
  readonly status: SkillStatus;
  readonly visibilityLevel: VisibilityLevel;
  readonly detailAccess: DetailAccess;
  readonly canInstall: boolean;
  readonly cannotInstallReason?: ApiErrorCode;
  readonly installState: InstallState;
  readonly authorName?: string;
  readonly authorDepartment?: string;
  readonly currentVersionUpdatedAt: ISODateTimeString;
  readonly compatibleTools: readonly string[];
  readonly compatibleSystems: readonly string[];
  readonly icon?: string;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly starCount: number;
  readonly starred: boolean;
  readonly downloadCount: number;
  readonly riskLevel?: RiskLevel;
}

export const SkillLeaderboardKind = {
  Hot: "hot",
  Stars: "stars",
  Downloads: "downloads"
} as const;
export type SkillLeaderboardKind = (typeof SkillLeaderboardKind)[keyof typeof SkillLeaderboardKind];

export interface SkillLeaderboardItem extends SkillSummary {
  readonly recentStarCount: number;
  readonly recentDownloadCount: number;
  readonly hotScore: number;
}

export interface SkillLeaderboardsResponse {
  readonly generatedAt: ISODateTimeString;
  readonly windowDays: number;
  readonly hot: readonly SkillLeaderboardItem[];
  readonly stars: readonly SkillLeaderboardItem[];
  readonly downloads: readonly SkillLeaderboardItem[];
}

export interface SkillVersionSummary {
  readonly version: SemVerString;
  readonly publishedAt: ISODateTimeString;
  readonly changelog?: string;
  readonly riskLevel?: RiskLevel;
}

export interface EnabledTarget {
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly targetName: string;
  readonly targetPath: string;
  readonly installMode: InstallMode;
  readonly requestedMode: RequestedMode;
  readonly resolvedMode: ResolvedMode;
  readonly fallbackReason?: string;
  readonly enabledAt: ISODateTimeString;
  readonly status: EnabledTargetStatus;
  readonly lastError?: string;
}

export interface SkillDetail extends SkillSummary {
  readonly readme?: string;
  readonly usage?: string;
  readonly screenshots?: readonly string[];
  readonly reviewSummary?: string;
  readonly riskDescription?: string;
  readonly versions?: readonly SkillVersionSummary[];
  readonly enabledTargets: readonly EnabledTarget[];
  readonly latestVersion: SemVerString;
  readonly hasUpdate?: boolean;
  readonly canUpdate?: boolean;
}

export interface ListSkillsQuery extends PaginationQuery {
  readonly q?: string;
  readonly departmentID?: DepartmentID;
  readonly compatibleTool?: string;
  readonly installed?: boolean;
  readonly enabled?: boolean;
  readonly accessScope?: AccessScope;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly riskLevel?: RiskLevel;
  readonly sort?: SortOption;
}

export interface DownloadTicketRequest {
  readonly purpose: "install" | "update";
  readonly targetVersion: SemVerString;
  readonly localVersion: SemVerString | null;
}

export interface DownloadTicketResponse {
  readonly skillID: SkillID;
  readonly version: SemVerString;
  readonly packageRef: string;
  readonly packageURL: string;
  readonly packageHash: `sha256:${string}`;
  readonly packageSize: number;
  readonly packageFileCount: number;
  readonly expiresAt: ISODateTimeString;
}

export interface ClientUpdateCheckRequest {
  readonly currentVersion: SemVerString;
  readonly buildNumber?: string;
  readonly platform: ClientReleasePlatform;
  readonly arch: ClientReleaseArch;
  readonly osVersion?: string;
  readonly channel: ClientReleaseChannel;
  readonly deviceID: DeviceID;
  readonly dismissedVersion?: SemVerString | null;
}

export interface ClientUpdateCheckResponse {
  readonly status: ClientUpdateCheckStatus;
  readonly updateType: "none" | "optional" | "mandatory" | "unsupported";
  readonly currentVersion: SemVerString;
  readonly latestVersion: SemVerString | null;
  readonly releaseID?: string;
  readonly channel: ClientReleaseChannel;
  readonly packageName?: string;
  readonly sizeBytes?: number;
  readonly sha256?: `sha256:${string}`;
  readonly publishedAt?: ISODateTimeString;
  readonly releaseNotes?: string;
  readonly mandatory: boolean;
  readonly minSupportedVersion?: SemVerString | null;
  readonly downloadTicketRequired: boolean;
}

export interface ClientUpdateDownloadTicketResponse {
  readonly releaseID: string;
  readonly version: SemVerString;
  readonly downloadURL: string;
  readonly expiresAt: ISODateTimeString;
  readonly packageName: string;
  readonly sizeBytes: number;
  readonly sha256: `sha256:${string}`;
  readonly signatureStatus: ClientArtifactSignatureStatus;
}

export interface ReportClientUpdateEventRequest {
  readonly releaseID?: string | null;
  readonly deviceID: DeviceID;
  readonly eventType: ClientUpdateEventType;
  readonly fromVersion: SemVerString;
  readonly toVersion?: SemVerString | null;
  readonly errorCode?: string | null;
}

export interface ReportClientUpdateEventResponse {
  readonly accepted: true;
}

export interface StarResponse {
  readonly skillID: SkillID;
  readonly starred: boolean;
  readonly starCount: number;
}

export interface Notification {
  readonly notificationID: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly summary: string;
  readonly objectType?: "skill" | "tool" | "project" | "connection" | "client_update";
  readonly objectID?: string;
  readonly createdAt: ISODateTimeString;
  readonly read: boolean;
  readonly action?: string;
}

export interface LocalNotification {
  readonly notificationID: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly summary: string;
  readonly relatedSkillID: SkillID | null;
  readonly targetPage: NavigationItem | "detail";
  readonly occurredAt: ISODateTimeString;
  readonly unread: boolean;
  readonly source: "server" | "local" | "sync";
}

export interface ListNotificationsQuery extends PaginationQuery {
  readonly unreadOnly?: boolean;
}

export interface MarkNotificationsReadRequest {
  readonly notificationIDs?: readonly string[];
  readonly all: boolean;
}

export interface MarkNotificationsReadResponse {
  readonly unreadNotificationCount: number;
}

export interface DepartmentNode {
  readonly departmentID: DepartmentID;
  readonly parentDepartmentID: DepartmentID | null;
  readonly name: string;
  readonly path: string;
  readonly level: number;
  readonly status: string;
  readonly userCount: number;
  readonly skillCount: number;
  /** Active admin users in this department subtree, matching userCount subtree semantics. */
  readonly adminCount: number;
  readonly children: readonly DepartmentNode[];
}

export interface AdminUser {
  readonly username: string;
  readonly phoneNumber: string;
  readonly departmentID: DepartmentID;
  readonly departmentName: string;
  readonly departmentPath: string;
  readonly role: "normal_user" | "admin";
  readonly adminLevel: number | null;
  readonly status: "active" | "frozen" | "deleted";
  readonly lastLoginAt: ISODateTimeString | null;
  readonly publishedSkillCount: number;
  readonly starCount: number;
}

export interface AdminSkill {
  readonly skillID: SkillID;
  readonly displayName: string;
  readonly description: string;
  readonly publisherName: string;
  readonly departmentID: DepartmentID;
  readonly departmentName: string;
  readonly category: string | null;
  readonly version: SemVerString;
  readonly currentVersionRiskLevel: RiskLevel;
  readonly currentVersionReviewSummary: string | null;
  readonly status: SkillStatus;
  readonly visibilityLevel: VisibilityLevel;
  readonly starCount: number;
  readonly downloadCount: number;
  readonly updatedAt: ISODateTimeString;
}

export interface ClientUpdateReleaseArtifact {
  readonly artifactID: string;
  readonly bucket: string;
  readonly objectKey: string;
  readonly packageName: string;
  readonly sizeBytes: number;
  readonly sha256: `sha256:${string}`;
  readonly signatureStatus: ClientArtifactSignatureStatus;
  readonly createdAt: ISODateTimeString;
}

export interface ClientUpdateReleaseSummary {
  readonly releaseID: string;
  readonly version: SemVerString;
  readonly buildNumber?: string | null;
  readonly platform: ClientReleasePlatform;
  readonly arch: ClientReleaseArch;
  readonly channel: ClientReleaseChannel;
  readonly status: ClientReleaseStatus;
  readonly mandatory: boolean;
  readonly minSupportedVersion?: SemVerString | null;
  readonly rolloutPercent: number;
  readonly releaseNotes: string;
  readonly publishedAt?: ISODateTimeString | null;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
  readonly publishedBy?: UserID | null;
  readonly createdBy: UserID;
  readonly latestEventAt?: ISODateTimeString | null;
  readonly eventCount: number;
  readonly artifact?: ClientUpdateReleaseArtifact;
}

export interface CreateClientUpdateReleaseRequest {
  readonly version: SemVerString;
  readonly buildNumber?: string;
  readonly platform: ClientReleasePlatform;
  readonly arch: ClientReleaseArch;
  readonly channel: ClientReleaseChannel;
  readonly mandatory?: boolean;
  readonly minSupportedVersion?: SemVerString | null;
  readonly rolloutPercent?: number;
  readonly releaseNotes: string;
}

export interface RegisterClientUpdateArtifactRequest {
  readonly packageName: string;
  readonly sizeBytes: number;
  readonly sha256: `sha256:${string}`;
  readonly signatureStatus: ClientArtifactSignatureStatus;
  readonly objectKey?: string;
}

export interface PublishClientUpdateReleaseRequest {
  readonly mandatory?: boolean;
  readonly minSupportedVersion?: SemVerString | null;
  readonly rolloutPercent?: number;
}

export interface UpdateClientUpdateRolloutRequest {
  readonly rolloutPercent: number;
}

export interface ClientUpdateReleaseActionRequest {
  readonly reason?: string;
}

export interface ReviewItem {
  readonly reviewID: string;
  readonly skillID: SkillID;
  readonly skillDisplayName: string;
  readonly submitterName: string;
  readonly submitterDepartmentName: string;
  readonly reviewType: ReviewType;
  readonly reviewStatus: ReviewStatus;
  readonly workflowState: WorkflowState;
  readonly riskLevel: RiskLevel;
  readonly summary: string;
  readonly lockState: "unlocked" | "locked";
  readonly lockOwnerID?: UserID;
  readonly currentReviewerName?: string;
  readonly requestedVersion?: SemVerString;
  readonly requestedVisibilityLevel?: VisibilityLevel;
  readonly requestedScopeType?: PublishScopeType;
  readonly decision?: ReviewDecision;
  readonly availableActions: readonly ReviewAction[];
  readonly submittedAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}

export interface ReviewHistory {
  readonly historyID: string;
  readonly action: string;
  readonly actorName: string;
  readonly comment: string | null;
  readonly createdAt: ISODateTimeString;
}

export interface PackageFileEntry {
  readonly relativePath: string;
  readonly fileType: PackagePreviewFileType;
  readonly sizeBytes: number;
  readonly previewable: boolean;
}

export interface PackageFileContent {
  readonly relativePath: string;
  readonly fileType: PackagePreviewFileType;
  readonly content: string;
  readonly truncated: boolean;
}

export interface ReviewDetail extends ReviewItem {
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly reviewSummary?: string;
  readonly currentVersion?: SemVerString;
  readonly currentVisibilityLevel?: VisibilityLevel;
  readonly currentScopeType?: PublishScopeType;
  readonly requestedDepartmentIDs: readonly DepartmentID[];
  readonly precheckResults: readonly ReviewPrecheckItem[];
  readonly packageRef?: string;
  readonly packageURL?: string;
  readonly packageHash?: `sha256:${string}` | string;
  readonly packageSize?: number;
  readonly packageFileCount?: number;
  readonly packageFiles: readonly PackageFileEntry[];
  readonly history: readonly ReviewHistory[];
}

export interface ReviewPrecheckItem {
  readonly id: string;
  readonly label: string;
  readonly status: "pass" | "warn";
  readonly message: string;
}

export interface PublisherSkillSummary {
  readonly skillID: SkillID;
  readonly displayName: string;
  readonly publishedSkillExists: boolean;
  readonly category?: string | null;
  readonly tags?: readonly string[] | null;
  readonly currentVersion?: SemVerString | null;
  readonly currentStatus?: SkillStatus | null;
  readonly currentVisibilityLevel?: VisibilityLevel | null;
  readonly currentScopeType?: PublishScopeType | null;
  readonly latestSubmissionID?: string | null;
  readonly latestSubmissionType?: ReviewType | null;
  readonly latestWorkflowState?: WorkflowState | null;
  readonly latestReviewStatus?: ReviewStatus | null;
  readonly latestDecision?: ReviewDecision | null;
  readonly latestRequestedVersion?: SemVerString | null;
  readonly latestRequestedVisibilityLevel?: VisibilityLevel | null;
  readonly latestRequestedScopeType?: PublishScopeType | null;
  readonly latestReviewSummary?: string | null;
  readonly submittedAt?: ISODateTimeString | null;
  readonly updatedAt: ISODateTimeString;
  readonly canWithdraw: boolean;
  readonly availableStatusActions: readonly PublisherStatusAction[];
}

export interface PublisherSubmissionDetail {
  readonly submissionID: string;
  readonly submissionType: ReviewType;
  readonly workflowState: WorkflowState;
  readonly reviewStatus: ReviewStatus;
  readonly decision?: ReviewDecision;
  readonly skillID: SkillID;
  readonly displayName: string;
  readonly description: string;
  readonly changelog: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly version: SemVerString;
  readonly currentVersion?: SemVerString | null;
  readonly visibilityLevel: VisibilityLevel;
  readonly currentVisibilityLevel?: VisibilityLevel | null;
  readonly scopeType: PublishScopeType;
  readonly currentScopeType?: PublishScopeType | null;
  readonly selectedDepartmentIDs: readonly DepartmentID[];
  readonly reviewSummary?: string;
  readonly precheckResults: readonly ReviewPrecheckItem[];
  readonly packageRef?: string;
  readonly packageURL?: string;
  readonly packageHash?: `sha256:${string}` | string;
  readonly packageSize?: number;
  readonly packageFileCount?: number;
  readonly packageFiles: readonly PackageFileEntry[];
  readonly submittedAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
  readonly canWithdraw: boolean;
  readonly history: readonly ReviewHistory[];
}

export interface LocalEvent {
  readonly eventID: string;
  readonly eventType: NotificationType;
  readonly skillID: SkillID;
  readonly version: SemVerString;
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly targetPath: string;
  readonly requestedMode: RequestedMode;
  readonly resolvedMode: ResolvedMode;
  readonly fallbackReason?: string;
  readonly occurredAt: ISODateTimeString;
  readonly result: LocalEventResult;
}

export interface LocalEventsRequest {
  readonly deviceID: DeviceID;
  readonly events: readonly LocalEvent[];
}

export interface RejectedLocalEvent {
  readonly eventID: string;
  readonly code: ApiErrorCode;
  readonly message: string;
}

export interface RemoteNotice {
  readonly skillID: SkillID;
  readonly noticeType: NotificationType;
  readonly message: string;
}

export interface LocalEventsResponse {
  readonly acceptedEventIDs: readonly string[];
  readonly rejectedEvents: readonly RejectedLocalEvent[];
  readonly serverStateChanged: boolean;
  readonly remoteNotices: readonly RemoteNotice[];
}

export interface LocalSkillInstall {
  readonly skillID: SkillID;
  readonly displayName: string;
  readonly localVersion: SemVerString;
  readonly localHash: string;
  readonly sourcePackageHash: `sha256:${string}`;
  readonly sourceType: "remote" | "local_import";
  readonly installedAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
  readonly localStatus: LocalStatus;
  readonly centralStorePath: string;
  readonly enabledTargets: readonly EnabledTarget[];
  readonly hasUpdate: boolean;
  readonly isScopeRestricted: boolean;
  readonly canUpdate: boolean;
}

export interface ToolConfig {
  readonly toolID: string;
  readonly displayName: string;
  readonly adapterStatus: AdapterStatus;
  readonly detectedPath?: string;
  readonly configuredPath?: string;
  readonly configPath?: string;
  readonly skillsPath: string;
  readonly enabled: boolean;
  readonly detectionMethod: DetectionMethod;
  readonly transformStrategy: string;
  readonly lastScannedAt?: ISODateTimeString;
}

export interface ProjectConfig {
  readonly projectID: string;
  readonly displayName: string;
  readonly projectPath: string;
  readonly skillsPath: string;
  readonly projectPathStatus?: "valid" | "missing" | "invalid" | "unwritable";
  readonly projectPathStatusReason?: string | null;
  readonly enabled: boolean;
  readonly createdAt: ISODateTimeString;
  readonly updatedAt: ISODateTimeString;
}

export interface ScanFinding {
  readonly id: string;
  readonly kind: ScanFindingKind;
  readonly skillID?: SkillID | null;
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly targetName: string;
  readonly targetPath: string;
  readonly relativePath: string;
  readonly checksum?: string | null;
  readonly canImport: boolean;
  readonly importDisplayName?: string | null;
  readonly importDescription?: string | null;
  readonly importVersion?: SemVerString | string | null;
  readonly message: string;
}

export interface ScanFindingCounts {
  readonly managed: number;
  readonly unmanaged: number;
  readonly conflict: number;
  readonly orphan: number;
}

export interface ScanTargetSummary {
  readonly id: string;
  readonly targetType: TargetType;
  readonly targetID: string;
  readonly targetName: string;
  readonly targetPath: string;
  readonly transformStrategy: string;
  readonly scannedAt: ISODateTimeString;
  readonly counts: ScanFindingCounts;
  readonly findings: readonly ScanFinding[];
  readonly lastError?: string | null;
}

export interface LocalBootstrapResponse {
  readonly installs: readonly LocalSkillInstall[];
  readonly tools: readonly ToolConfig[];
  readonly projects: readonly ProjectConfig[];
  readonly notifications: readonly LocalNotification[];
  readonly offlineEvents: readonly LocalEvent[];
  readonly pendingOfflineEventCount: number;
  readonly unreadLocalNotificationCount: number;
  readonly centralStorePath: string;
}

export interface ScanToolsRequest {
  readonly toolIDs?: readonly string[];
}

export interface SaveToolConfigRequest {
  readonly toolID: string;
  readonly name?: string;
  readonly configPath: string;
  readonly skillsPath: string;
  readonly enabled?: boolean;
}

export interface SaveProjectConfigRequest {
  readonly projectID?: string;
  readonly name: string;
  readonly projectPath: string;
  readonly skillsPath: string;
  readonly enabled?: boolean;
}

export interface ValidateTargetPathRequest {
  readonly targetPath: string;
}

export interface ValidateTargetPathResponse {
  readonly valid: boolean;
  readonly writable: boolean;
  readonly exists?: boolean;
  readonly canCreate?: boolean;
  readonly reason?: string;
}

export interface InstallSkillPackageRequest {
  readonly downloadTicket: DownloadTicketResponse;
}

export interface UpdateSkillPackageRequest {
  readonly downloadTicket: DownloadTicketResponse;
}

export interface ImportLocalSkillRequest {
  readonly input: {
    readonly targetType: TargetType;
    readonly targetID: string;
    readonly relativePath: string;
    readonly skillID: SkillID;
    readonly conflictStrategy: "rename" | "replace";
  };
}

export interface EnableSkillRequest {
  readonly skillId: SkillID;
  readonly version: SemVerString;
  readonly targetType: TargetType;
  readonly targetId: string;
  readonly preferredMode?: RequestedMode;
  readonly allowOverwrite?: boolean;
}

export interface DisableSkillRequest {
  readonly skillId: SkillID;
  readonly targetType: TargetType;
  readonly targetId: string;
}

export interface UninstallSkillRequest {
  readonly skillId: SkillID;
}

export interface UninstallSkillResponse {
  readonly skillID: SkillID;
  readonly removedCentralStorePath: boolean;
  readonly removedTargets: readonly EnabledTarget[];
  readonly failedTargets: readonly EnabledTarget[];
}

export interface MarkOfflineEventsSyncedRequest {
  readonly eventIds: readonly string[];
}

export interface MarkOfflineEventsSyncedResponse {
  readonly syncedEventIDs: readonly string[];
}

export interface ProjectDirectorySelection {
  readonly projectPath: string;
}

export interface DeleteToolConfigRequest {
  readonly toolID: string;
}

export interface DeleteProjectConfigRequest {
  readonly projectID: string;
}

export interface LocalCommandRequestMap {
  readonly get_local_bootstrap: undefined;
  readonly detect_tools: ScanToolsRequest;
  readonly save_tool_config: SaveToolConfigRequest;
  readonly delete_tool_config: DeleteToolConfigRequest;
  readonly save_project_config: SaveProjectConfigRequest;
  readonly delete_project_config: DeleteProjectConfigRequest;
  readonly validate_target_path: ValidateTargetPathRequest;
  readonly install_skill_package: InstallSkillPackageRequest;
  readonly update_skill_package: UpdateSkillPackageRequest;
  readonly import_local_skill: ImportLocalSkillRequest;
  readonly enable_skill: EnableSkillRequest;
  readonly disable_skill: DisableSkillRequest;
  readonly uninstall_skill: UninstallSkillRequest;
  readonly upsert_local_notifications: {
    readonly notifications: readonly LocalNotification[];
  };
  readonly mark_local_notifications_read: {
    readonly notificationIds: readonly string[];
    readonly all: boolean;
  };
  readonly mark_offline_events_synced: MarkOfflineEventsSyncedRequest;
  readonly scan_local_targets: undefined;
  readonly list_local_installs: undefined;
  readonly pick_project_directory: undefined;
}

export interface LocalCommandResponseMap {
  readonly get_local_bootstrap: LocalBootstrapResponse;
  readonly detect_tools: readonly ToolConfig[];
  readonly save_tool_config: ToolConfig;
  readonly delete_tool_config: void;
  readonly save_project_config: ProjectConfig;
  readonly delete_project_config: void;
  readonly validate_target_path: ValidateTargetPathResponse;
  readonly install_skill_package: LocalSkillInstall;
  readonly update_skill_package: LocalSkillInstall;
  readonly import_local_skill: LocalSkillInstall;
  readonly enable_skill: EnabledTarget;
  readonly disable_skill: EnabledTarget;
  readonly uninstall_skill: UninstallSkillResponse;
  readonly upsert_local_notifications: void;
  readonly mark_local_notifications_read: void;
  readonly mark_offline_events_synced: MarkOfflineEventsSyncedResponse;
  readonly scan_local_targets: readonly ScanTargetSummary[];
  readonly list_local_installs: readonly LocalSkillInstall[];
  readonly pick_project_directory: ProjectDirectorySelection | null;
}

export type LocalCommandName = keyof LocalCommandRequestMap;

export const P1_LOCAL_COMMANDS = {
  getLocalBootstrap: "get_local_bootstrap",
  detectTools: "detect_tools",
  saveToolConfig: "save_tool_config",
  deleteToolConfig: "delete_tool_config",
  saveProjectConfig: "save_project_config",
  deleteProjectConfig: "delete_project_config",
  validateTargetPath: "validate_target_path",
  installSkillPackage: "install_skill_package",
  updateSkillPackage: "update_skill_package",
  importLocalSkill: "import_local_skill",
  enableSkill: "enable_skill",
  disableSkill: "disable_skill",
  uninstallSkill: "uninstall_skill",
  upsertLocalNotifications: "upsert_local_notifications",
  markLocalNotificationsRead: "mark_local_notifications_read",
  markOfflineEventsSynced: "mark_offline_events_synced",
  scanLocalTargets: "scan_local_targets",
  listLocalInstalls: "list_local_installs",
  pickProjectDirectory: "pick_project_directory",
} as const satisfies Record<string, LocalCommandName>;

export const LOCAL_COMMAND_NAMES = Object.values(P1_LOCAL_COMMANDS) as readonly LocalCommandName[];

export const P1_API_ROUTES = {
  authLogin: "/auth/login",
  authLogout: "/auth/logout",
  authChangePassword: "/auth/change-password",
  desktopBootstrap: "/desktop/bootstrap",
  desktopLocalEvents: "/desktop/local-events",
  clientUpdatesCheck: "/client-updates/check",
  clientUpdateDownloadTicket: "/client-updates/releases/:releaseID/download-ticket",
  clientUpdateDownload: "/client-updates/releases/:releaseID/download",
  clientUpdateEvents: "/client-updates/events",
  skills: "/skills",
  skillLeaderboards: "/skills/leaderboards",
  skillDetail: "/skills/:skillID",
  skillDownloadTicket: "/skills/:skillID/download-ticket",
  skillStar: "/skills/:skillID/star",
  skillPackageDownload: "/skill-packages/:packageRef/download",
  notifications: "/notifications",
  notificationsMarkRead: "/notifications/mark-read",
  adminDepartments: "/admin/departments",
  adminDepartmentDetail: "/admin/departments/:departmentID",
  adminUsers: "/admin/users",
  adminUserDetail: "/admin/users/:phoneNumber",
  adminUserPassword: "/admin/users/:phoneNumber/password",
  adminUserFreeze: "/admin/users/:phoneNumber/freeze",
  adminUserUnfreeze: "/admin/users/:phoneNumber/unfreeze",
  adminSkills: "/admin/skills",
  adminSkillDelist: "/admin/skills/:skillID/delist",
  adminSkillRelist: "/admin/skills/:skillID/relist",
  adminSkillArchive: "/admin/skills/:skillID",
  adminClientUpdateReleases: "/admin/client-updates/releases",
  adminClientUpdateReleaseDetail: "/admin/client-updates/releases/:releaseID",
  adminClientUpdateArtifact: "/admin/client-updates/releases/:releaseID/artifact",
  adminClientUpdatePublish: "/admin/client-updates/releases/:releaseID/publish",
  adminClientUpdateRollout: "/admin/client-updates/releases/:releaseID/rollout",
  adminClientUpdatePause: "/admin/client-updates/releases/:releaseID/pause",
  adminClientUpdateYank: "/admin/client-updates/releases/:releaseID/yank",
  adminReviews: "/admin/reviews",
  adminReviewDetail: "/admin/reviews/:reviewID",
  adminReviewFiles: "/admin/reviews/:reviewID/files",
  adminReviewFileContent: "/admin/reviews/:reviewID/file-content",
  adminReviewClaim: "/admin/reviews/:reviewID/claim",
  adminReviewPassPrecheck: "/admin/reviews/:reviewID/pass-precheck",
  adminReviewApprove: "/admin/reviews/:reviewID/approve",
  adminReviewReturn: "/admin/reviews/:reviewID/return",
  adminReviewReject: "/admin/reviews/:reviewID/reject",
  publisherSkills: "/publisher/skills",
  publisherSkillDelist: "/publisher/skills/:skillID/delist",
  publisherSkillRelist: "/publisher/skills/:skillID/relist",
  publisherSkillArchive: "/publisher/skills/:skillID/archive",
  publisherSubmissions: "/publisher/submissions",
  publisherSubmissionDetail: "/publisher/submissions/:submissionID",
  publisherSubmissionFiles: "/publisher/submissions/:submissionID/files",
  publisherSubmissionFileContent: "/publisher/submissions/:submissionID/file-content",
  publisherSubmissionWithdraw: "/publisher/submissions/:submissionID/withdraw",
} as const;

export type P1ApiRouteName = keyof typeof P1_API_ROUTES;

export type ErrorCode = ApiErrorCode;
export type MenuPermission = NavigationItem;
export type PageQuery = PaginationQuery;
export type PageResponse<TItem> = PaginatedResponse<TItem>;
export type UserSummary = CurrentUser;
export type BootstrapContextDto = DesktopBootstrapResponse;
export type NotificationDto = Notification;
export type LocalEventDto = LocalEvent;
export type DepartmentNodeDto = DepartmentNode;
export type AdminUserDto = AdminUser;
export type AdminSkillDto = AdminSkill;
export type ClientUpdateReleaseSummaryDto = ClientUpdateReleaseSummary;
export type ClientUpdateCheckRequestDto = ClientUpdateCheckRequest;
export type ClientUpdateCheckResponseDto = ClientUpdateCheckResponse;
export type ClientUpdateDownloadTicketResponseDto = ClientUpdateDownloadTicketResponse;
export type ReportClientUpdateEventRequestDto = ReportClientUpdateEventRequest;
export type ReportClientUpdateEventResponseDto = ReportClientUpdateEventResponse;
export type CreateClientUpdateReleaseRequestDto = CreateClientUpdateReleaseRequest;
export type RegisterClientUpdateArtifactRequestDto = RegisterClientUpdateArtifactRequest;
export type PublishClientUpdateReleaseRequestDto = PublishClientUpdateReleaseRequest;
export type UpdateClientUpdateRolloutRequestDto = UpdateClientUpdateRolloutRequest;
export type ClientUpdateReleaseActionRequestDto = ClientUpdateReleaseActionRequest;
export type SkillLeaderboardsResponseDto = SkillLeaderboardsResponse;
export type ReviewItemDto = ReviewItem;
export type ReviewHistoryDto = ReviewHistory;
export type ReviewPrecheckItemDto = ReviewPrecheckItem;
export type ReviewDetailDto = ReviewDetail;
export type PackageFileEntryDto = PackageFileEntry;
export type PackageFileContentDto = PackageFileContent;
export type PublisherSkillSummaryDto = PublisherSkillSummary;
export type PublisherSubmissionDetailDto = PublisherSubmissionDetail;

export function pageOf<TItem>(
  items: readonly TItem[],
  page: number,
  pageSize: number,
  total = items.length
): PageResponse<TItem> {
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total
  };
}
