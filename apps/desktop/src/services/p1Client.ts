import type {
  AdminSkill,
  AdminUser,
  BootstrapContext,
  DepartmentNode,
  DownloadTicket,
  LocalEvent,
  LocalNotification,
  MarketFilters,
  MenuPermission,
  PageID,
  ReviewDetail,
  ReviewItem,
  SkillSummary
} from "../domain/p1";

const API_BASE_STORAGE_KEY = "enterprise-agent-hub:p1-api-base";
const TOKEN_STORAGE_KEY = "enterprise-agent-hub:p1-token";
const DEFAULT_API_BASE = import.meta.env.VITE_DESKTOP_API_BASE_URL ?? "http://127.0.0.1:3000";

interface ApiPage<T> {
  items: T[];
}

interface ApiLoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
  menuPermissions: MenuPermission[];
}

interface ApiBootstrapResponse extends Omit<BootstrapContext, "counts"> {
  counts: Omit<BootstrapContext["counts"], "enabledCount"> & { enabledCount?: number };
}

interface ApiNotification {
  notificationID: string;
  type: LocalNotification["type"];
  title: string;
  summary: string;
  objectType?: "skill" | "tool" | "project" | "connection";
  objectID?: string;
  createdAt: string;
  read: boolean;
}

type ApiSkill = Omit<
  SkillSummary,
  "localVersion" | "publishedAt" | "starred" | "isScopeRestricted" | "hasLocalHashDrift" | "enabledTargets" | "lastEnabledAt"
> &
  Partial<Pick<SkillSummary, "localVersion" | "publishedAt" | "starred" | "isScopeRestricted" | "hasLocalHashDrift" | "enabledTargets" | "lastEnabledAt">>;

export class P1ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly retryable: boolean;

  constructor(input: { message: string; status: number; code?: string; retryable?: boolean }) {
    super(input.message);
    this.name = "P1ApiError";
    this.status = input.status;
    this.code = input.code;
    this.retryable = input.retryable ?? false;
  }
}

function normalizeBaseURL(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("服务地址不能为空");
  }
  return trimmed.replace(/\/+$/, "");
}

function getAPIBase(): string {
  return normalizeBaseURL(window.localStorage.getItem(API_BASE_STORAGE_KEY) ?? DEFAULT_API_BASE);
}

function setAPIBase(value: string): void {
  window.localStorage.setItem(API_BASE_STORAGE_KEY, normalizeBaseURL(value));
}

function resolveAPIURL(value: string): string {
  return new URL(value, `${getAPIBase()}/`).toString();
}

