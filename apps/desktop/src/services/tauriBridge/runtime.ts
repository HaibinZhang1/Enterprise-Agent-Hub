export type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const DEFAULT_LOCAL_COMMAND_TIMEOUT_MS = 20_000;
const importMetaEnv = (import.meta as ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_P1_ALLOW_TAURI_MOCKS?: string;
  };
}).env;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoker;
      };
    };
  }
}

export const allowTauriMocks = Boolean(importMetaEnv?.DEV) && importMetaEnv?.VITE_P1_ALLOW_TAURI_MOCKS === "true";

export const mockWait = (ms = 160) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function getInvoke(): TauriInvoker | null {
  return window.__TAURI__?.core?.invoke ?? null;
}

export async function requireInvoke(): Promise<TauriInvoker> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke;
  }
  if (allowTauriMocks) {
    await mockWait();
    return async () => {
      throw new Error("Tauri mock dispatcher must be handled by the caller");
    };
  }
  throw new Error("Tauri runtime is unavailable; local Store/Adapter commands cannot run outside the Tauri desktop app.");
}

export function isBrowserPreviewMode(): boolean {
  return getInvoke() === null && !allowTauriMocks;
}

export async function invokeWithTimeout<T>(
  invoke: TauriInvoker,
  command: string,
  args?: Record<string, unknown>,
  timeoutMs = DEFAULT_LOCAL_COMMAND_TIMEOUT_MS
): Promise<T> {
  let timeoutID: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutID = window.setTimeout(() => {
      reject(new Error(`本地命令 ${command} 超时，请确认 Tauri Adapter 是否仍在运行。`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([invoke<T>(command, args), timeout]);
  } finally {
    if (timeoutID !== undefined) {
      window.clearTimeout(timeoutID);
    }
  }
}
