import type {
  BootstrapContext,
  DownloadTicket,
  LocalNotification,
  MarketFilters,
  MenuPermission,
  PageID,
  SkillSummary
} from "../../domain/p1.ts";
import { P1ApiError, getToken, resolveAPIURL } from "./core.ts";

export interface ApiPage<T> {
  items: T[];
}

export interface ApiAuthenticatedLoginResponse {
  status: "authenticated";
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  user: BootstrapContext["user"];
  menuPermissions: MenuPermission[];
}

export interface ApiPasswordChangeRequiredLoginResponse {
  status: "password_change_required";
  passwordChangeToken: string;
  expiresAt: string;
  user: BootstrapContext["user"];
}

export type ApiLoginResponse = ApiAuthenticatedLoginResponse | ApiPasswordChangeRequiredLoginResponse;

export interface ApiBootstrapResponse extends Omit<BootstrapContext, "counts"> {
  user: BootstrapContext["user"] & { displayName?: string; userID?: string };
  counts: Omit<BootstrapContext["counts"], "enabledCount"> & { enabledCount?: number };
}

export interface ApiNotification {
  notificationID: string;
  type: LocalNotification["type"];
  title: string;
  summary: string;
  objectType?: LocalNotification["objectType"];
  objectID?: string;
  action?: string;
  createdAt: string;
  read: boolean;
}

export type ApiSkill = Omit<
  SkillSummary,
  "localVersion" | "publishedAt" | "starred" | "isScopeRestricted" | "hasLocalHashDrift" | "enabledTargets" | "lastEnabledAt"
> &
  Partial<Pick<SkillSummary, "localVersion" | "publishedAt" | "starred" | "isScopeRestricted" | "hasLocalHashDrift" | "enabledTargets" | "lastEnabledAt">>;

function targetPageForNotification(notification: ApiNotification): PageID {
  if (notification.objectType === "skill") return "market";
  if (notification.objectType === "review") return "review";
  if (notification.objectType === "publisher_submission") return "publisher";
  if (notification.objectType === "tool") return "target_management";
  if (notification.objectType === "project") return "target_management";
  return "home";
}

export function normalizeNotification(notification: ApiNotification): LocalNotification {
  return {
    notificationID: notification.notificationID,
    type: notification.type,
    title: notification.title,
    summary: notification.summary,
    objectType: notification.objectType,
    objectID: notification.objectID,
    action: notification.action,
    relatedSkillID: notification.objectType === "skill" ? notification.objectID ?? null : null,
    targetPage: targetPageForNotification(notification),
    occurredAt: notification.createdAt,
    unread: !notification.read,
    source: "server"
  };
}

export function normalizeBootstrap(response: ApiBootstrapResponse): BootstrapContext {
  const username = response.user.username?.trim() || response.user.displayName?.trim() || "本地模式";
  return {
    ...response,
    user: {
      username,
      phoneNumber: response.user.phoneNumber?.trim() ?? "",
      role: response.user.role,
      adminLevel: response.user.adminLevel,
      departmentID: response.user.departmentID,
      departmentName: response.user.departmentName,
      locale: response.user.locale
    },
    counts: {
      installedCount: response.counts.installedCount,
      enabledCount: response.counts.enabledCount ?? 0,
      updateAvailableCount: response.counts.updateAvailableCount,
      unreadNotificationCount: response.counts.unreadNotificationCount
    }
  };
}

export function normalizeSkill(skill: ApiSkill): SkillSummary {
  return {
    ...skill,
    localVersion: skill.localVersion ?? null,
    localSourceType: null,
    publishedAt: skill.publishedAt ?? skill.currentVersionUpdatedAt,
    tags: skill.tags ?? [],
    category: skill.category ?? "其他",
    riskLevel: skill.riskLevel ?? "unknown",
    starred: skill.starred ?? false,
    isScopeRestricted: skill.isScopeRestricted ?? skill.cannotInstallReason === "scope_restricted",
    hasLocalHashDrift: skill.hasLocalHashDrift ?? false,
    enabledTargets: skill.enabledTargets ?? [],
    lastEnabledAt: skill.lastEnabledAt ?? null,
    canUpdate: skill.canUpdate ?? false
  };
}

function sinceISOString(within: MarketFilters["publishedWithin"] | MarketFilters["updatedWithin"], now: Date): string | null {
  const days = within === "7d" ? 7 : within === "30d" ? 30 : within === "90d" ? 90 : 0;
  if (days === 0) {
    return null;
  }
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function buildSkillListQuery(filters: MarketFilters, now = new Date()): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.department !== "all") params.set("departmentID", filters.department);
  if (filters.compatibleTool !== "all") params.set("compatibleTool", filters.compatibleTool);
  if (filters.accessScope !== "include_public") params.set("accessScope", filters.accessScope);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  const publishedSince = sinceISOString(filters.publishedWithin, now);
  if (publishedSince) params.set("publishedSince", publishedSince);
  const updatedSince = sinceISOString(filters.updatedWithin, now);
  if (updatedSince) params.set("updatedSince", updatedSince);
  if (filters.sort) params.set("sort", filters.sort);
  return params;
}

export function isApiError(error: unknown): error is P1ApiError {
  return error instanceof P1ApiError;
}

export function isUnauthenticatedError(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.code === "unauthenticated");
}

export function isPermissionError(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.code === "permission_denied");
}

export function isConnectionUnavailableError(error: unknown): boolean {
  return isApiError(error) && error.status === 0;
}

export function isServerUnavailableError(error: unknown): boolean {
  return isApiError(error) && error.status >= 500;
}

export async function downloadAuthenticatedFile(url: string, suggestedName = "package.zip"): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const response = await fetch(url.startsWith("http") ? url : resolveAPIURL(url), { headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new P1ApiError({
      status: response.status,
      code: errorBody?.error?.code,
      message: errorBody?.error?.message ?? `${response.status} ${response.statusText}`,
      retryable: errorBody?.error?.retryable ?? false
    });
  }
  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const fileNameMatch = contentDisposition.match(/filename=\"([^\"]+)\"/);
  const fileName = fileNameMatch?.[1] ?? suggestedName;
  const objectURL = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectURL;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectURL);
}

export type DownloadTicketInput = Pick<DownloadTicket, "skillID" | "version" | "packageURL" | "packageHash" | "packageSize" | "packageFileCount" | "expiresAt">;
