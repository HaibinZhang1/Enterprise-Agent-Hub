import type { LocalNotification } from "../../domain/p1.ts";
import type { ClientUpdateCheckResponse, ClientUpdateStatus } from "../../services/p1Client.ts";

export const CLIENT_UPDATE_CACHE_STORAGE_KEY = "enterprise-agent-hub:client-update-cache";
export const CLIENT_UPDATE_CACHE_MAX_AGE_MS = 30 * 60 * 1000;

export interface ClientUpdateCache {
  channel: string;
  currentVersion: string;
  latestVersion: string;
  releaseID: string | null;
  updateType: "optional" | "mandatory" | "unsupported" | null;
  dismissedVersion: string | null;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  downloadedPath: string | null;
  packageName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  publishedAt: string | null;
  releaseNotes: string;
  releaseURL: string | null;
  downloadTicketRequired: boolean;
}

export interface AppUpdateState {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseID: string | null;
  status: ClientUpdateStatus;
  summary: string;
  releaseNotes: string;
  highlights: string[];
  occurredAt: string;
  unread: boolean;
  releaseURL: string | null;
  actionLabel: "去更新" | "查看更新" | "重新检查";
  publishedAt: string | null;
  sizeBytes: number | null;
  packageName: string | null;
  downloadTicketRequired: boolean;
  mandatory: boolean;
  blocking: boolean;
  reasonBadge: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  checking: boolean;
}

export interface ServerAppUpdateNotification {
  notificationID: string;
  releaseID: string | null;
  latestVersion: string;
  unread: boolean;
  occurredAt: string;
  title: string;
  summary: string;
  status: ClientUpdateStatus;
  releaseNotes: string;
  releaseURL: string | null;
  source: LocalNotification["source"];
}

type MaybeClientUpdateNotification = LocalNotification & Partial<{
  releaseID: string;
  latestVersion: string;
  updateStatus: ClientUpdateStatus;
  mandatory: boolean;
  releaseNotes: string;
  releaseURL: string | null;
}>;

const SEMVER_PATTERN = /\b\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?\b/i;
const RELEASE_ID_PATTERN = /\brel[_-][0-9a-z-]+\b/i;

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function coerceStatus(value: unknown): ClientUpdateStatus | null {
  if (value === "up_to_date" || value === "update_available" || value === "mandatory_update" || value === "unsupported_version") {
    return value;
  }
  return null;
}

function parseVersion(input: string): string | null {
  return input.match(SEMVER_PATTERN)?.[0] ?? null;
}

function parseReleaseID(input: string): string | null {
  return input.match(RELEASE_ID_PATTERN)?.[0] ?? null;
}

function isBlockingStatus(status: ClientUpdateStatus): boolean {
  return status === "mandatory_update" || status === "unsupported_version";
}

function buildSummary(input: {
  status: ClientUpdateStatus;
  latestVersion: string;
  currentVersion: string;
  releaseNotes: string;
}): string {
  const trimmedNotes = input.releaseNotes.trim();
  if (trimmedNotes) {
    return trimmedNotes.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? trimmedNotes;
  }
  if (input.status === "unsupported_version") {
    return `当前版本 ${input.currentVersion} 已低于最低支持版本，请先升级到 ${input.latestVersion}。`;
  }
  if (input.status === "mandatory_update") {
    return `必须先升级到 ${input.latestVersion}，才能继续远端写入操作。`;
  }
  return `发现可用更新 ${input.latestVersion}，升级将通过完整安装包完成。`;
}

function buildHighlights(releaseNotes: string, summary: string): string[] {
  const lines = releaseNotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 0) {
    return lines.slice(0, 4);
  }
  return [summary];
}

function cacheToStatus(updateType: ClientUpdateCache["updateType"]): ClientUpdateStatus {
  if (updateType === "mandatory") return "mandatory_update";
  if (updateType === "unsupported") return "unsupported_version";
  if (updateType === "optional") return "update_available";
  return "up_to_date";
}

