import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts/checks/check-electron-security-policy.mjs');

function runPolicy(args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function config(overrides = {}) {
  return {
    schemaVersion: 1,
    policyId: 'electron-security-policy',
    requiredFiles: {
      main: 'electron/main.ts',
      preload: 'electron/preload.ts',
      ipcContract: 'electron/ipc-contract.ts',
      security: 'electron/security.ts',
    },
    mainRequiredPatterns: [
      'contextIsolation\\s*:\\s*true',
      'nodeIntegration\\s*:\\s*false',
      'sandbox\\s*:\\s*true',
      'webSecurity\\s*:\\s*true',
      'setWindowOpenHandler\\s*\\(',
      'will-navigate',
      'setPermissionRequestHandler\\s*\\(',
      'Content-Security-Policy|csp',
    ],
    preloadRequiredPatterns: ['contextBridge\\.exposeInMainWorld\\s*\\(', 'desktopBridge', 'DESKTOP_IPC_CHANNELS', 'assertLocalCommandName'],
    preloadForbiddenPatterns: ['send\\s*:\\s*ipcRenderer\\.send', 'invoke\\s*:\\s*ipcRenderer\\.invoke', 'invoke\\s*:\\s*async\\s*<'],
    ipcContractRequiredPatterns: ['DESKTOP_IPC_CHANNELS', 'assertLocalCommandName'],
    securityRequiredPatterns: ['assertAllowedSenderURL', 'senderFrame', '127\\.0\\.0\\.1', 'file:', 'buildRendererContentSecurityPolicy'],
    requiredControls: ['contextIsolation true'],
    ...overrides,
  };
}

function writeCompleteFixture(root) {
  mkdirSync(path.join(root, 'electron'), { recursive: true });
  writeFileSync(path.join(root, 'electron/main.ts'), `
const options = { webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } };
mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
const csp = 'Content-Security-Policy';
`);
  writeFileSync(path.join(root, 'electron/preload.ts'), `
import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_IPC_CHANNELS, assertLocalCommandName } from './ipc-contract';
contextBridge.exposeInMainWorld('desktopBridge', { openExternalURL: (url: string) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.openExternalURL, { url }), getLocalBootstrap: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.localCommand, { command: assertLocalCommandName('get_local_bootstrap') }) });
`);
  writeFileSync(path.join(root, 'electron/ipc-contract.ts'), `
export const DESKTOP_IPC_CHANNELS = { localCommand: 'desktop:local-command', windowControl: 'desktop:window-control', openExternalURL: 'desktop:open-external-url' } as const;
export function assertLocalCommandName(command: string) { return command; }
`);
  writeFileSync(path.join(root, 'electron/security.ts'), `
export function assertAllowedSenderURL(event: { senderFrame?: { url?: string } }) {
  const url = event.senderFrame?.url ?? '';
  return url.startsWith('file:') || url.startsWith('http://127.0.0.1:');
}
export function buildRendererContentSecurityPolicy() { return 'default-src self'; }
`);
}

test('repository Electron security policy reports missing Electron files as pending in non-strict mode', () => {
  const result = runPolicy();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Electron security policy passed/);
});

test('complete Electron security fixture passes strict policy', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'electron-security-pass-'));
  try {
    writeCompleteFixture(root);
    writeJson(path.join(root, 'policy.json'), config());

    const result = runPolicy(['--root', root, '--config', 'policy.json', '--strict']);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing origin validation fails strict policy when Electron files exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'electron-security-fail-'));
  try {
    writeCompleteFixture(root);
    writeFileSync(path.join(root, 'electron/security.ts'), 'export function buildRendererContentSecurityPolicy() { return \"default-src self\"; }\n');
    writeJson(path.join(root, 'policy.json'), config());

    const result = runPolicy(['--root', root, '--config', 'policy.json', '--strict']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /security missing required security pattern/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('raw invoke exposure fails preload policy', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'electron-security-raw-'));
  try {
    writeCompleteFixture(root);
    writeFileSync(path.join(root, 'electron/preload.ts'), `
import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_IPC_CHANNELS, assertLocalCommandName } from './ipc-contract';
contextBridge.exposeInMainWorld('desktopBridge', { invoke: ipcRenderer.invoke, openExternalURL: (url: string) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.openExternalURL, { url }), getLocalBootstrap: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.localCommand, { command: assertLocalCommandName('get_local_bootstrap') }) });
`);
    writeJson(path.join(root, 'policy.json'), config());

    const result = runPolicy(['--root', root, '--config', 'policy.json', '--strict']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden raw exposure/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
