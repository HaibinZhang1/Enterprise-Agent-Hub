type TauriInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoker;
      };
    };
  }
}

export const allowTauriMocks = import.meta.env.DEV && import.meta.env.VITE_P1_ALLOW_TAURI_MOCKS === "true";

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
