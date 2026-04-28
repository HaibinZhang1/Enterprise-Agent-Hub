import { DESKTOP_APPROVED_COMMAND_NAMES, type DesktopCommandName } from "../../../src-electron/ipcContract.ts";

export type DesktopInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
export type WindowControlAction = "minimize" | "maximize" | "close" | "startDragging";
export type DesktopLocalCommandBridge = Partial<Record<DesktopCommandName, (args?: Record<string, unknown>) => Promise<unknown>>>;

const DEFAULT_LOCAL_COMMAND_TIMEOUT_MS = 20_000;
const importMetaEnv = (import.meta as ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_P1_ALLOW_DESKTOP_MOCKS?: string;
  };
}).env;

const allowedDesktopCommands = new Set<string>(DESKTOP_APPROVED_COMMAND_NAMES);

export interface DesktopRuntimeBridge {
  localCommands?: DesktopLocalCommandBridge;
  windowControls?: Partial<Record<WindowControlAction, () => Promise<void>>>;
  openExternalURL?: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    desktopBridge?: DesktopRuntimeBridge;
  }
}

export const allowDesktopMocks = Boolean(importMetaEnv?.DEV) && importMetaEnv?.VITE_P1_ALLOW_DESKTOP_MOCKS === "true";

export const mockWait = (ms = 160) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function getDesktopRuntimeBridge(): DesktopRuntimeBridge | null {
  if (typeof window === "undefined") return null;
  return window.desktopBridge ?? null;
}

function isDesktopCommandName(value: string): value is DesktopCommandName {
  return allowedDesktopCommands.has(value);
}

export function getInvoke(): DesktopInvoker | null {
  const bridge = getDesktopRuntimeBridge();
  if (!bridge?.localCommands) return null;
  return async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    if (!isDesktopCommandName(command)) {
      throw new Error(`Unsupported desktop command: ${command}`);
    }
    const handler = bridge.localCommands?.[command];
    if (!handler) {
      throw new Error(`Desktop local command is not exposed by preload: ${command}`);
    }
    return handler(args) as Promise<T>;
  };
}

export async function requireInvoke(): Promise<DesktopInvoker> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke;
  }
  if (allowDesktopMocks) {
    await mockWait();
    return async () => {
      throw new Error("Desktop mock dispatcher must be handled by the caller");
    };
  }
  throw new Error("Desktop runtime is unavailable; local Store/Adapter commands cannot run outside the Electron desktop app.");
}

export function isBrowserPreviewMode(): boolean {
  return getInvoke() === null && !allowDesktopMocks;
}

export async function runWindowControl(action: WindowControlAction): Promise<void> {
  const control = getDesktopRuntimeBridge()?.windowControls?.[action];
  if (!control) return;
  await control();
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
      reject(new Error(`本地命令 ${command} 超时，请确认 Desktop Adapter 是否仍在运行。`));
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
