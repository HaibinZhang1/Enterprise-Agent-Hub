import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElectronClientUpdateAdapter } from "./client-updates/adapter.ts";
import {
  DESKTOP_IPC_CHANNELS,
  ELECTRON_APP_ID,
  ELECTRON_DEV_SERVER_URL,
  ELECTRON_PRODUCT_NAME,
  assertDesktopCommandName,
  assertRecord,
  assertWindowControlAction,
  type LocalCommandHandlerRegistry
} from "./ipcContract.ts";
import { ElectronLocalRuntime } from "./local/runtime.ts";
import {
  assertAllowedSenderURL,
  buildRendererContentSecurityPolicy,
  isSafeExternalURL,
  shouldBlockNavigation
} from "./security.ts";

type BrowserWindowConstructorOptions = Record<string, unknown>;

type WebContentsLike = {
  getURL(): string;
  openDevTools?(options?: Record<string, unknown>): void;
  setWindowOpenHandler(handler: (details: { url: string }) => { action: "allow" | "deny" }): void;
  on(event: "will-navigate", listener: (event: { preventDefault(): void }, url: string) => void): void;
  session: SessionLike;
};

type BrowserWindowLike = {
  readonly webContents: WebContentsLike;
  loadURL(url: string): Promise<void>;
  loadFile(filePath: string): Promise<void>;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  isMaximized(): boolean;
  close(): void;
};

type BrowserWindowConstructor = new (options: BrowserWindowConstructorOptions) => BrowserWindowLike;

type IpcMainInvokeEventLike = {
  senderFrame?: { url?: string } | null;
  sender?: { getURL?: () => string };
};

type IpcMainLike = {
  handle(channel: string, listener: (event: IpcMainInvokeEventLike, payload?: unknown) => unknown): void;
};

type ShellLike = {
  openExternal(url: string): Promise<void>;
};

type SessionLike = {
  setPermissionRequestHandler(handler: (webContents: WebContentsLike, permission: string, callback: (permissionGranted: boolean) => void) => void): void;
  webRequest: {
    onHeadersReceived(handler: (
      details: { responseHeaders?: Record<string, string[] | string> },
      callback: (response: { responseHeaders: Record<string, string[] | string> }) => void
    ) => void): void;
  };
};

type AppLike = {
  isPackaged: boolean;
  whenReady(): Promise<void>;
  on(event: "activate" | "window-all-closed", listener: () => void): void;
  quit(): void;
  setName(name: string): void;
  setAppUserModelId(id: string): void;
  getPath(name: "appData" | "userData"): string;
  getVersion(): string;
};

type ElectronMainModule = {
  app: AppLike;
  BrowserWindow: BrowserWindowConstructor;
  ipcMain: IpcMainLike;
  shell: ShellLike;
  session: { defaultSession: SessionLike };
};

declare const process: {
  env: Record<string, string | undefined>;
  platform: string;
  arch: string;
};

const localCommandHandlers: LocalCommandHandlerRegistry = {};

export function registerLocalCommandHandlers(handlers: LocalCommandHandlerRegistry): void {
  Object.assign(localCommandHandlers, handlers);
}

function loadElectron(): Promise<ElectronMainModule> {
  const loader = new Function("return import('electron')") as () => Promise<ElectronMainModule>;
  return loader();
}

function senderURL(event: IpcMainInvokeEventLike): string | undefined {
  return event.senderFrame?.url ?? event.sender?.getURL?.();
}

function assertTrustedIpcSender(event: IpcMainInvokeEventLike, isPackaged: boolean): void {
  assertAllowedSenderURL(senderURL(event), isPackaged);
}

function preloadPath(): string {
  return fileURLToPath(new URL("./preload.js", import.meta.url));
}

function rendererFilePath(): string {
  return fileURLToPath(new URL("../dist/index.html", import.meta.url));
}

function createWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: ELECTRON_PRODUCT_NAME,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#f6f4ec",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  };
}

function installWindowSecurity(window: BrowserWindowLike, shell: ShellLike, isPackaged: boolean): void {
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalURL(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetURL) => {
    if (!shouldBlockNavigation(targetURL, window.webContents.getURL(), isPackaged)) {
      return;
    }
    event.preventDefault();
    if (isSafeExternalURL(targetURL)) {
      void shell.openExternal(targetURL);
    }
  });
}

function installContentSecurityPolicy(session: SessionLike, isPackaged: boolean): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [buildRendererContentSecurityPolicy(isPackaged)]
      }
    });
  });
}

