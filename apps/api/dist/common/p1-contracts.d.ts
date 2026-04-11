export type ErrorCode = 'unauthenticated' | 'permission_denied' | 'skill_not_found' | 'skill_delisted' | 'scope_restricted' | 'package_unavailable' | 'package_too_large' | 'package_file_count_exceeded' | 'hash_mismatch' | 'conversion_failed' | 'server_unavailable';
export type SkillStatus = 'published' | 'delisted' | 'archived';
export type VisibilityLevel = 'private' | 'summary_visible' | 'detail_visible' | 'public_installable';
export type DetailAccess = 'none' | 'summary' | 'full';
export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type InstallState = 'not_installed' | 'installed' | 'enabled' | 'update_available' | 'blocked';
export type ConnectionStatus = 'connected' | 'connecting' | 'offline' | 'failed';
export type TargetType = 'tool' | 'project';
export type RequestedMode = 'symlink' | 'copy';
export type ResolvedMode = 'symlink' | 'copy';
export type NotificationType = 'skill_update_available' | 'skill_scope_restricted' | 'local_copy_blocked' | 'connection_restored' | 'connection_failed' | 'target_path_invalid' | 'install_result' | 'update_result' | 'uninstall_result' | 'enable_result' | 'disable_result';
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
    versions?: Array<{
        version: string;
        publishedAt: string;
    }>;
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
export declare function pageOf<T>(items: T[], page: number, pageSize: number, total?: number): PageResponse<T>;
export declare function errorBody(code: ErrorCode, message: string, retryable?: boolean, detail?: unknown): ApiErrorBody;