function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function clearToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getAPIBase()}${path}`, {
    credentials: "include",
    ...init,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new P1ApiError({
      status: response.status,
      code: errorBody?.error?.code,
      message: errorBody?.error?.message ?? `${response.status} ${response.statusText}`,
      retryable: errorBody?.error?.retryable ?? false
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function targetPageForNotification(notification: ApiNotification): PageID {
  if (notification.objectType === "skill") return "market";
  if (notification.objectType === "tool") return "tools";
  if (notification.objectType === "project") return "projects";
  return "notifications";
}

function normalizeNotification(notification: ApiNotification): LocalNotification {
  return {
    notificationID: notification.notificationID,
    type: notification.type,
    title: notification.title,
    summary: notification.summary,
    relatedSkillID: notification.objectType === "skill" ? notification.objectID ?? null : null,
    targetPage: targetPageForNotification(notification),
    occurredAt: notification.createdAt,
    unread: !notification.read,
    source: "server"
  };
}

function normalizeBootstrap(response: ApiBootstrapResponse): BootstrapContext {
  return {
    ...response,
    counts: {
      installedCount: response.counts.installedCount,
      enabledCount: response.counts.enabledCount ?? 0,
      updateAvailableCount: response.counts.updateAvailableCount,
      unreadNotificationCount: response.counts.unreadNotificationCount
    }
  };
}

function normalizeSkill(skill: ApiSkill): SkillSummary {
  return {
    ...skill,
    localVersion: skill.localVersion ?? null,
    publishedAt: skill.publishedAt ?? skill.currentVersionUpdatedAt,
    tags: skill.tags ?? [],
    category: skill.category ?? "uncategorized",
    riskLevel: skill.riskLevel ?? "unknown",
    starred: skill.starred ?? false,
    isScopeRestricted: skill.isScopeRestricted ?? skill.cannotInstallReason === "scope_restricted",
    hasLocalHashDrift: skill.hasLocalHashDrift ?? false,
    enabledTargets: skill.enabledTargets ?? [],
    lastEnabledAt: skill.lastEnabledAt ?? null,
    canUpdate: skill.canUpdate ?? false
  };
}

function filtersToQuery(filters: MarketFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.department !== "all") params.set("departmentID", filters.department);
  if (filters.compatibleTool !== "all") params.set("compatibleTool", filters.compatibleTool);
  if (filters.accessScope !== "include_public") params.set("accessScope", filters.accessScope);
  if (filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.installed !== "all") params.set("installed", String(filters.installed === "installed"));
  if (filters.enabled !== "all") params.set("enabled", String(filters.enabled === "enabled"));
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

export interface P1Client {
  hasStoredSession(): boolean;
  clearStoredSession(): void;
  currentAPIBase(): string;
  login(input: { username: string; password: string; serverURL: string }): Promise<BootstrapContext>;
  logout(): Promise<void>;
  bootstrap(): Promise<BootstrapContext>;
  listSkills(filters: MarketFilters): Promise<SkillSummary[]>;
  getSkill(skillID: string): Promise<SkillSummary>;
  downloadTicket(skill: SkillSummary, purpose: "install" | "update"): Promise<DownloadTicket>;
  star(skillID: string, starred: boolean): Promise<{ skillID: string; starred: boolean; starCount: number }>;
  listNotifications(unreadOnly?: boolean): Promise<LocalNotification[]>;
  markNotificationsRead(notificationIDs: string[] | "all"): Promise<{ unreadNotificationCount: number }>;
  syncLocalEvents(events: LocalEvent[]): Promise<{ acceptedEventIDs: string[]; rejectedEvents: LocalEvent[]; serverStateChanged: boolean }>;
  listDepartments(): Promise<DepartmentNode[]>;
  createDepartment(input: { parentDepartmentID: string; name: string }): Promise<DepartmentNode[]>;
  updateDepartment(departmentID: string, input: { name: string }): Promise<DepartmentNode[]>;
  deleteDepartment(departmentID: string): Promise<void>;
  listAdminUsers(): Promise<AdminUser[]>;
  createAdminUser(input: { username: string; password: string; displayName: string; departmentID: string; role: "normal_user" | "admin"; adminLevel: number | null }): Promise<AdminUser[]>;
  updateAdminUser(targetUserID: string, input: { displayName?: string; departmentID?: string; role?: "normal_user" | "admin"; adminLevel?: number | null }): Promise<AdminUser[]>;
  freezeAdminUser(targetUserID: string): Promise<AdminUser[]>;
  unfreezeAdminUser(targetUserID: string): Promise<AdminUser[]>;
  deleteAdminUser(targetUserID: string): Promise<void>;
  listAdminSkills(): Promise<AdminSkill[]>;
  delistAdminSkill(skillID: string): Promise<AdminSkill[]>;
  relistAdminSkill(skillID: string): Promise<AdminSkill[]>;
  archiveAdminSkill(skillID: string): Promise<void>;
  listReviews(): Promise<ReviewItem[]>;
  getReview(reviewID: string): Promise<ReviewDetail>;
}

export const p1Client: P1Client = {
  hasStoredSession() {
    return getToken() !== null;
  },

  clearStoredSession() {
    clearToken();
  },

  currentAPIBase() {
    return getAPIBase();
  },

  async login(input) {
    if (input.username.trim().length === 0 || input.password.trim().length === 0) {
      throw new Error("账号或密码不能为空");
    }

    setAPIBase(input.serverURL);
    const response = await requestJSON<ApiLoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: input.username, password: input.password })
    });
    setToken(response.accessToken);
    return this.bootstrap();
  },

  async logout() {
    try {
      if (getToken()) {
        await requestJSON<{ ok: true }>("/auth/logout", { method: "POST" });
      }
    } finally {
      clearToken();
    }
  },

  async bootstrap() {
    return normalizeBootstrap(await requestJSON<ApiBootstrapResponse>("/desktop/bootstrap"));
  },

  async listSkills(filters) {
    const response = await requestJSON<ApiPage<ApiSkill>>(`/skills?${filtersToQuery(filters).toString()}`);
    return response.items.map(normalizeSkill);
  },

  async getSkill(skillID) {
    return normalizeSkill(await requestJSON<ApiSkill>(`/skills/${encodeURIComponent(skillID)}`));
  },

  async downloadTicket(skill, purpose) {
    const response = await requestJSON<DownloadTicket>(`/skills/${encodeURIComponent(skill.skillID)}/download-ticket`, {
      method: "POST",
      body: JSON.stringify({
        purpose,
        targetVersion: skill.version,
        localVersion: skill.localVersion
      })
    });
    return {
      ...response,
      packageURL: resolveAPIURL(response.packageURL)
    };
  },

  async star(skillID, starred) {
    return requestJSON(`/skills/${encodeURIComponent(skillID)}/star`, { method: starred ? "POST" : "DELETE" });
  },

  async listNotifications(unreadOnly = false) {
    const response = await requestJSON<ApiPage<ApiNotification>>(`/notifications?unreadOnly=${String(unreadOnly)}`);
    return response.items.map(normalizeNotification);
  },

  async markNotificationsRead(notificationIDs) {
    return requestJSON<{ unreadNotificationCount: number }>("/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ notificationIDs: notificationIDs === "all" ? [] : notificationIDs, all: notificationIDs === "all" })
    });
  },

  async syncLocalEvents(events) {
    return requestJSON("/desktop/local-events", {
      method: "POST",
      body: JSON.stringify({ deviceID: "desktop_p1_default", events })
    });
  },

  async listDepartments() {
    return requestJSON<DepartmentNode[]>("/admin/departments");
  },

  async createDepartment(input) {
    return requestJSON<DepartmentNode[]>("/admin/departments", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async updateDepartment(departmentID, input) {
    return requestJSON<DepartmentNode[]>(`/admin/departments/${encodeURIComponent(departmentID)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  async deleteDepartment(departmentID) {
    await requestJSON<{ ok: true }>(`/admin/departments/${encodeURIComponent(departmentID)}`, {
      method: "DELETE"
    });
  },

  async listAdminUsers() {
    return requestJSON<AdminUser[]>("/admin/users");
  },

  async createAdminUser(input) {
    return requestJSON<AdminUser[]>("/admin/users", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async updateAdminUser(targetUserID, input) {
    return requestJSON<AdminUser[]>(`/admin/users/${encodeURIComponent(targetUserID)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  async freezeAdminUser(targetUserID) {
    return requestJSON<AdminUser[]>(`/admin/users/${encodeURIComponent(targetUserID)}/freeze`, {
      method: "POST"
    });
  },

  async unfreezeAdminUser(targetUserID) {
    return requestJSON<AdminUser[]>(`/admin/users/${encodeURIComponent(targetUserID)}/unfreeze`, {
      method: "POST"
    });
  },

  async deleteAdminUser(targetUserID) {
    await requestJSON<{ ok: true }>(`/admin/users/${encodeURIComponent(targetUserID)}`, {
      method: "DELETE"
    });
  },

  async listAdminSkills() {
    return requestJSON<AdminSkill[]>("/admin/skills");
  },

  async delistAdminSkill(skillID) {
    return requestJSON<AdminSkill[]>(`/admin/skills/${encodeURIComponent(skillID)}/delist`, {
      method: "POST"
    });
  },

  async relistAdminSkill(skillID) {
    return requestJSON<AdminSkill[]>(`/admin/skills/${encodeURIComponent(skillID)}/relist`, {
      method: "POST"
    });
  },

  async archiveAdminSkill(skillID) {
    await requestJSON<{ ok: true }>(`/admin/skills/${encodeURIComponent(skillID)}`, {
      method: "DELETE"
    });
  },

  async listReviews() {
    return requestJSON<ReviewItem[]>("/admin/reviews");
  },

  async getReview(reviewID) {
    return requestJSON<ReviewDetail>(`/admin/reviews/${encodeURIComponent(reviewID)}`);
  }
};
