import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const p1Client = readFileSync('apps/desktop/src/services/p1Client.ts', 'utf8');
const p1ClientCore = readFileSync('apps/desktop/src/services/p1Client/core.ts', 'utf8');
const p1ClientAuth = readFileSync('apps/desktop/src/services/p1Client/auth.ts', 'utf8');
const p1ClientMarket = readFileSync('apps/desktop/src/services/p1Client/market.ts', 'utf8');
const p1ClientPublisher = readFileSync('apps/desktop/src/services/p1Client/publisher.ts', 'utf8');
const p1ClientReview = readFileSync('apps/desktop/src/services/p1Client/review.ts', 'utf8');
const p1ClientAdmin = readFileSync('apps/desktop/src/services/p1Client/admin.ts', 'utf8');
const tauriRuntime = readFileSync('apps/desktop/src/services/electronBridge/runtime.ts', 'utf8');
const tauriPackageOps = readFileSync('apps/desktop/src/services/electronBridge/packageOps.ts', 'utf8');
const tauriConfigOps = readFileSync('apps/desktop/src/services/electronBridge/configOps.ts', 'utf8');
const tauriNotificationOps = readFileSync('apps/desktop/src/services/electronBridge/notificationOps.ts', 'utf8');
const tauriBootstrap = readFileSync('apps/desktop/src/services/electronBridge/bootstrap.ts', 'utf8');
const sharedContracts = readFileSync('packages/shared-contracts/src/index.ts', 'utf8');
const desktopPackage = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync('apps/desktop/src-tauri/tauri.conf.json', 'utf8'));
const cargoToml = readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8');
const tauriMain = readFileSync('apps/desktop/src-tauri/src/main.rs', 'utf8');
const apiPackage = JSON.parse(readFileSync('apps/api/package.json', 'utf8'));
const apiDockerfile = readFileSync('apps/api/Dockerfile', 'utf8');
const appTsx = readFileSync('apps/desktop/src/App.tsx', 'utf8');
const desktopShellTsx = readFileSync('apps/desktop/src/ui/DesktopApp.tsx', 'utf8');
const desktopSectionsTsx = readFileSync('apps/desktop/src/ui/desktopSections.tsx', 'utf8');
const desktopOverlaysTsx = readFileSync('apps/desktop/src/ui/desktopOverlays.tsx', 'utf8');
const pageCommon = readFileSync('apps/desktop/src/ui/pageCommon.tsx', 'utf8');
const desktopShared = readFileSync('apps/desktop/src/ui/desktopShared.tsx', 'utf8');
const desktopUiState = readFileSync('apps/desktop/src/state/useDesktopUIState.ts', 'utf8');
const workspaceBootstrap = readFileSync('apps/desktop/src/state/workspace/facade/useWorkspaceBootstrap.ts', 'utf8');
const domainTypes = readFileSync('apps/desktop/src/domain/p1.ts', 'utf8');
const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
const liveSmokeScript = readFileSync('scripts/verification/p1-live-smoke.mjs', 'utf8');
const liveSmokeLauncher = readFileSync('scripts/verification/p1-source-api-live-smoke.sh', 'utf8');
const fullClosureScript = readFileSync('scripts/full-closure/run.mjs', 'utf8');
const uiClosureScript = readFileSync('scripts/full-closure/run-ui-smoke.mjs', 'utf8');
const nativeClosureScript = readFileSync('scripts/full-closure/run-native-smoke.mjs', 'utf8');
const nativeClosureTest = readFileSync('apps/desktop/src-tauri/tests/full_closure.rs', 'utf8');

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

