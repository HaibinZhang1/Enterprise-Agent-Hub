const API_BASE_STORAGE_KEY = "enterprise-agent-hub:p1-api-base";
const TOKEN_STORAGE_KEY = "enterprise-agent-hub:p1-token";
const LOGIN_PREFERENCES_STORAGE_KEY = "enterprise-agent-hub:p1-login-preferences";
const DEFAULT_API_BASE =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DESKTOP_API_BASE_URL ?? "";
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export interface StoredLoginPreferences {
  readonly rememberPassword: boolean;
  readonly autoLogin: boolean;
  readonly serverURL: string;
  readonly phoneNumber: string;
  readonly password: string;
}

interface StoredLoginPreferencesRecord extends StoredLoginPreferences {
  readonly version: 1;
}

const emptyLoginPreferences: StoredLoginPreferences = {
  rememberPassword: false,
  autoLogin: false,
  serverURL: "",
  phoneNumber: "",
  password: ""
};

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

export function normalizeBaseURL(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("服务地址不能为空");
  }
  return trimmed.replace(/\/+$/, "");
}

export function getAPIBase(): string {
  const storedValue = window.localStorage.getItem(API_BASE_STORAGE_KEY) ?? DEFAULT_API_BASE;
  return storedValue.trim() ? normalizeBaseURL(storedValue) : "";
}

export function setAPIBase(value: string): void {
  window.localStorage.setItem(API_BASE_STORAGE_KEY, normalizeBaseURL(value));
}

export function resolveAPIURL(value: string): string {
  return new URL(value, `${requireAPIBase()}/`).toString();
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getStoredLoginPreferences(): StoredLoginPreferences {
  const raw = window.localStorage.getItem(LOGIN_PREFERENCES_STORAGE_KEY);
  if (!raw) return emptyLoginPreferences;
  try {
    const value = JSON.parse(raw) as Partial<StoredLoginPreferencesRecord>;
    if (value.version !== 1 || !value.rememberPassword) {
      return emptyLoginPreferences;
    }
    const serverURL = typeof value.serverURL === "string" ? value.serverURL : "";
    const phoneNumber = typeof value.phoneNumber === "string" ? value.phoneNumber : "";
    const password = typeof value.password === "string" ? value.password : "";
    if (!serverURL.trim() || !phoneNumber.trim() || !password) {
      return emptyLoginPreferences;
    }
    return {
      rememberPassword: true,
      autoLogin: value.autoLogin === true,
      serverURL: normalizeBaseURL(serverURL),
      phoneNumber: phoneNumber.trim(),
      password
    };
  } catch {
    window.localStorage.removeItem(LOGIN_PREFERENCES_STORAGE_KEY);
    return emptyLoginPreferences;
  }
}

export function setStoredLoginPreferences(input: {
  serverURL: string;
  phoneNumber: string;
  password: string;
  rememberPassword?: boolean;
  autoLogin?: boolean;
}): void {
  if (!input.rememberPassword) {
    clearStoredLoginPreferences();
    return;
  }
  const nextPreferences: StoredLoginPreferencesRecord = {
    version: 1,
    rememberPassword: true,
    autoLogin: input.autoLogin === true,
    serverURL: normalizeBaseURL(input.serverURL),
    phoneNumber: input.phoneNumber.trim(),
    password: input.password
  };
  window.localStorage.setItem(LOGIN_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences));
}

export function clearStoredLoginPreferences(): void {
  window.localStorage.removeItem(LOGIN_PREFERENCES_STORAGE_KEY);
}

export async function requestJSON<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...requestInit } = init ?? {};
  const token = getToken();
  const headers = new Headers(requestInit.headers);
  if (!(requestInit.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutID = window.setTimeout(() => {
    controller.abort(new DOMException("Request timed out", "AbortError"));
  }, timeoutMs);

  if (requestInit.signal) {
    if (requestInit.signal.aborted) {
      controller.abort(requestInit.signal.reason);
    } else {
      requestInit.signal.addEventListener("abort", () => controller.abort(requestInit.signal?.reason), { once: true });
    }
  }

  try {
    const response = await fetch(`${requireAPIBase()}${path}`, {
      credentials: "include",
      ...requestInit,
      headers,
      signal: controller.signal
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
  } catch (error) {
    if (error instanceof P1ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new P1ApiError({
        status: 0,
        code: "server_unavailable",
        message: "请求超时，请确认服务地址可用且 API 已启动。",
        retryable: true
      });
    }
    if (error instanceof TypeError) {
      throw new P1ApiError({
        status: 0,
        code: "server_unavailable",
        message: "无法连接服务，请确认服务地址、端口和网络。",
        retryable: true
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutID);
  }
}

function requireAPIBase(): string {
  const apiBase = getAPIBase();
  if (!apiBase) {
    throw new P1ApiError({
      status: 0,
      code: "server_unavailable",
      message: "请先输入服务地址。",
      retryable: false
    });
  }
  return apiBase;
}

export function routePath(template: string, params: Record<string, string>): string {
  return Object.entries(params).reduce(
    (current, [key, value]) => current.replace(`:${key}`, encodeURIComponent(value)),
    template
  );
}
