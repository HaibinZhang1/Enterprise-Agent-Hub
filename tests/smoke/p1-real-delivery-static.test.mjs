import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function readRequired(filePath) {
  assert.equal(existsSync(filePath), true, `missing required file: ${filePath}`);
  return readFileSync(filePath, 'utf8');
}

function readOptional(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function readRequiredJson(filePath) {
  return JSON.parse(readRequired(filePath));
}

function readSourceTree(rootPath) {
  if (!existsSync(rootPath)) return '';
  const files = [];
  function walk(currentPath) {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (/\.(?:ts|tsx|mjs|cjs|js)$/u.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }
  walk(rootPath);
  return files.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const p1Client = readRequired('apps/desktop/src/services/p1Client.ts');
const p1ClientCore = readRequired('apps/desktop/src/services/p1Client/core.ts');
const p1ClientAuth = readRequired('apps/desktop/src/services/p1Client/auth.ts');
const p1ClientMarket = readRequired('apps/desktop/src/services/p1Client/market.ts');
const p1ClientPublisher = readRequired('apps/desktop/src/services/p1Client/publisher.ts');
const p1ClientReview = readRequired('apps/desktop/src/services/p1Client/review.ts');
const p1ClientAdmin = readRequired('apps/desktop/src/services/p1Client/admin.ts');
const clientUpdateFlow = readRequired('apps/desktop/src/services/clientUpdateFlow.ts');
const hasDesktopBridge = existsSync('apps/desktop/src/services/desktopBridge.ts');
const desktopBridgeFacade = readOptional('apps/desktop/src/services/desktopBridge.ts');
const desktopBridgeRuntime = readOptional('apps/desktop/src/services/desktopBridge/runtime.ts');
const desktopBridgePackageOps = readOptional('apps/desktop/src/services/desktopBridge/packageOps.ts');
const desktopBridgeConfigOps = readOptional('apps/desktop/src/services/desktopBridge/configOps.ts');
const desktopBridgeNotificationOps = readOptional('apps/desktop/src/services/desktopBridge/notificationOps.ts');
const desktopBridgeBootstrap = readOptional('apps/desktop/src/services/desktopBridge/bootstrap.ts');
const desktopBridgeClientUpdates = readOptional('apps/desktop/src/services/desktopBridge/clientUpdates.ts');
const sharedContracts = readRequired('packages/shared-contracts/src/index.ts');
const desktopPackage = readRequiredJson('apps/desktop/package.json');
const apiPackage = readRequiredJson('apps/api/package.json');
const apiDockerfile = readRequired('apps/api/Dockerfile');
const appTsx = readRequired('apps/desktop/src/App.tsx');
const desktopShellTsx = readRequired('apps/desktop/src/ui/DesktopApp.tsx');
const desktopSectionsTsx = readRequired('apps/desktop/src/ui/desktopSections.tsx');
const desktopOverlaysTsx = readRequired('apps/desktop/src/ui/desktopOverlays.tsx');
const pageCommon = readRequired('apps/desktop/src/ui/pageCommon.tsx');
const desktopShared = readRequired('apps/desktop/src/ui/desktopShared.tsx');
const desktopUiState = readRequired('apps/desktop/src/state/useDesktopUIState.ts');
const workspaceBootstrap = readRequired('apps/desktop/src/state/workspace/facade/useWorkspaceBootstrap.ts');
const domainTypes = readRequired('apps/desktop/src/domain/p1.ts');
const rootPackage = readRequiredJson('package.json');
const liveSmokeScript = readRequired('scripts/verification/p1-live-smoke.mjs');
const liveSmokeLauncher = readRequired('scripts/verification/p1-source-api-live-smoke.sh');
const fullClosureScript = readRequired('scripts/full-closure/run.mjs');
const uiClosureScript = readRequired('scripts/full-closure/run-ui-smoke.mjs');
const nativeClosureScript = readRequired('scripts/full-closure/run-native-smoke.mjs');
const legacyReferenceScanScript = readRequired('scripts/verification/check-legacy-runtime-references.mjs');
const hasElectronRuntime = existsSync('apps/desktop/src-electron/main.ts') && existsSync('apps/desktop/src-electron/preload.ts');
const electronMain = readOptional('apps/desktop/src-electron/main.ts');
const electronPreload = readOptional('apps/desktop/src-electron/preload.ts');
const electronSourceText = readSourceTree('apps/desktop/src-electron');
const legacyRuntimeToken = ['ta', 'uri'].join('');
const legacySourceToken = ['src-', legacyRuntimeToken].join('');
const legacyGlobalToken = ['__', 'TAURI', '__'].join('');
const legacyRuntimePattern = new RegExp(`${legacyRuntimeToken}|${legacySourceToken}|${legacyGlobalToken}`, 'iu');

test('Desktop client defaults to the real API surface and does not auto-fallback to seed data', () => {
  assert.doesNotMatch(p1Client, /\/api\/v1/);
  assert.doesNotMatch(p1Client, /fixtures\/p1SeedData/);
  assert.match(p1ClientCore, /VITE_DESKTOP_API_BASE_URL/);
  assert.match(p1ClientCore, /requireAPIBase/);
  assert.match(p1ClientCore, /p1-login-preferences/);
  assert.match(sharedContracts, /authChangePassword: "\/auth\/change-password"/);
  assert.match(sharedContracts, /authCompleteInitialPasswordChange: "\/auth\/complete-initial-password-change"/);
  assert.match(p1ClientCore, /authorization/);
  assert.match(p1ClientAuth, /P1_API_ROUTES\.authLogin/);
  assert.match(p1ClientAuth, /P1_API_ROUTES\.authChangePassword/);
  assert.match(p1ClientAuth, /P1_API_ROUTES\.authCompleteInitialPasswordChange/);
  assert.match(p1ClientAuth, /loginWithStoredPassword/);
  assert.match(p1ClientAuth, /P1_API_ROUTES\.desktopBootstrap/);
});

test('Electron bridge exposes typed desktop methods while the renderer remains unprivileged', { skip: !hasElectronRuntime || !hasDesktopBridge }, () => {
  assert.match(desktopBridgeFacade, /export interface DesktopBridge/);
  assert.match(desktopBridgeRuntime, /desktopBridge/);
  assert.match(electronPreload, /contextBridge\.exposeInMainWorld\(["']desktopBridge["']/);
  assert.match(electronPreload, /ipcRenderer\.invoke/);
  assert.doesNotMatch(electronPreload, /exposeInMainWorld\([^)]*ipcRenderer/s);
  assert.doesNotMatch(electronPreload, /exposeInMainWorld\([^)]*ipcMain/s);
  assert.doesNotMatch(electronPreload, /exposeInMainWorld\([^)]*(?:fs|child_process)/s);
  assert.match(electronMain, /contextIsolation:\s*true/);
  assert.match(electronMain, /nodeIntegration:\s*false/);
  assert.match(electronSourceText, /setWindowOpenHandler/);
  assert.match(electronSourceText, /will-navigate/);
  assert.match(electronSourceText, /senderFrame|validate.*sender|assert.*sender/i);
});

test('Desktop login defaults do not hardcode demo credentials in the product UI', () => {
  assert.match(desktopOverlaysTsx, /VITE_P1_DEV_LOGIN_PHONE_NUMBER/);
  assert.match(desktopOverlaysTsx, /VITE_P1_DEV_LOGIN_PASSWORD/);
  assert.doesNotMatch(
    desktopOverlaysTsx,
    /const \[form, setForm\] = useState\(\{\s*serverURL: "http:\/\/127\.0\.0\.1:3000",\s*phoneNumber: "13800000001",\s*password: "demo123"/s,
  );
});

test('Electron packaging config exposes Windows installer intent without legacy runtime dependencies', { skip: !hasElectronRuntime }, () => {
  const allDependencies = {
    ...(desktopPackage.dependencies ?? {}),
    ...(desktopPackage.devDependencies ?? {}),
  };
  assert.ok(allDependencies.electron, 'desktop package must depend on Electron');
  assert.ok(allDependencies['electron-builder'], 'desktop package must include electron-builder packaging');
  assert.equal(desktopPackage.devDependencies?.['@' + legacyRuntimeToken + '-apps/cli'], undefined);
  assert.match(desktopPackage.scripts?.['electron:dev'] ?? '', /electron|vite/i);
  assert.match(desktopPackage.scripts?.['electron:build'] ?? '', /electron-builder|electron/i);
  assert.match(desktopPackage.scripts?.['electron:build:windows'] ?? '', /electron-builder|--win|windows/i);
  assert.match(JSON.stringify(desktopPackage), /com\.enterpriseagenthub\.desktop/);
  assert.match(JSON.stringify(desktopPackage), /nsis/i);
});

test('Desktop install flow passes download-ticket into the desktop bridge and restores local state from bootstrap', { skip: !hasDesktopBridge }, () => {
  assert.ok(p1Client.includes('downloadTicket(skill'));
  assert.match(sharedContracts, /skillDownloadTicket: "\/skills\/:skillID\/download-ticket"/);
  assert.match(p1ClientMarket, /packageURL: resolveAPIURL/);
  assert.ok(desktopBridgePackageOps.includes('install_skill_package'));
  assert.ok(desktopBridgePackageOps.includes('update_skill_package'));
  assert.match(desktopBridgePackageOps, /P1_LOCAL_COMMANDS\.installSkillPackage/);
  assert.ok(desktopBridgeConfigOps.includes('save_project_config'));
  assert.ok(desktopBridgeNotificationOps.includes('mark_offline_events_synced'));
  assert.match(desktopBridgeBootstrap, /offlineEvents: \[\]/);
  assert.match(workspaceBootstrap, /mergeLocalInstalls\(remoteSkills,\s*currentLocalBootstrap\)/);
});

test('Client update flow preserves P1 manual download, verify, launch, and event semantics', { skip: !hasElectronRuntime || !hasDesktopBridge }, () => {
  for (const fragment of [
    'requestClientUpdateDownloadTicket',
    'downloadClientUpdate',
    'verifyClientUpdate',
    'launchClientInstaller',
    'download_started',
    'downloaded',
    'hash_failed',
    'signature_failed',
    'installer_started',
    'userConfirmed: true',
  ]) {
    assert.match(clientUpdateFlow, new RegExp(escapeRegExp(fragment)));
  }
  for (const fragment of ['download_client_update', 'verify_client_update', 'launch_client_installer', 'sha256', 'signatureStatus']) {
    assert.match(desktopBridgeClientUpdates, new RegExp(escapeRegExp(fragment)));
  }
  assert.match(electronSourceText, /download_client_update|downloadClientUpdate/);
  assert.match(electronSourceText, /verify_client_update|verifyClientUpdate/);
  assert.match(electronSourceText, /launch_client_installer|launchClientInstaller/);
  assert.match(electronSourceText, /sha256|createHash\(["']sha256["']\)/i);
  assert.match(electronSourceText, /valid|invalid|skipped_non_windows|check_failed/);
});

test('Electron local data migration preserves existing store state with recoverable manifests', { skip: !hasElectronRuntime }, () => {
  assert.match(electronSourceText, /getPath\(["']userData["']\)/);
  assert.match(electronSourceText, /skills\.db/);
  assert.match(electronSourceText, /central-store/);
  assert.match(electronSourceText, /manifest/i);
  assert.match(electronSourceText, /backup/i);
  assert.match(electronSourceText, /idempotent|already migrated|migrationVersion/i);
  assert.doesNotMatch(electronSourceText, /rmSync\([^)]*recursive:\s*true[^)]*legacy/i);
});

test('React desktop app is split into shell, sections, overlays, and UI state contracts', () => {
  assert.match(appTsx, /DesktopApp/);
  assert.match(desktopShellTsx, /useDesktopUIState/);
  assert.match(desktopSectionsTsx, /ManageReviewsPane/);
  assert.match(desktopSectionsTsx, /ManageSection/);
  assert.match(desktopSectionsTsx, /LocalSection/);
  assert.match(desktopSectionsTsx, /提交发布申请/);
  assert.match(desktopSectionsTsx, /openReviewDetail/);
  assert.match(desktopOverlaysTsx, /review-action-\$\{action\}/);
  assert.match(desktopOverlaysTsx, /approveReview/);
  assert.match(desktopOverlaysTsx, /returnReview/);
  assert.match(desktopOverlaysTsx, /rejectReview/);
  assert.match(pageCommon, /PackagePreviewPanel/);
  assert.match(desktopOverlaysTsx, /PackagePreviewPanel/);
  assert.match(desktopSectionsTsx, /下架/);
  assert.match(desktopSectionsTsx, /上架/);
  assert.match(desktopSectionsTsx, /归档/);
  assert.match(desktopSectionsTsx, /currentStatus !== "archived"/);
  assert.match(desktopShared, /reviewActionLabel/);
  assert.match(desktopOverlaysTsx, /TargetsModal/);
  assert.match(desktopOverlaysTsx, /ConnectionStatusModal/);
  assert.match(desktopOverlaysTsx, /当前密码/);
  assert.match(desktopOverlaysTsx, /保存新密码/);
  assert.match(desktopOverlaysTsx, /记住密码/);
  assert.match(desktopOverlaysTsx, /自动登录/);
  assert.match(desktopOverlaysTsx, /首次登录修改密码/);
  assert.match(desktopOverlaysTsx, /initial-password-change/);
  assert.match(desktopOverlaysTsx, /ToolEditorModal/);
  assert.match(desktopUiState, /buildPublishPrecheck/);
});

test('Domain types preserve prototype pages, modal state, preferences, and pending action errors', () => {
  assert.match(domainTypes, /export type NavigationPageID = MenuPermission;/);
  assert.match(domainTypes, /export type PageID = NavigationPageID \| "detail"/);
  assert.match(domainTypes, /export interface PublishDraft/);
  assert.match(domainTypes, /export type DesktopModalState =/);
  assert.match(domainTypes, /export class PendingBackendError/);
  assert.match(domainTypes, /export class PendingLocalCommandError/);
});

test('API production image uses compiled migrate and seed scripts instead of ts-node', () => {
  assert.equal(apiPackage.scripts.migrate, 'node dist/scripts/migrate.js');
  assert.equal(apiPackage.scripts.seed, 'node dist/scripts/seed.js');
  assert.match(apiDockerfile, /COPY apps\/api\/dist/);
  assert.doesNotMatch(apiDockerfile, /ts-node/);
});

test('Live smoke and full-closure scripts exercise API, UI, and Electron desktop gates', () => {
  assert.equal(rootPackage.scripts['p1:live-smoke'], 'node scripts/verification/p1-live-smoke.mjs');
  assert.equal(rootPackage.scripts['p1:source-live-smoke'], 'bash scripts/verification/p1-source-api-live-smoke.sh');
  assert.equal(rootPackage.scripts['p1:ui-closure'], 'node scripts/full-closure/run-ui-smoke.mjs');
  assert.equal(rootPackage.scripts['p1:full-closure'], 'node scripts/full-closure/run.mjs');

  for (const fragment of ['/health', '/auth/login', '/desktop/bootstrap', '/skills', '/notifications', '/publisher/skills', '/admin/users', '/admin/reviews']) {
    assert.match(liveSmokeScript, new RegExp(escapeRegExp(fragment)));
  }

  assert.match(liveSmokeLauncher, /npm run migrate:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /npm run seed:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /npm run start:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /node "\$ROOT_DIR\/scripts\/verification\/p1-live-smoke\.mjs"/);
  assert.match(fullClosureScript, /MINIO_SKILL_PACKAGE_BUCKET/);
  assert.match(fullClosureScript, /"start:dev"/);
  assert.match(fullClosureScript, /"@enterprise-agent-hub\/api"/);
  assert.match(fullClosureScript, /"dev"/);
  assert.match(fullClosureScript, /"@enterprise-agent-hub\/desktop"/);
  assert.doesNotMatch(fullClosureScript, /"cargo"/);
  assert.match(uiClosureScript, /"playwright", "test"/);
  assert.match(nativeClosureScript, /src-electron/);
  assert.match(nativeClosureScript, /p1-real-delivery-static\.test\.mjs/);
  assert.doesNotMatch(nativeClosureScript, /"cargo"/);
});

test('Active delivery and verification files no longer mention the legacy desktop runtime', { skip: !hasElectronRuntime || !hasDesktopBridge }, () => {
  for (const [filePath, text] of [
    ['package.json', JSON.stringify(rootPackage)],
    ['apps/desktop/package.json', JSON.stringify(desktopPackage)],
    ['scripts/full-closure/run.mjs', fullClosureScript],
    ['scripts/full-closure/run-native-smoke.mjs', nativeClosureScript],
    ['scripts/verification/check-legacy-runtime-references.mjs', legacyReferenceScanScript],
    ['apps/desktop/src/services/desktopBridge.ts', desktopBridgeFacade],
    ['apps/desktop/src/services/desktopBridge/runtime.ts', desktopBridgeRuntime],
    ['apps/desktop/src-electron/main.ts', electronMain],
    ['apps/desktop/src-electron/preload.ts', electronPreload],
  ]) {
    assert.doesNotMatch(text, legacyRuntimePattern, `${filePath} keeps a legacy runtime reference`);
  }
});

test('Publishing and review client routes are wired to the live API', () => {
  for (const fragment of [
    '/publisher/skills',
    '/publisher/skills/',
    '/publisher/submissions',
    '/publisher/submissions/',
    '/admin/reviews',
    '/admin/reviews/',
    '/pass-precheck',
    '/approve',
    '/return',
    '/reject',
    '/delist',
    '/relist',
    '/archive',
    '/files',
    '/file-content',
    '/claim',
  ]) {
    assert.match(sharedContracts, new RegExp(escapeRegExp(fragment)));
  }
  assert.match(p1ClientPublisher, /P1_API_ROUTES\.publisherSkills/);
  assert.match(p1ClientPublisher, /P1_API_ROUTES\.publisherSubmissionDetail/);
  assert.match(p1ClientReview, /P1_API_ROUTES\.adminReviews/);
  assert.match(p1ClientReview, /P1_API_ROUTES\.adminReviewApprove/);
  assert.match(p1ClientAdmin, /P1_API_ROUTES\.adminUsers/);
  assert.match(p1ClientAdmin, /P1_API_ROUTES\.adminSkillArchive/);
  assert.match(domainTypes, /export type WorkflowState =/);
  assert.match(domainTypes, /export type PublisherSkillSummary =/);
  assert.match(domainTypes, /export type ReviewPrecheckItem =/);
});

test('Desktop runtime does not import design prototype files as executable code', () => {
  for (const source of [appTsx, desktopShellTsx, desktopSectionsTsx, desktopOverlaysTsx, desktopUiState]) {
    assert.doesNotMatch(source, /docs\/design-ui\/layout-prototype/);
  }
});

test('Electron source tree contains TypeScript files for static gate coverage', { skip: !hasElectronRuntime }, () => {
  const stats = statSync('apps/desktop/src-electron');
  assert.equal(stats.isDirectory(), true);
  assert.match(electronSourceText, /BrowserWindow/);
  assert.match(electronSourceText, /ipcMain\.handle/);
});