test('Tauri bridge only permits local command mocks behind an explicit env flag', () => {
  assert.match(tauriRuntime, /VITE_P1_ALLOW_ELECTRON_MOCKS/);
  assert.match(tauriRuntime, /Boolean\(importMetaEnv\?\.DEV\) && importMetaEnv\?\.VITE_P1_ALLOW_ELECTRON_MOCKS === "true"/);
  assert.match(tauriRuntime, /Electron runtime is unavailable/);
  assert.match(tauriRuntime, /if \(allowElectronMocks\) \{/);
  assert.match(tauriRuntime, /throw new Error\("Electron mock dispatcher must be handled by the caller"\)/);
  assert.match(tauriRuntime, /return getInvoke\(\) === null && !allowElectronMocks;/);
});

test('Desktop login defaults do not hardcode demo credentials in the product UI', () => {
  assert.match(desktopOverlaysTsx, /VITE_P1_DEV_LOGIN_PHONE_NUMBER/);
  assert.match(desktopOverlaysTsx, /VITE_P1_DEV_LOGIN_PASSWORD/);
  assert.doesNotMatch(
    desktopOverlaysTsx,
    /const \[form, setForm\] = useState\(\{\s*serverURL: "http:\/\/127\.0\.0\.1:3000",\s*phoneNumber: "13800000001",\s*password: "demo123"/s,
  );
});

test('Tauri packaging config exposes Windows installer intent and command registration', () => {
  assert.equal(tauriConfig.identifier, 'com.enterpriseagenthub.desktop');
  assert.deepEqual(tauriConfig.bundle.targets, ['nsis']);
  assert.match(desktopPackage.scripts['tauri:build:windows'], /x86_64-pc-windows-msvc/);
  assert.match(cargoToml, /tauri =/);
  for (const command of ['get_local_bootstrap', 'install_skill_package', 'enable_skill', 'disable_skill', 'uninstall_skill', 'save_project_config', 'mark_offline_events_synced']) {
    assert.match(tauriMain, new RegExp(command));
  }
  assert.doesNotMatch(tauriMain, /install_skill_package requires/);
  assert.doesNotMatch(tauriMain, /enable_skill requires/);
  assert.doesNotMatch(tauriMain, /list_local_installs requires/);
});

test('Desktop install flow passes download-ticket into Tauri and restores local state from SQLite bootstrap', () => {
  assert.ok(p1Client.includes('downloadTicket(skill'));
  assert.match(sharedContracts, /skillDownloadTicket: "\/skills\/:skillID\/download-ticket"/);
  assert.match(p1ClientMarket, /packageURL: resolveAPIURL/);
  assert.ok(tauriPackageOps.includes('install_skill_package'));
  assert.ok(tauriPackageOps.includes('update_skill_package'));
  assert.match(tauriPackageOps, /callLocalCommand\(invoke, P1_LOCAL_COMMANDS\.installSkillPackage, \{ downloadTicket \}/);
  assert.ok(tauriConfigOps.includes('save_project_config'));
  assert.ok(tauriNotificationOps.includes('mark_offline_events_synced'));
  assert.match(tauriBootstrap, /offlineEvents: \[\]/);
  assert.match(workspaceBootstrap, /mergeLocalInstalls\(remoteSkills,\s*currentLocalBootstrap\)/);
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

test('Domain types now support prototype pages, modal state, preferences, and pending action errors', () => {
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

test('Live smoke scripts exist for real source-start API verification', () => {
  assert.equal(rootPackage.scripts['p1:live-smoke'], 'node scripts/verification/p1-live-smoke.mjs');
  assert.equal(rootPackage.scripts['p1:source-live-smoke'], 'bash scripts/verification/p1-source-api-live-smoke.sh');
  assert.equal(rootPackage.scripts['p1:ui-closure'], 'node scripts/full-closure/run-ui-smoke.mjs');
  assert.equal(rootPackage.scripts['p1:native-closure'], 'node scripts/full-closure/run-native-smoke.mjs');
  assert.equal(rootPackage.scripts['p1:full-closure'], 'node scripts/full-closure/run.mjs');

  for (const fragment of ['/health', '/auth/login', '/desktop/bootstrap', '/skills', '/notifications', '/publisher/skills', '/admin/users', '/admin/reviews']) {
    assert.match(liveSmokeScript, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
  assert.match(uiClosureScript, /"playwright", "test"/);
  assert.match(nativeClosureScript, /"cargo",\s*\[/);
  assert.match(nativeClosureScript, /"--test",\s*"full_closure"/);
  assert.match(nativeClosureTest, /download_ticket/);
  assert.match(nativeClosureTest, /enable_skill/);
  assert.match(nativeClosureTest, /uninstall_skill/);
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
    '/claim'
  ]) {
    assert.match(sharedContracts, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
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
