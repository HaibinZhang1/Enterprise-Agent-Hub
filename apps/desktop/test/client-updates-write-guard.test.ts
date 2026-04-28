import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { guestBootstrap } from "../src/fixtures/p1SeedData.ts";
import {
  clearRemoteWriteGuardStatus,
  p1Client,
  REMOTE_WRITE_ALLOWLIST,
  REMOTE_WRITE_BLOCK_MESSAGE,
  setRemoteWriteGuardStatus
} from "../src/services/p1Client.ts";
import { P1ApiError } from "../src/services/p1Client.ts";

const API_BASE_STORAGE_KEY = "enterprise-agent-hub:p1-api-base";
const TOKEN_STORAGE_KEY = "enterprise-agent-hub:p1-token";
const API_BASE = "https://updates.example.com";

type FetchCall = {
  url: string;
  method: string;
};

let fetchCalls: FetchCall[] = [];

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

function installWindowMock() {
  const localStorage = createStorage();
  (globalThis as typeof globalThis & { window?: unknown }).window = {
    localStorage,
    setTimeout,
    clearTimeout
  };
  localStorage.setItem(API_BASE_STORAGE_KEY, API_BASE);
  localStorage.setItem(TOKEN_STORAGE_KEY, "token-123");
  return localStorage;
}

function installFetchMock() {
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = url.replace(API_BASE, "");
    fetchCalls.push({ url: path, method });

    if (path === "/auth/login" && method === "POST") {
      return jsonResponse({
        status: "authenticated",
        accessToken: "token-456",
        tokenType: "Bearer",
        expiresIn: 3600,
        expiresAt: "2026-04-22T12:00:00.000Z",
        user: guestBootstrap.user,
        menuPermissions: []
      });
    }

    if (path === "/auth/complete-initial-password-change" && method === "POST") {
      return jsonResponse({
        status: "authenticated",
        accessToken: "token-789",
        tokenType: "Bearer",
        expiresIn: 3600,
        expiresAt: "2026-04-22T12:00:00.000Z",
        user: guestBootstrap.user,
        menuPermissions: []
      });
    }

    if (path === "/auth/logout" && method === "POST") {
      return jsonResponse({ ok: true });
    }

    if (path === "/desktop/bootstrap" && method === "GET") {
      return jsonResponse({
        ...guestBootstrap,
        connection: {
          ...guestBootstrap.connection,
          status: "connected",
          lastError: ""
        },
        user: {
          ...guestBootstrap.user,
          username: "demo-user",
          role: "normal_user"
        }
      });
    }

    if (path === "/notifications/mark-read" && method === "POST") {
      return jsonResponse({ unreadNotificationCount: 0 });
    }

    if (path === "/client-updates/check" && method === "POST") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      assert.equal(payload.currentVersion, "1.5.0");
      assert.equal(payload.platform, "windows");
      assert.equal(payload.arch, "x64");
      assert.equal(payload.channel, "stable");
      assert.equal(payload.deviceID, "device-test-001");
      return jsonResponse({
        status: "update_available",
        currentVersion: "1.5.0",
        latestVersion: "1.6.0",
        releaseID: "rel_01",
        channel: "stable",
        releaseNotes: "修复发布中心稳定性问题。",
        mandatory: false,
        downloadTicketRequired: true
      });
    }

    if (path === "/client-updates/releases/rel_01/download-ticket" && method === "POST") {
      return jsonResponse({
        releaseID: "rel_01",
        version: "1.6.0",
        downloadURL: "/client-updates/releases/rel_01/download?ticket=ticket-123",
        expiresAt: "2026-04-22T12:15:00.000Z",
        packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
        sizeBytes: 124000000,
        sha256: "sha256:hex-encoded-sha256",
        signatureStatus: "signed"
      });
    }

    if (path === "/client-updates/events" && method === "POST") {
      return jsonResponse({ ok: true });
    }

    if (path === "/skills/review-helper/star" && method === "POST") {
      return jsonResponse({ skillID: "review-helper", starred: true, starCount: 1 });
    }

    if (path === "/admin/departments" && method === "POST") {
      return jsonResponse([]);
    }

    return jsonResponse({ ok: true });
  }) as typeof fetch;
}

beforeEach(() => {
  installWindowMock();
  installFetchMock();
  clearRemoteWriteGuardStatus();
});

afterEach(() => {
  clearRemoteWriteGuardStatus();
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
  delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
});

test("remote-write allowlist stays verbatim while the desktop write guard is active", async () => {
  assert.deepEqual([...REMOTE_WRITE_ALLOWLIST], [
    "/auth/login",
    "/auth/complete-initial-password-change",
    "/auth/logout",
    "/desktop/bootstrap",
    "/client-updates/check",
    "/client-updates/releases/:releaseID/download-ticket",
    "/client-updates/events",
    "/notifications/mark-read"
  ]);

  setRemoteWriteGuardStatus("mandatory_update");

  await assert.doesNotReject(() =>
    p1Client.login({
      phoneNumber: "13800138000",
      password: "password",
      serverURL: API_BASE
    })
  );
  await assert.doesNotReject(() => p1Client.completeInitialPasswordChange({ passwordChangeToken: "challenge-token", nextPassword: "BetterPassword123!" }));
  await assert.doesNotReject(() => p1Client.logout());
  await assert.doesNotReject(() => p1Client.markNotificationsRead(["notify-1"]));
  await assert.doesNotReject(() => p1Client.checkClientUpdate({ currentVersion: "1.5.0", deviceID: "device-test-001" }));
  await assert.doesNotReject(() => p1Client.requestClientUpdateDownloadTicket("rel_01"));
  await assert.doesNotReject(() => p1Client.reportClientUpdateEvent({ releaseID: "rel_01", eventType: "download_started", deviceID: "device-test-001", fromVersion: "1.5.0", toVersion: "1.6.0" }));

  assert.ok(fetchCalls.some((call) => call.url === "/auth/login" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/auth/complete-initial-password-change" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/auth/logout" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/notifications/mark-read" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/client-updates/check" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/client-updates/releases/rel_01/download-ticket" && call.method === "POST"));
  assert.ok(fetchCalls.some((call) => call.url === "/client-updates/events" && call.method === "POST"));
});

test("blocked remote writes fail fast with the single required message", async () => {
  setRemoteWriteGuardStatus("unsupported_version");

  await assert.rejects(() => p1Client.star("review-helper", true), (error: unknown) => {
    assert.ok(error instanceof P1ApiError);
    assert.equal(error.message, REMOTE_WRITE_BLOCK_MESSAGE);
    return true;
  });

  await assert.rejects(() => p1Client.createDepartment({ parentDepartmentID: "root", name: "平台工程部" }), (error: unknown) => {
    assert.ok(error instanceof P1ApiError);
    assert.equal(error.message, REMOTE_WRITE_BLOCK_MESSAGE);
    return true;
  });

  assert.equal(fetchCalls.some((call) => call.url === "/skills/review-helper/star"), false);
  assert.equal(fetchCalls.some((call) => call.url === "/admin/departments"), false);
});
