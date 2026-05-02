import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { LOCAL_COMMAND_NAMES } from "@enterprise-agent-hub/shared-contracts";
import {
  DESKTOP_APPROVED_COMMAND_NAMES,
  DESKTOP_CLIENT_UPDATE_COMMAND_NAMES,
  DESKTOP_IPC_CHANNELS,
  DESKTOP_WINDOW_CONTROL_ACTIONS,
  assertDesktopCommandName,
  assertLocalCommandName,
  assertRecord,
  assertWindowControlAction,
  isDesktopCommandName,
  isLocalCommandName
} from "../src-electron/ipcContract.ts";
import {
  assertAllowedSenderURL,
  buildRendererContentSecurityPolicy,
  getPackagedRendererURL,
  isAllowedRendererURL,
  isSafeExternalURL,
  shouldBlockNavigation
} from "../src-electron/security.ts";

test("desktop IPC contract exposes static channels and shared local command allowlist", () => {
  assert.deepEqual(Object.values(DESKTOP_IPC_CHANNELS), [
    "desktop:local-command",
    "desktop:window-control",
    "desktop:open-external-url"
  ]);
  assert.ok(LOCAL_COMMAND_NAMES.length > 10);
  assert.equal(isLocalCommandName("get_local_bootstrap"), true);
  assert.equal(assertLocalCommandName("pick_project_directory"), "pick_project_directory");
  assert.throws(() => assertLocalCommandName("unknown_command"), /Unsupported desktop local command/);
});

test("desktop approved command allowlist includes local and client update commands", () => {
  assert.ok(DESKTOP_APPROVED_COMMAND_NAMES.includes("get_local_bootstrap"));
  assert.ok(DESKTOP_APPROVED_COMMAND_NAMES.includes("get_client_app_version"));
  assert.deepEqual(DESKTOP_CLIENT_UPDATE_COMMAND_NAMES, [
    "get_client_app_version",
    "download_client_update",
    "verify_client_update",
    "launch_client_installer"
  ]);
  assert.equal(isDesktopCommandName("verify_client_update"), true);
  assert.equal(assertDesktopCommandName("download_client_update"), "download_client_update");
  assert.throws(() => assertDesktopCommandName("raw:send"), /Unsupported desktop command/);
});

test("desktop window controls are explicit and reject unknown actions", () => {
  assert.deepEqual(DESKTOP_WINDOW_CONTROL_ACTIONS, ["minimize", "maximize", "close", "startDragging"]);
  assert.equal(assertWindowControlAction("close"), "close");
  assert.throws(() => assertWindowControlAction("raw:send"), /Unsupported desktop window control action/);
});

test("desktop IPC payload validators reject arrays and primitives", () => {
  assert.deepEqual(assertRecord({ ok: true }, "payload"), { ok: true });
  assert.throws(() => assertRecord([], "payload"), /payload must be an object/);
  assert.throws(() => assertRecord("not-an-object", "payload"), /payload must be an object/);
});

test("renderer origin and navigation policy allows only packaged files or the pinned dev server", () => {
  const packagedRendererURL = getPackagedRendererURL();
  assert.equal(isAllowedRendererURL(packagedRendererURL, true), true);
  assert.equal(isAllowedRendererURL("file:///Applications/EnterpriseAgentHub/index.html", true), false);
  assert.equal(isAllowedRendererURL("https://example.com/app", true), false);
  assert.equal(isAllowedRendererURL("http://127.0.0.1:1420/", false), true);
  assert.equal(isAllowedRendererURL("http://localhost:1420/", false), false);
  assert.equal(isAllowedRendererURL("http://192.168.1.20:1420/", false), false);
  assert.equal(shouldBlockNavigation("file:///tmp/rogue.html", packagedRendererURL, true), true);
  assert.equal(shouldBlockNavigation("https://example.com", "http://127.0.0.1:1420/", false), true);
});

test("packaged IPC rejects local file renderers outside the bundled app entrypoint", () => {
  const packagedRendererURL = getPackagedRendererURL();
  assert.doesNotThrow(() => assertAllowedSenderURL(packagedRendererURL, true));
  assert.throws(() => assertAllowedSenderURL("file:///tmp/rogue.html", true), /Rejected desktop IPC from untrusted renderer origin/);
});

test("external URL and CSP policies stay narrow", () => {
  assert.equal(isSafeExternalURL("https://enterprise.example.com"), true);
  assert.equal(isSafeExternalURL("http://127.0.0.1:1420/help"), true);
  assert.equal(isSafeExternalURL("file:///etc/passwd"), false);
  assert.equal(isSafeExternalURL("javascript:alert(1)"), false);

  const csp = buildRendererContentSecurityPolicy(true);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /default-src \*/);
});

test("preload source exposes explicit local command wrappers without raw Electron APIs", () => {
  const preloadSource = readFileSync(fileURLToPath(new URL("../src-electron/preload.ts", import.meta.url)), "utf8");
  assert.match(preloadSource, /exposeInMainWorld\("desktopBridge"/);
  assert.match(preloadSource, /localCommands/);
  assert.match(preloadSource, /DESKTOP_APPROVED_COMMAND_NAMES\.map/);
  assert.match(preloadSource, /createDesktopCommandWrapper/);
  assert.match(preloadSource, /DESKTOP_IPC_CHANNELS\.localCommand/);
  assert.match(preloadSource, /assertDesktopCommandName/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\([^,]+,\s*ipcRenderer/);
  assert.doesNotMatch(preloadSource, /invoke:\s*async\s*<T>\(command/);
  assert.doesNotMatch(preloadSource, /send\(/);
});

test("main window keeps web security explicitly enabled", () => {
  const mainSource = readFileSync(fileURLToPath(new URL("../src-electron/main.ts", import.meta.url)), "utf8");
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /webSecurity:\s*true/);
  assert.doesNotMatch(mainSource, /webSecurity:\s*false/);
});
