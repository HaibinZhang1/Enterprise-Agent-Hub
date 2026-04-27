import assert from "node:assert/strict";
import test from "node:test";
import { guestBootstrap } from "../src/fixtures/p1SeedData.ts";
import { createAdminClient } from "../src/services/p1Client/admin.ts";
import { createAuthClient } from "../src/services/p1Client/auth.ts";
import { getAPIBase, P1ApiError, requestJSON } from "../src/services/p1Client/core.ts";
import { createClientUpdatesClient } from "../src/services/p1Client/clientUpdates.ts";
import { createDesktopSyncClient } from "../src/services/p1Client/desktopSync.ts";
import { isConnectionUnavailableError, isServerUnavailableError } from "../src/services/p1Client/shared.ts";

class MemoryStorage {
  #map = new Map<string, string>();

  getItem(key: string) {
    return this.#map.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.#map.set(key, String(value));
  }

  removeItem(key: string) {
    this.#map.delete(key);
  }
}

function installWindow(apiBase?: string) {
  const storage = new MemoryStorage();
  if (apiBase !== undefined) {
    storage.setItem("enterprise-agent-hub:p1-api-base", apiBase);
  }
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      setTimeout,
      clearTimeout,
    },
  });
  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  };
}

test("getAPIBase leaves the service URL empty when no address is configured", () => {
  const restoreWindow = installWindow();

  try {
    assert.equal(getAPIBase(), "");
  } finally {
    restoreWindow();
  }
});

