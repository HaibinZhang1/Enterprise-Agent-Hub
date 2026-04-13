import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const p1Client = readFileSync('apps/desktop/src/services/p1Client.ts', 'utf8');
const tauriBridge = readFileSync('apps/desktop/src/services/tauriBridge.ts', 'utf8');
const desktopPackage = JSON.parse(readFileSync('apps/desktop/package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync('apps/desktop/src-tauri/tauri.conf.json', 'utf8'));
const cargoToml = readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8');
const tauriMain = readFileSync('apps/desktop/src-tauri/src/main.rs', 'utf8');
const apiPackage = JSON.parse(readFileSync('apps/api/package.json', 'utf8'));
const apiDockerfile = readFileSync('apps/api/Dockerfile', 'utf8');
const appTsx = readFileSync('apps/desktop/src/App.tsx', 'utf8');
const desktopShellTsx = readFileSync('apps/desktop/src/ui/DesktopApp.tsx', 'utf8');
const desktopPagesTsx = readFileSync('apps/desktop/src/ui/desktopPages.tsx', 'utf8');
const desktopModalsTsx = readFileSync('apps/desktop/src/ui/desktopModals.tsx', 'utf8');
const desktopUiState = readFileSync('apps/desktop/src/state/useDesktopUIState.ts', 'utf8');
const prototypeActionClient = readFileSync('apps/desktop/src/services/prototypeActionClient.ts', 'utf8');
const domainTypes = readFileSync('apps/desktop/src/domain/p1.ts', 'utf8');
const rootPackage = JSON.parse(readFileSync('package.json', 'utf8'));
const liveSmokeScript = readFileSync('scripts/verification/p1-live-smoke.mjs', 'utf8');
const liveSmokeLauncher = readFileSync('scripts/verification/p1-source-api-live-smoke.sh', 'utf8');

test('Desktop client defaults to the real API surface and does not auto-fallback to seed data', () => {
  assert.doesNotMatch(p1Client, /\/api\/v1/);
  assert.doesNotMatch(p1Client, /fixtures\/p1SeedData/);
  assert.match(p1Client, /VITE_DESKTOP_API_BASE_URL/);
  assert.match(p1Client, /http:\/\/127\.0\.0\.1:3000/);
  assert.match(p1Client, /authorization/);
});

test('Tauri bridge only permits local command mocks behind an explicit env flag', () => {
  assert.match(tauriBridge, /VITE_P1_ALLOW_TAURI_MOCKS/);
  assert.match(tauriBridge, /import\.meta\.env\.DEV && import\.meta\.env\.VITE_P1_ALLOW_TAURI_MOCKS === "true"/);
  assert.match(tauriBridge, /Tauri runtime is unavailable/);
  assert.match(tauriBridge, /if \(!allowTauriMocks\) \{\n\s+await requireInvoke\(\);/);
});

test('Desktop login defaults do not hardcode demo credentials in the product UI', () => {
  assert.match(desktopShellTsx, /VITE_P1_DEV_LOGIN_USERNAME/);
  assert.match(desktopShellTsx, /VITE_P1_DEV_LOGIN_PASSWORD/);
  assert.doesNotMatch(
    desktopShellTsx,
    /const \[form, setForm\] = useState\(\{\s*serverURL: "http:\/\/127\.0\.0\.1:3000",\s*username: "demo",\s*password: "demo123"/s,
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
  assert.match(p1Client, /download-ticket/);
  assert.match(p1Client, /packageURL: resolveAPIURL/);
  assert.ok(tauriBridge.includes('install_skill_package", { downloadTicket }'));
  assert.ok(tauriBridge.includes('update_skill_package", { downloadTicket }'));
  assert.match(tauriBridge, /preferredMode: input\.requestedMode/);
  assert.ok(tauriBridge.includes('save_project_config", { project }'));
  assert.ok(tauriBridge.includes('mark_offline_events_synced", { eventIDs }'));
  assert.match(tauriBridge, /offlineEvents: \[\]/);
  assert.match(readFileSync('apps/desktop/src/state/useP1Workspace.ts', 'utf8'), /mergeLocalInstalls\(remoteSkills,\s*[A-Za-z]+LocalBootstrap\)/);
});

test('React desktop app is split into shell, pages, modals, and UI placeholder contracts', () => {
  assert.match(appTsx, /DesktopApp/);
  assert.match(desktopShellTsx, /useDesktopUIState/);
  assert.match(desktopPagesTsx, /ReviewPage/);
  assert.match(desktopPagesTsx, /ManagePage/);
  assert.match(desktopPagesTsx, /MyInstalledPage/);
  assert.match(desktopPagesTsx, /发布 Skill/);
  assert.match(desktopPagesTsx, /开始审核/);
  assert.match(desktopPagesTsx, /approveReview/);
  assert.match(desktopPagesTsx, /returnReview/);
  assert.match(desktopPagesTsx, /rejectReview/);
  assert.match(desktopPagesTsx, /reviewActionLabel/);
  assert.match(desktopModalsTsx, /TargetsModal/);
  assert.match(desktopModalsTsx, /ConnectionStatusModal/);
  assert.match(desktopModalsTsx, /ToolEditorModal/);
  assert.match(desktopUiState, /buildPublishPrecheck/);
  assert.match(prototypeActionClient, /PendingBackendError/);
  assert.match(prototypeActionClient, /PendingLocalCommandError/);
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

  for (const fragment of ['/health', '/auth/login', '/desktop/bootstrap', '/skills', '/notifications', '/publisher/skills', '/admin/users', '/admin/reviews']) {
    assert.match(liveSmokeScript, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(liveSmokeLauncher, /npm run migrate:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /npm run seed:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /npm run start:dev --workspace @enterprise-agent-hub\/api/);
  assert.match(liveSmokeLauncher, /node "\$ROOT_DIR\/scripts\/verification\/p1-live-smoke\.mjs"/);
});

test('Publishing and review client routes are wired to the live API', () => {
  for (const fragment of [
    '/publisher/skills',
    '/publisher/submissions',
    '/admin/reviews',
    '/pass-precheck',
    '/approve',
    '/return',
    '/reject',
    '/claim'
  ]) {
    assert.match(p1Client, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(domainTypes, /export type WorkflowState =/);
  assert.match(domainTypes, /export interface PublisherSkillSummary/);
  assert.match(domainTypes, /export interface ReviewPrecheckItem/);
});

test('Desktop runtime does not import ui-prototype as executable code', () => {
  for (const source of [appTsx, desktopShellTsx, desktopPagesTsx, desktopModalsTsx, desktopUiState, prototypeActionClient]) {
    assert.doesNotMatch(source, /ui-prototype/);
  }
});
