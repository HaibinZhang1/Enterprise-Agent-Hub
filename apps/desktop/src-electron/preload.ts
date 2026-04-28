import {
  DESKTOP_APPROVED_COMMAND_NAMES,
  DESKTOP_IPC_CHANNELS,
  assertDesktopCommandName,
  assertRecord,
  assertWindowControlAction,
  type DesktopCommandName
} from "./ipcContract.ts";
import { isSafeExternalURL } from "./security.ts";

type IpcRendererLike = {
  invoke(channel: string, payload?: unknown): Promise<unknown>;
};

type ContextBridgeLike = {
  exposeInMainWorld(apiKey: string, api: unknown): void;
};

type ElectronPreloadModule = {
  contextBridge: ContextBridgeLike;
  ipcRenderer: IpcRendererLike;
};

type ExposedDesktopCommand = (args?: Record<string, unknown>) => Promise<unknown>;

declare const require: (moduleName: "electron") => ElectronPreloadModule;

const { contextBridge, ipcRenderer } = require("electron");

function createDesktopCommandWrapper(commandName: DesktopCommandName): ExposedDesktopCommand {
  return async (args?: Record<string, unknown>) => {
    const command = assertDesktopCommandName(commandName);
    if (args !== undefined) {
      assertRecord(args, "Desktop command args");
    }
    return ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.localCommand, { command, args });
  };
}

const localCommands = Object.freeze(
  Object.fromEntries(
    DESKTOP_APPROVED_COMMAND_NAMES.map((command) => [command, createDesktopCommandWrapper(command)])
  ) as Record<DesktopCommandName, ExposedDesktopCommand>
);

const desktopBridge = Object.freeze({
  localCommands,
  windowControls: Object.freeze({
    minimize: async () => {
      await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.windowControl, { action: assertWindowControlAction("minimize") });
    },
    maximize: async () => {
      await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.windowControl, { action: assertWindowControlAction("maximize") });
    },
    close: async () => {
      await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.windowControl, { action: assertWindowControlAction("close") });
    },
    startDragging: async () => {
      await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.windowControl, { action: assertWindowControlAction("startDragging") });
    }
  }),
  openExternalURL: async (url: string) => {
    if (!isSafeExternalURL(url)) {
      throw new Error("Only http/https URLs can be opened externally.");
    }
    await ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.openExternalURL, { url });
  }
});

contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);
