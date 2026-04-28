import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { createClientUpdatesClient } from "../src/services/p1Client/clientUpdates.ts";

const API_BASE_STORAGE_KEY = "enterprise-agent-hub:p1-api-base";
const TOKEN_STORAGE_KEY = "enterprise-agent-hub:p1-token";
const DEVICE_STORAGE_KEY = "enterprise-agent-hub:client-update-device-id";
const API_BASE = "https://updates.example.com";

type RecordedRequest = {
  url: string;
  method: string;
  body: string | null;
};

let requests: RecordedRequest[] = [];

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
    }
  };
}

function installWindow() {
  const localStorage = createStorage();
  localStorage.setItem(API_BASE_STORAGE_KEY, API_BASE);
  localStorage.setItem(TOKEN_STORAGE_KEY, "token-123");
  localStorage.setItem(DEVICE_STORAGE_KEY, "device-fixed-001");
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      setTimeout,
      clearTimeout
    }
  });
  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow
    });
  };
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}

beforeEach(() => {
  requests = [];
});

test("client update check uses POST body with required device fields", async () => {
  const restoreWindow = installWindow();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      method: (init?.method ?? "GET").toUpperCase(),
      body: typeof init?.body === "string" ? init.body : null
    });
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
  }) as typeof fetch;

  try {
    const client = createClientUpdatesClient();
    const result = await client.checkClientUpdate({
      currentVersion: "1.5.0",
      platform: "windows",
      arch: "x64",
      channel: "stable",
      deviceID: "device-fixed-001",
      dismissedVersion: "1.5.9"
    });

    assert.equal(result.status, "update_available");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, `${API_BASE}/client-updates/check`);
    assert.equal(requests[0]?.method, "POST");
    assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
      currentVersion: "1.5.0",
      platform: "windows",
      arch: "x64",
      channel: "stable",
      deviceID: "device-fixed-001",
      dismissedVersion: "1.5.9"
    });
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("download ticket resolves relative URLs to the configured API base", async () => {
  const restoreWindow = installWindow();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    jsonResponse({
      releaseID: "rel_01",
      version: "1.6.0",
      downloadURL: "/client-updates/releases/rel_01/download?ticket=ticket-123",
      expiresAt: "2026-04-22T12:15:00.000Z",
      packageName: "EnterpriseAgentHub_1.6.0_x64-setup.exe",
      sizeBytes: 124000000,
      sha256: "sha256:deadbeef",
      signatureStatus: "signed"
    })) as typeof fetch;

  try {
    const client = createClientUpdatesClient();
    const result = await client.requestClientUpdateDownloadTicket("rel_01");
    assert.equal(result.releaseID, "rel_01");
    assert.equal(result.version, "1.6.0");
    assert.equal(result.downloadURL, `${API_BASE}/client-updates/releases/rel_01/download?ticket=ticket-123`);
    assert.equal(result.packageName, "EnterpriseAgentHub_1.6.0_x64-setup.exe");
    assert.equal(result.sizeBytes, 124000000);
    assert.equal(result.sha256, "sha256:deadbeef");
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

afterEach(() => {
  delete (globalThis as typeof globalThis & { window?: unknown }).window;
  delete (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
});
