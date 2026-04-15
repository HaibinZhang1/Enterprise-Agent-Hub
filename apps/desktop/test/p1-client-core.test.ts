import assert from "node:assert/strict";
import test from "node:test";
import { P1ApiError, requestJSON } from "../src/services/p1Client/core.ts";

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

function installWindow() {
  const storage = new MemoryStorage();
  storage.setItem("enterprise-agent-hub:p1-api-base", "http://127.0.0.1:3000");
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

test("requestJSON turns hung requests into a retryable timeout error", async () => {
  const restoreWindow = installWindow();
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
  const restoreWindow = installWindow();
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
