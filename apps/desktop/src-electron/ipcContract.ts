import { LOCAL_COMMAND_NAMES, type LocalCommandName } from "@enterprise-agent-hub/shared-contracts";

export const ELECTRON_APP_ID = "com.enterpriseagenthub.desktop";
export const ELECTRON_PRODUCT_NAME = "Enterprise Agent Hub";
export const ELECTRON_DEV_SERVER_URL = "http://127.0.0.1:1420";

export const DESKTOP_IPC_CHANNELS = {
  localCommand: "desktop:local-command",
  windowControl: "desktop:window-control",
  openExternalURL: "desktop:open-external-url"
} as const;

export type DesktopIpcChannel = typeof DESKTOP_IPC_CHANNELS[keyof typeof DESKTOP_IPC_CHANNELS];

export const DESKTOP_WINDOW_CONTROL_ACTIONS = [
  "minimize",
  "maximize",
  "close",
  "startDragging"
] as const;

export type DesktopWindowControlAction = typeof DESKTOP_WINDOW_CONTROL_ACTIONS[number];

export const DESKTOP_CLIENT_UPDATE_COMMAND_NAMES = [
  "get_client_app_version",
  "download_client_update",
  "verify_client_update",
  "launch_client_installer"
] as const;

export type DesktopClientUpdateCommandName = typeof DESKTOP_CLIENT_UPDATE_COMMAND_NAMES[number];
export type DesktopCommandName = LocalCommandName | DesktopClientUpdateCommandName;
export const DESKTOP_APPROVED_COMMAND_NAMES: readonly DesktopCommandName[] = [
  ...LOCAL_COMMAND_NAMES,
  ...DESKTOP_CLIENT_UPDATE_COMMAND_NAMES
];

export type DesktopLocalCommandPayload = {
  readonly command: DesktopCommandName;
  readonly args?: Record<string, unknown>;
};

export type DesktopWindowControlPayload = {
  readonly action: DesktopWindowControlAction;
};

export type DesktopOpenExternalPayload = {
  readonly url: string;
};

export type LocalCommandHandler = (args: Record<string, unknown> | undefined) => Promise<unknown> | unknown;
export type LocalCommandHandlerRegistry = Partial<Record<DesktopCommandName, LocalCommandHandler>>;

const allowedDesktopCommands = new Set<string>(DESKTOP_APPROVED_COMMAND_NAMES);
const allowedLocalCommands = new Set<string>(LOCAL_COMMAND_NAMES);
const allowedWindowControlActions = new Set<string>(DESKTOP_WINDOW_CONTROL_ACTIONS);

export function isDesktopCommandName(value: unknown): value is DesktopCommandName {
  return typeof value === "string" && allowedDesktopCommands.has(value);
}

export function isLocalCommandName(value: unknown): value is LocalCommandName {
  return typeof value === "string" && allowedLocalCommands.has(value);
}

export function isDesktopWindowControlAction(value: unknown): value is DesktopWindowControlAction {
  return typeof value === "string" && allowedWindowControlActions.has(value);
}

export function assertDesktopCommandName(value: unknown): DesktopCommandName {
  if (!isDesktopCommandName(value)) {
    throw new Error(`Unsupported desktop command: ${String(value)}`);
  }
  return value;
}

export function assertLocalCommandName(value: unknown): LocalCommandName {
  if (!isLocalCommandName(value)) {
    throw new Error(`Unsupported desktop local command: ${String(value)}`);
  }
  return value;
}

export function assertWindowControlAction(value: unknown): DesktopWindowControlAction {
  if (!isDesktopWindowControlAction(value)) {
    throw new Error(`Unsupported desktop window control action: ${String(value)}`);
  }
  return value;
}

export function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}
