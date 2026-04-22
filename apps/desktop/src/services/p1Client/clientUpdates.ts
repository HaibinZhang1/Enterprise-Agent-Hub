import { requestJSON, resolveAPIURL, routePath } from "./core.ts";

export const CLIENT_UPDATE_ROUTES = {
  check: "/client-updates/check",
  downloadTicket: "/client-updates/releases/:releaseID/download-ticket",
  events: "/client-updates/events"
} as const;

export type ClientUpdateStatus = "up_to_date" | "update_available" | "mandatory_update" | "unsupported_version";
export type ClientUpdateType = "optional" | "mandatory" | "unsupported";

export interface ClientUpdateCheckInput {
  currentVersion: string;
  buildNumber?: string;
  platform?: "windows";
  arch?: "x64";
  osVersion?: string;
  channel?: string;
  deviceID: string;
  dismissedVersion?: string | null;
}

export interface ClientUpdateCheckResponse {
  status: ClientUpdateStatus;
  updateType: ClientUpdateType;
  currentVersion: string;
  latestVersion: string;
  releaseID: string | null;
  channel: string;
  packageName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  publishedAt: string | null;
  releaseNotes: string;
  mandatory: boolean;
  minSupportedVersion: string | null;
  downloadTicketRequired: boolean;
  releaseURL: string | null;
  lastCheckedAt: string;
}

export interface ClientUpdateDownloadTicket {
  releaseID: string;
  version: string;
  downloadURL: string;
  expiresAt: string;
  packageName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  signatureStatus: string | null;
}

export interface ClientUpdateEventInput {
  releaseID: string;
  eventType: string;
  deviceID: string;
  fromVersion: string;
  toVersion?: string | null;
  errorCode?: string | null;
}

type RawClientUpdateCheckResponse = Partial<
  Record<
    | "status"
    | "updateType"
    | "currentVersion"
    | "latestVersion"
    | "releaseID"
    | "channel"
    | "packageName"
    | "sizeBytes"
    | "sha256"
    | "publishedAt"
    | "releaseNotes"
    | "summary"
    | "mandatory"
    | "minSupportedVersion"
    | "downloadTicketRequired"
    | "releaseURL"
    | "downloadURL",
    unknown
  >
>;

function coerceStatus(value: unknown): ClientUpdateStatus {
  if (value === "mandatory_update" || value === "unsupported_version" || value === "update_available" || value === "up_to_date") {
    return value;
  }
  return "up_to_date";
}

function coerceUpdateType(status: ClientUpdateStatus, value: unknown): ClientUpdateType {
  if (value === "mandatory" || value === "unsupported" || value === "optional") {
    return value;
  }
  if (status === "mandatory_update") return "mandatory";
  if (status === "unsupported_version") return "unsupported";
  return "optional";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeClientUpdateCheckResponse(
  rawResponse: RawClientUpdateCheckResponse,
  input: ClientUpdateCheckInput,
  checkedAt = new Date().toISOString()
): ClientUpdateCheckResponse {
  const status = coerceStatus(rawResponse.status);
  const latestVersion = asNullableString(rawResponse.latestVersion) ?? input.currentVersion;
  const mandatory = rawResponse.mandatory === true || status === "mandatory_update" || status === "unsupported_version";
  return {
    status,
    updateType: coerceUpdateType(status, rawResponse.updateType),
    currentVersion: asNullableString(rawResponse.currentVersion) ?? input.currentVersion,
    latestVersion,
    releaseID: asNullableString(rawResponse.releaseID),
    channel: asNullableString(rawResponse.channel) ?? input.channel ?? "stable",
    packageName: asNullableString(rawResponse.packageName),
    sizeBytes: asNullableNumber(rawResponse.sizeBytes),
    sha256: asNullableString(rawResponse.sha256),
    publishedAt: asNullableString(rawResponse.publishedAt),
    releaseNotes: asNullableString(rawResponse.releaseNotes) ?? asNullableString(rawResponse.summary) ?? "",
    mandatory,
    minSupportedVersion: asNullableString(rawResponse.minSupportedVersion),
    downloadTicketRequired: rawResponse.downloadTicketRequired !== false,
    releaseURL: asNullableString(rawResponse.releaseURL) ?? asNullableString(rawResponse.downloadURL),
    lastCheckedAt: checkedAt
  };
}

export function createClientUpdatesClient() {
  return {
    async checkClientUpdate(input: ClientUpdateCheckInput): Promise<ClientUpdateCheckResponse> {
      const rawResponse = await requestJSON<RawClientUpdateCheckResponse>(CLIENT_UPDATE_ROUTES.check, {
        method: "POST",
        body: JSON.stringify({
          currentVersion: input.currentVersion,
          buildNumber: input.buildNumber,
          platform: input.platform ?? "windows",
          arch: input.arch ?? "x64",
          osVersion: input.osVersion,
          channel: input.channel ?? "stable",
          deviceID: input.deviceID,
          dismissedVersion: input.dismissedVersion ?? null
        })
      });
      return normalizeClientUpdateCheckResponse(rawResponse, input);
    },

    async requestClientUpdateDownloadTicket(releaseID: string): Promise<ClientUpdateDownloadTicket> {
      const response = await requestJSON<ClientUpdateDownloadTicket>(routePath(CLIENT_UPDATE_ROUTES.downloadTicket, { releaseID }), {
        method: "POST"
      });
      return {
        ...response,
        downloadURL: resolveAPIURL(response.downloadURL)
      };
    },

    async reportClientUpdateEvent(input: ClientUpdateEventInput): Promise<{ ok: true }> {
      return requestJSON<{ ok: true }>(CLIENT_UPDATE_ROUTES.events, {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
  };
}