test("requestJSON uses the configured service URL without rewriting port", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    assert.equal(String(input), "http://127.0.0.1:3000/auth/login");
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await assert.doesNotReject(() => requestJSON("/auth/login", { method: "POST" }));
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client returns initial password challenge without storing a session token", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  globalThis.fetch = (async (input: string | URL) => {
    assert.equal(String(input), "http://127.0.0.1:3000/auth/login");
    return new Response(
      JSON.stringify({
        status: "password_change_required",
        passwordChangeToken: "challenge-token",
        expiresAt: "2026-04-22T12:15:00.000Z",
        user: guestBootstrap.user
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  }) as typeof fetch;

  try {
    const result = await client.login({
      phoneNumber: "13800000001",
      password: "EAgentHub123!",
      serverURL: "http://127.0.0.1:3000"
    });
    assert.equal(result.status, "password_change_required");
    assert.equal(result.passwordChangeToken, "challenge-token");
    assert.equal(window.localStorage.getItem("enterprise-agent-hub:p1-token"), null);
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("admin client rejects malformed phone numbers before creating a user", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAdminClient();
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        client.createAdminUser({
          username: "新用户",
          phoneNumber: "12345",
          departmentID: "dept_company",
          role: "normal_user",
          adminLevel: null
        }),
      (error: unknown) => {
        assert.equal(error instanceof Error, true);
        assert.equal((error as Error).message, "手机号需为 11 位数字。");
        return true;
      }
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client completes initial password change and stores the authenticated token", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url === "http://127.0.0.1:3000/auth/complete-initial-password-change") {
      return new Response(
        JSON.stringify({
          status: "authenticated",
          accessToken: "access-token",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: "2026-04-22T12:15:00.000Z",
          user: guestBootstrap.user,
          menuPermissions: []
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
    assert.equal(url, "http://127.0.0.1:3000/desktop/bootstrap");
    return new Response(JSON.stringify(guestBootstrap), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const bootstrap = await client.completeInitialPasswordChange({
      passwordChangeToken: "challenge-token",
      nextPassword: "BetterPassword123!"
    });
    assert.equal(bootstrap.user.username, guestBootstrap.user.username);
    assert.equal(window.localStorage.getItem("enterprise-agent-hub:p1-token"), "access-token");
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client stores remembered credentials after a successful login", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "http://127.0.0.1:3000/auth/login") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        phoneNumber: "13800000001",
        password: "BetterPassword123!"
      });
      return new Response(
        JSON.stringify({
          status: "authenticated",
          accessToken: "access-token",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: "2026-04-22T12:15:00.000Z",
          user: guestBootstrap.user,
          menuPermissions: []
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
    assert.equal(url, "http://127.0.0.1:3000/desktop/bootstrap");
    return new Response(JSON.stringify(guestBootstrap), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await client.login({
      phoneNumber: "13800000001",
      password: "BetterPassword123!",
      serverURL: "http://127.0.0.1:3000/",
      rememberPassword: true,
      autoLogin: true
    });
    assert.equal(result.status, "authenticated");
    assert.deepEqual(client.storedLoginPreferences(), {
      rememberPassword: true,
      autoLogin: true,
      serverURL: "http://127.0.0.1:3000",
      phoneNumber: "13800000001",
      password: "BetterPassword123!"
    });
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client can auto-login with saved credentials", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  window.localStorage.setItem(
    "enterprise-agent-hub:p1-login-preferences",
    JSON.stringify({
      version: 1,
      rememberPassword: true,
      autoLogin: true,
      serverURL: "http://127.0.0.1:3000",
      phoneNumber: "13800000001",
      password: "BetterPassword123!"
    })
  );
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "http://127.0.0.1:3000/auth/login") {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        phoneNumber: "13800000001",
        password: "BetterPassword123!"
      });
      return new Response(
        JSON.stringify({
          status: "authenticated",
          accessToken: "auto-token",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: "2026-04-22T12:15:00.000Z",
          user: guestBootstrap.user,
          menuPermissions: []
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
    assert.equal(url, "http://127.0.0.1:3000/desktop/bootstrap");
    return new Response(JSON.stringify(guestBootstrap), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const result = await client.loginWithStoredPassword();
    assert.equal(result?.status, "authenticated");
    assert.equal(window.localStorage.getItem("enterprise-agent-hub:p1-token"), "auto-token");
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client clears remembered credentials when remember password is off", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  window.localStorage.setItem(
    "enterprise-agent-hub:p1-login-preferences",
    JSON.stringify({
      version: 1,
      rememberPassword: true,
      autoLogin: true,
      serverURL: "http://127.0.0.1:3000",
      phoneNumber: "13800000001",
      password: "BetterPassword123!"
    })
  );
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url === "http://127.0.0.1:3000/auth/login") {
      return new Response(
        JSON.stringify({
          status: "authenticated",
          accessToken: "access-token",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: "2026-04-22T12:15:00.000Z",
          user: guestBootstrap.user,
          menuPermissions: []
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
    assert.equal(url, "http://127.0.0.1:3000/desktop/bootstrap");
    return new Response(JSON.stringify(guestBootstrap), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await client.login({
      phoneNumber: "13800000001",
      password: "BetterPassword123!",
      serverURL: "http://127.0.0.1:3000",
      rememberPassword: false,
      autoLogin: false
    });
    assert.equal(window.localStorage.getItem("enterprise-agent-hub:p1-login-preferences"), null);
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("auth client refreshes remembered credentials after changing own password", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  const client = createAuthClient();
  window.localStorage.setItem("enterprise-agent-hub:p1-token", "access-token");
  window.localStorage.setItem(
    "enterprise-agent-hub:p1-login-preferences",
    JSON.stringify({
      version: 1,
      rememberPassword: true,
      autoLogin: true,
      serverURL: "http://127.0.0.1:3000",
      phoneNumber: "13800000001",
      password: "OldPassword123!"
    })
  );
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    assert.equal(String(input), "http://127.0.0.1:3000/auth/change-password");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      currentPassword: "OldPassword123!",
      nextPassword: "NewPassword123!"
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  try {
    await client.changeOwnPassword({
      currentPassword: "OldPassword123!",
      nextPassword: "NewPassword123!"
    });
    assert.equal(client.storedLoginPreferences().password, "NewPassword123!");
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("requestJSON turns hung requests into a retryable timeout error", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = ((_: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Request timed out", "AbortError")),
        { once: true }
      );
    })) as typeof fetch;

  try {
    await assert.rejects(
      () => requestJSON("/auth/login", { method: "POST", timeoutMs: 10 }),
      (error: unknown) => {
        assert.ok(error instanceof P1ApiError);
        assert.equal(error.code, "server_unavailable");
        assert.equal(error.retryable, true);
        assert.match(error.message, /请求超时/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("requestJSON turns fetch failures into a retryable connectivity error", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch;

  try {
    await assert.rejects(
      () => requestJSON("/auth/login", { method: "POST", timeoutMs: 10 }),
      (error: unknown) => {
        assert.ok(error instanceof P1ApiError);
        assert.equal(error.code, "server_unavailable");
        assert.equal(error.retryable, true);
        assert.match(error.message, /无法连接服务/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("connection unavailable classification only covers missing HTTP responses", () => {
  assert.equal(
    isConnectionUnavailableError(
      new P1ApiError({
        status: 0,
        code: "server_unavailable",
        message: "无法连接服务",
        retryable: true
      })
    ),
    true
  );
  assert.equal(
    isConnectionUnavailableError(
      new P1ApiError({
        status: 503,
        code: "server_unavailable",
        message: "服务端暂时不可用",
        retryable: true
      })
    ),
    false
  );
  assert.equal(
    isServerUnavailableError(
      new P1ApiError({
        status: 503,
        code: "server_unavailable",
        message: "服务端暂时不可用",
        retryable: true
      })
    ),
    true
  );
});

test("syncLocalEvents normalizes legacy p1-local timestamps before upload", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  window.localStorage.setItem("enterprise-agent-hub:p1-token", "token-1");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    assert.equal(String(input), "http://127.0.0.1:3000/desktop/local-events");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      deviceID: "desktop_p1_default",
      events: [
        {
          eventID: "evt-legacy-time",
          eventType: "enable_result",
          skillID: "codex-review-helper",
          version: "1.2.0",
          targetType: "tool",
          targetID: "codex",
          targetPath: "/Users/example/.codex/skills",
          requestedMode: "copy",
          resolvedMode: "copy",
          fallbackReason: null,
          occurredAt: new Date(1776611970174).toISOString(),
          result: "success"
        }
      ]
    });
    return new Response(
      JSON.stringify({ acceptedEventIDs: ["evt-legacy-time"], rejectedEvents: [], serverStateChanged: true }),
      {
        status: 200,
        headers: { "content-type": "application/json" }
      }
    );
  }) as typeof fetch;

  try {
    const result = await createDesktopSyncClient().syncLocalEvents([
      {
        eventID: "evt-legacy-time",
        eventType: "enable_result",
        skillID: "codex-review-helper",
        version: "1.2.0",
        targetType: "tool",
        targetID: "codex",
        targetPath: "/Users/example/.codex/skills",
        requestedMode: "copy",
        resolvedMode: "copy",
        fallbackReason: null,
        occurredAt: "p1-local-1776611970174",
        result: "success"
      }
    ]);
    assert.deepEqual(result.acceptedEventIDs, ["evt-legacy-time"]);
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});

test("pushAdminClientUpdateExe creates, uploads, and publishes a stable exe release", async () => {
  const restoreWindow = installWindow("http://127.0.0.1:3000");
  window.localStorage.setItem("enterprise-agent-hub:p1-token", "token-1");
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; body: BodyInit | null | undefined }> = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: init?.body });

    if (url.endsWith("/admin/client-updates/releases") && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.endsWith("/admin/client-updates/releases") && init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        version: "1.2.3",
        platform: "windows",
        arch: "x64",
        channel: "stable",
        mandatory: false,
        rolloutPercent: 100,
        releaseNotes: "客户端更新 1.2.3"
      });
      return new Response(JSON.stringify({ releaseID: "rel-123" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.endsWith("/admin/client-updates/releases/rel-123/artifact") && init?.method === "POST") {
      assert.ok(init.body instanceof FormData);
      assert.equal(init.body.get("packageName"), "EnterpriseAgentHub-1.2.3.exe");
      assert.equal(init.body.get("signatureStatus"), "unknown");
      assert.ok(init.body.get("file") instanceof File);
      return new Response(JSON.stringify({ releaseID: "rel-123" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.endsWith("/admin/client-updates/releases/rel-123/publish") && init?.method === "POST") {
      assert.deepEqual(JSON.parse(String(init.body)), {
        mandatory: false,
        rolloutPercent: 100
      });
      return new Response(JSON.stringify({ releaseID: "rel-123", version: "1.2.3", status: "published" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: { message: "unexpected request" } }), { status: 500 });
  }) as typeof fetch;

  try {
    const result = await createClientUpdatesClient().pushAdminClientUpdateExe({
      file: new File(["MZ"], "EnterpriseAgentHub-1.2.3.exe"),
      version: " 1.2.3 "
    });
    assert.equal(result.releaseID, "rel-123");
    assert.deepEqual(
      calls.map((call) => [call.method, new URL(call.url).pathname]),
      [
        ["GET", "/admin/client-updates/releases"],
        ["POST", "/admin/client-updates/releases"],
        ["POST", "/admin/client-updates/releases/rel-123/artifact"],
        ["POST", "/admin/client-updates/releases/rel-123/publish"]
      ]
    );
  } finally {
    globalThis.fetch = previousFetch;
    restoreWindow();
  }
});
