export type DesktopInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
const DEFAULT_LOCAL_COMMAND_TIMEOUT_MS = 20_000;
const importMetaEnv = (import.meta as ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_P1_ALLOW_ELECTRON_MOCKS?: string;
  };
}).env;

declare global {
  interface Window {
    enterpriseAgentHubDesktop?: {
      invoke?: DesktopInvoker;
    };
  }
}

export const allowElectronMocks = Boolean(importMetaEnv?.DEV) && importMetaEnv?.VITE_P1_ALLOW_ELECTRON_MOCKS === "true";

export const mockWait = (ms = 160) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function getInvoke(): DesktopInvoker | null {
  return window.enterpriseAgentHubDesktop?.invoke ?? null;
}

export async function requireInvoke(): Promise<DesktopInvoker> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke;
  }
  if (allowElectronMocks) {
    await mockWait();
    return async () => {
      throw new Error("Electron mock dispatcher must be handled by the caller");
    };
  }
  throw new Error("Electron runtime is unavailable; local Store/Adapter commands cannot run outside the Electron desktop app.");
}

export function isBrowserPreviewMode(): boolean {
  return getInvoke() === null && !allowElectronMocks;
}

export async function invokeWithTimeout<T>(
  invoke: DesktopInvoker,
  command: string,
  args?: Record<string, unknown>,
  timeoutMs = DEFAULT_LOCAL_COMMAND_TIMEOUT_MS
): Promise<T> {
  let timeoutID: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutID = window.setTimeout(() => {
      reject(new Error(`本地命令 ${command} 超时，请确认 Electron Adapter 是否仍在运行。`));
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