function asAppUpdateSource(currentVersion: string, cache: ClientUpdateCache | null): {
  status: ClientUpdateStatus;
  latestVersion: string;
  releaseID: string | null;
  releaseNotes: string;
  releaseURL: string | null;
  occurredAt: string;
  publishedAt: string | null;
  sizeBytes: number | null;
  packageName: string | null;
  downloadTicketRequired: boolean;
  lastCheckedAt: string | null;
} | null {
  if (!cache || cache.currentVersion !== currentVersion) return null;
  const status = cacheToStatus(cache.updateType);
  if (status === "up_to_date" || !cache.latestVersion) return null;
  return {
    status,
    latestVersion: cache.latestVersion,
    releaseID: cache.releaseID,
    releaseNotes: cache.releaseNotes,
    releaseURL: cache.releaseURL,
    occurredAt: cache.publishedAt ?? cache.lastCheckedAt ?? new Date(0).toISOString(),
    publishedAt: cache.publishedAt,
    sizeBytes: cache.sizeBytes,
    packageName: cache.packageName,
    downloadTicketRequired: cache.downloadTicketRequired,
    lastCheckedAt: cache.lastCheckedAt
  };
}

export function defaultAppUpdateState(currentVersion: string): AppUpdateState {
  return {
    available: false,
    currentVersion,
    latestVersion: currentVersion,
    releaseID: null,
    status: "up_to_date",
    summary: "当前已是最新版本",
    releaseNotes: "",
    highlights: [],
    occurredAt: new Date(0).toISOString(),
    unread: false,
    releaseURL: null,
    actionLabel: "重新检查",
    publishedAt: null,
    sizeBytes: null,
    packageName: null,
    downloadTicketRequired: false,
    mandatory: false,
    blocking: false,
    reasonBadge: null,
    lastCheckedAt: null,
    lastError: null,
    checking: false
  };
}

export function readClientUpdateCache(): ClientUpdateCache | null {
  if (!isStorageAvailable()) return null;
  return parseJSON<ClientUpdateCache>(window.localStorage.getItem(CLIENT_UPDATE_CACHE_STORAGE_KEY));
}