function unwrapInput<T>(args: Record<string, unknown> | undefined): T {
  if (args && typeof args === "object" && "input" in args) {
    return args.input as T;
  }
  return args as T;
}

function installRuntimeCommandHandlers(app: AppLike): void {
  const userDataDir = app.getPath("userData");
  const localRuntime = new ElectronLocalRuntime({
    electronUserDataDir: userDataDir,
    legacyRoots: [app.getPath("appData"), userDataDir],
    appVersion: app.getVersion()
  });
  const localHandlers = localRuntime.handlers as unknown as Record<string, (args: Record<string, unknown> | undefined) => Promise<unknown>>;
  const clientUpdateAdapter = createElectronClientUpdateAdapter({
    updateRoot: path.join(userDataDir, "EnterpriseAgentHub", "client-updates"),
    packageVersion: app.getVersion(),
    platform: process.platform as NodeJS.Platform,
    arch: process.arch
  });

  registerLocalCommandHandlers({
    ...localHandlers,
    get_client_app_version: () => clientUpdateAdapter.getClientAppVersion(),
    download_client_update: (args) => clientUpdateAdapter.downloadClientUpdate(unwrapInput(args)),
    verify_client_update: (args) => clientUpdateAdapter.verifyClientUpdate(unwrapInput(args)),
    launch_client_installer: (args) => clientUpdateAdapter.launchClientInstaller(unwrapInput(args))
  });
}

function registerDesktopIpc(ipcMain: IpcMainLike, getWindow: () => BrowserWindowLike | null, shell: ShellLike, isPackaged: boolean): void {
  ipcMain.handle(DESKTOP_IPC_CHANNELS.localCommand, async (event, payload) => {
    assertTrustedIpcSender(event, isPackaged);
    const body = assertRecord(payload, "Desktop local command payload");
    const command = assertDesktopCommandName(body.command);
    const args = body.args === undefined ? undefined : assertRecord(body.args, "Desktop local command args");
    const handler = localCommandHandlers[command];
    if (!handler) {
      throw new Error(`Desktop local command is not implemented yet: ${command}`);
    }
    return handler(args);
  });

  ipcMain.handle(DESKTOP_IPC_CHANNELS.windowControl, (event, payload) => {
    assertTrustedIpcSender(event, isPackaged);
    const body = assertRecord(payload, "Desktop window control payload");
    const action = assertWindowControlAction(body.action);
    const window = getWindow();
    if (!window) return;
    switch (action) {
      case "minimize":
        window.minimize();
        return;
      case "maximize":
        if (window.isMaximized()) {
          window.unmaximize();
        } else {
          window.maximize();
        }
        return;
      case "close":
        window.close();
        return;
      case "startDragging":
        return;
    }
  });

  ipcMain.handle(DESKTOP_IPC_CHANNELS.openExternalURL, async (event, payload) => {
    assertTrustedIpcSender(event, isPackaged);
    const body = assertRecord(payload, "Desktop open external payload");
    const url = typeof body.url === "string" ? body.url : "";
    if (!isSafeExternalURL(url)) {
      throw new Error("Only http/https URLs can be opened externally.");
    }
    await shell.openExternal(url);
  });
}

async function createMainWindow(electron: ElectronMainModule): Promise<BrowserWindowLike> {
  const window = new electron.BrowserWindow(createWindowOptions());
  installWindowSecurity(window, electron.shell, electron.app.isPackaged);

  const devServerURL = process.env.EAH_DESKTOP_DEV_SERVER_URL ?? ELECTRON_DEV_SERVER_URL;
  if (electron.app.isPackaged) {
    await window.loadFile(rendererFilePath());
  } else {
    await window.loadURL(devServerURL);
    window.webContents.openDevTools?.({ mode: "detach" });
  }
  return window;
}

export async function bootstrapElectronDesktop(): Promise<void> {
  const electron = await loadElectron();
  electron.app.setName(ELECTRON_PRODUCT_NAME);
  electron.app.setAppUserModelId(ELECTRON_APP_ID);

  let mainWindow: BrowserWindowLike | null = null;

  await electron.app.whenReady();
  installRuntimeCommandHandlers(electron.app);
  installContentSecurityPolicy(electron.session.defaultSession, electron.app.isPackaged);
  registerDesktopIpc(electron.ipcMain, () => mainWindow, electron.shell, electron.app.isPackaged);
  mainWindow = await createMainWindow(electron);

  electron.app.on("activate", () => {
    if (!mainWindow) {
      void createMainWindow(electron).then((created) => {
        mainWindow = created;
      });
    }
  });

  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
}

void bootstrapElectronDesktop();