export function writeClientUpdateCache(cache: ClientUpdateCache | null): void {
  if (!isStorageAvailable()) return;
  if (!cache) {
    window.localStorage.removeItem(CLIENT_UPDATE_CACHE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(CLIENT_UPDATE_CACHE_STORAGE_KEY, JSON.stringify(cache));
}

export function shouldUseCachedClientUpdate(cache: ClientUpdateCache | null, currentVersion: string, now = Date.now()): boolean {
  if (!cache || cache.currentVersion !== currentVersion || !cache.lastCheckedAt) return false;
  const checkedAt = Date.parse(cache.lastCheckedAt);
  if (Number.isNaN(checkedAt)) return false;
  return now - checkedAt <= CLIENT_UPDATE_CACHE_MAX_AGE_MS;
}

export function cacheClientUpdateCheck(
  result: ClientUpdateCheckResponse,
  previousCache: ClientUpdateCache | null
): ClientUpdateCache {
  const nextDismissedVersion =
    previousCache?.releaseID === result.releaseID && previousCache.dismissedVersion === result.latestVersion
      ? previousCache.dismissedVersion
      : null;
  return {
    channel: result.channel,
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion,
    releaseID: result.releaseID,
    updateType: result.status === "mandatory_update" ? "mandatory" : result.status === "unsupported_version" ? "unsupported" : result.status === "update_available" ? "optional" : null,
    dismissedVersion: nextDismissedVersion,
    lastCheckedAt: result.lastCheckedAt,
    lastErrorCode: null,
    downloadedPath: previousCache?.downloadedPath ?? null,
    packageName: result.packageName,
    sizeBytes: result.sizeBytes,
    sha256: result.sha256,
    publishedAt: result.publishedAt,
    releaseNotes: result.releaseNotes,
    releaseURL: result.releaseURL,
    downloadTicketRequired: result.downloadTicketRequired
  };
}

export function dismissOptionalClientUpdate(cache: ClientUpdateCache | null, appUpdate: Pick<AppUpdateState, "latestVersion" | "releaseID" | "blocking" | "available">): ClientUpdateCache | null {
  if (!cache || !appUpdate.available || appUpdate.blocking) return cache;
  return {
    ...cache,
    dismissedVersion: appUpdate.latestVersion
  };
}

export function extractServerAppUpdateNotification(notification: LocalNotification): ServerAppUpdateNotification | null {
  const extra = notification as MaybeClientUpdateNotification;
  const type = String(notification.type ?? "").toLowerCase();
  if (type === "skill_update_available") return null;

  const text = `${notification.title} ${notification.summary}`;
  const explicitStatus = coerceStatus(extra.updateStatus ?? notification.type);
  const latestVersion = typeof extra.latestVersion === "string" && extra.latestVersion.trim() ? extra.latestVersion : parseVersion(text);
  const releaseID = typeof extra.releaseID === "string" && extra.releaseID.trim() ? extra.releaseID : parseReleaseID(text);
  const looksLikeAppUpdate =
    explicitStatus !== null ||
    extra.mandatory === true ||
    Boolean(latestVersion && /软件更新|客户端更新|app update|client update/i.test(text));

  if (!looksLikeAppUpdate || !latestVersion) {
    return null;
  }

  return {
    notificationID: notification.notificationID,
    releaseID,
    latestVersion,
    unread: notification.unread,
    occurredAt: notification.occurredAt,
    title: notification.title,
    summary: notification.summary,
    status: explicitStatus ?? (extra.mandatory ? "mandatory_update" : "update_available"),
    releaseNotes: typeof extra.releaseNotes === "string" ? extra.releaseNotes : notification.summary,
    releaseURL: typeof extra.releaseURL === "string" ? extra.releaseURL : null,
    source: notification.source
  };
}

function matchesUpdateIdentity(
  left: Pick<ServerAppUpdateNotification, "releaseID" | "latestVersion">,
  right: Pick<ServerAppUpdateNotification, "releaseID" | "latestVersion">
): boolean {
  return left.latestVersion === right.latestVersion && left.releaseID === right.releaseID;
}

export function deriveAppUpdateState(input: {
  currentVersion: string;
  cache: ClientUpdateCache | null;
  notifications: LocalNotification[];
  lastError?: string | null;
  checking?: boolean;
}): AppUpdateState {
  const defaultState = defaultAppUpdateState(input.currentVersion);
  if (input.cache && input.cache.currentVersion === input.currentVersion && input.cache.updateType === null) {
    return {
      ...defaultState,
      lastCheckedAt: input.cache.lastCheckedAt ?? null,
      lastError: input.lastError ?? null,
      checking: input.checking ?? false
    };
  }
  const cachedSource = asAppUpdateSource(input.currentVersion, input.cache);
  const serverNotices = input.notifications.map(extractServerAppUpdateNotification).filter((notice): notice is ServerAppUpdateNotification => notice !== null);
  const matchedServerNotice =
    cachedSource
      ? serverNotices.find((notice) =>
          matchesUpdateIdentity(
            { releaseID: cachedSource.releaseID, latestVersion: cachedSource.latestVersion },
            { releaseID: notice.releaseID, latestVersion: notice.latestVersion }
          )
        ) ?? null
      : serverNotices[0] ?? null;

  const source = cachedSource ?? (matchedServerNotice
    ? {
        status: matchedServerNotice.status,
        latestVersion: matchedServerNotice.latestVersion,
        releaseID: matchedServerNotice.releaseID,
        releaseNotes: matchedServerNotice.releaseNotes,
        releaseURL: matchedServerNotice.releaseURL,
        occurredAt: matchedServerNotice.occurredAt,
        publishedAt: null,
        sizeBytes: null,
        packageName: null,
        downloadTicketRequired: true,
        lastCheckedAt: null
      }
    : null);

  if (!source || source.status === "up_to_date") {
    return {
      ...defaultState,
      lastCheckedAt: input.cache?.lastCheckedAt ?? null,
      lastError: input.lastError ?? null,
      checking: input.checking ?? false
    };
  }

  const summary = buildSummary({
    status: source.status,
    latestVersion: source.latestVersion,
    currentVersion: input.currentVersion,
    releaseNotes: source.releaseNotes
  });
  const blocking = isBlockingStatus(source.status);
  const dismissedOptional =
    !blocking &&
    input.cache?.releaseID === source.releaseID &&
    input.cache.dismissedVersion === source.latestVersion;
  const unread = blocking ? true : matchedServerNotice ? matchedServerNotice.unread : !dismissedOptional;

  return {
    available: true,
    currentVersion: input.currentVersion,
    latestVersion: source.latestVersion,
    releaseID: source.releaseID,
    status: source.status,
    summary,
    releaseNotes: source.releaseNotes,
    highlights: buildHighlights(source.releaseNotes, summary),
    occurredAt: matchedServerNotice?.occurredAt ?? source.occurredAt,
    unread,
    releaseURL: source.releaseURL,
    actionLabel: source.releaseURL ? "去更新" : "查看更新",
    publishedAt: source.publishedAt,
    sizeBytes: source.sizeBytes,
    packageName: source.packageName,
    downloadTicketRequired: source.downloadTicketRequired,
    mandatory: source.status === "mandatory_update",
    blocking,
    reasonBadge: source.status === "mandatory_update" ? "强制更新" : source.status === "unsupported_version" ? "版本过低" : null,
    lastCheckedAt: source.lastCheckedAt,
    lastError: input.lastError ?? null,
    checking: input.checking ?? false
  };
}
