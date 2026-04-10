import { renderDialog } from '../components/dialogs.js';
import { renderNav } from '../components/nav.js';
import { renderPreviewPanel } from '../components/preview-panel.js';
import { renderTopbar } from '../components/topbar.js';
import { describeApiError, createApiClient, ApiError } from './api.js';
import { createRefreshController } from './data-refresh.js';
import { createEventsController } from './events.js';
import { createRouter } from './router.js';
import { createDesktopShellState, createStore } from './store.js';
import { createActionIntent, openLoginPrompt, takePendingIntent } from './protected-intent.js';
import { canManage, canReview } from './utils.js';
import { createAuthFeature } from '../features/auth-session.js';
import { createManagementFeature } from '../features/management.js';
import { createMarketFeature } from '../features/market.js';
import { createMySkillFeature } from '../features/my-skill.js';
import { createNotificationsFeature } from '../features/notifications.js';
import { createProjectsFeature } from '../features/projects.js';
import { createReviewFeature } from '../features/review.js';
import { createSettingsFeature } from '../features/settings.js';
import { createToolsFeature } from '../features/tools.js';
import { createHomePage } from '../pages/home.js';
import { createManagementPage } from '../pages/management.js';
import { createMarketPage } from '../pages/market.js';
import { createMySkillPage } from '../pages/my-skill.js';
import { createNotificationsPage } from '../pages/notifications.js';
import { createProjectsPage } from '../pages/projects.js';
import { createReviewPage } from '../pages/review.js';
import { createSettingsPage } from '../pages/settings.js';
import { createToolsPage } from '../pages/tools.js';

const navPanel = document.getElementById('nav-panel');
const topbar = document.getElementById('topbar');
const pageOutlet = document.getElementById('page-outlet');
const dialogHost = document.getElementById('dialog-host');

const store = createStore(createDesktopShellState());
let renderedRoute = null;
let renderVersion = 0;
let router = null;

function showMessage(title, message) {
  store.setState((state) => ({
    ...state,
    dialog: { type: 'message', title, message },
    userMenuOpen: false,
  }));
}

function closeDialog() {
  store.setState((state) => ({
    ...state,
    dialog: null,
  }));
}

function updateFlash(message, tone = 'neutral') {
  store.setState((state) => ({
    ...state,
    flash: message ? { message, tone } : null,
  }));
}

function resetPreview() {
  store.setState((state) => ({
    ...state,
    preview: null,
  }));
}

const app = {
  store,
  setSession(session) {
    store.setState((state) => ({
      ...state,
      session,
      userMenuOpen: false,
      pendingIntent: session ? state.pendingIntent : null,
      notificationBadge: session ? state.notificationBadge : 0,
      reviewBadge: session ? state.reviewBadge : 0,
      realtime: session
        ? state.realtime
        : {
            status: 'idle',
            message: 'Sign in to start realtime desktop updates.',
          },
    }));
  },
};

function handleGlobalError(error) {
  if (!(error instanceof ApiError)) {
    return;
  }

  if (error.kind === 'unauthenticated' && store.getState().session?.user) {
    app.setSession(null);
    openLoginPrompt(store, null, describeApiError(error));
    updateFlash(describeApiError(error), 'warning');
    router?.navigate('home', { replace: true });
    return;
  }

  if (error.kind === 'forbidden') {
    updateFlash(describeApiError(error), 'warning');
    return;
  }

  if (error.kind === 'network_error' || error.kind === 'html_response' || error.kind === 'non_json_response') {
    updateFlash(describeApiError(error), 'danger');
  }
}

app.api = createApiClient({ onGlobalError: handleGlobalError });
app.features = {
  auth: createAuthFeature(app),
  management: createManagementFeature(app),
  market: createMarketFeature(app),
  mySkill: createMySkillFeature(app),
  notifications: createNotificationsFeature(app),
  projects: createProjectsFeature(app),
  review: createReviewFeature(app),
  settings: createSettingsFeature(app),
  tools: createToolsFeature(app),
};

const pages = new Map([
  ['home', createHomePage(app)],
  ['market', createMarketPage(app)],
  ['my-skill', createMySkillPage(app)],
  ['review', createReviewPage(app)],
  ['management', createManagementPage(app)],
  ['tools', createToolsPage(app)],
  ['projects', createProjectsPage(app)],
  ['notifications', createNotificationsPage(app)],
  ['settings', createSettingsPage(app)],
]);

const pageScreens = new Map();
for (const [pageId, page] of pages.entries()) {
  const screen = document.createElement('section');
  screen.className = 'page-screen';
  screen.dataset.pageId = pageId;
  screen.hidden = true;
  page.mount(screen);
  pageScreens.set(pageId, screen);
}
pageOutlet?.replaceChildren(...pageScreens.values());

const refresh = createRefreshController({
  pages,
  getCurrentRoute: () => store.getState().route,
});
const events = createEventsController({
  getSession: () => store.getState().session,
  refresh,
  store,
});

function renderShellChrome(state) {
  navPanel.innerHTML = renderNav(state);
  topbar.innerHTML = renderTopbar(state);
}

function renderDialogHost(state) {
  const dialogMarkup = renderDialog(state.dialog);
  const previewMarkup = renderPreviewPanel(state.preview);
  dialogHost.innerHTML = `${dialogMarkup}${previewMarkup}`;
}

async function syncActivePage(reason = 'state-change') {
  const version = ++renderVersion;
  const route = store.getState().route;

  if (renderedRoute !== route) {
    if (renderedRoute && pageScreens.has(renderedRoute)) {
      pageScreens.get(renderedRoute).hidden = true;
      pages.get(renderedRoute)?.leave();
    }
    renderedRoute = route;
    if (pageScreens.has(route)) {
      pageScreens.get(route).hidden = false;
    }
  }

  await refresh.consume(route);
  if (version !== renderVersion) {
    return;
  }
  await pages.get(route)?.enter({ reason, state: store.getState() });
}

store.subscribe((state) => {
  renderShellChrome(state);
  renderDialogHost(state);
  void syncActivePage('state-change');
});
renderShellChrome(store.getState());
renderDialogHost(store.getState());

async function refreshHealth() {
  try {
    const health = await app.api.request('/health');
    store.setState((state) => ({
      ...state,
      health: {
        status: health.ok ? 'online' : 'offline',
        label: health.ok ? 'Online' : 'Unavailable',
        detail: health.ok ? 'Desktop proxy is reachable.' : 'Desktop proxy reported degraded health.',
        apiBaseUrl: health.apiBaseUrl ?? 'Not configured',
      },
    }));
  } catch (error) {
    store.setState((state) => ({
      ...state,
      health: {
        status: 'offline',
        label: 'Offline',
        detail: describeApiError(error),
        apiBaseUrl: 'Unavailable',
      },
    }));
  }
}

async function loadLocalData() {
  const [toolsResult, projectsResult, settingsResult] = await Promise.allSettled([
    app.features.tools.loadTools(),
    app.features.projects.loadProjects(),
    app.features.settings.loadSettings(),
  ]);

  store.setState((state) => ({
    ...state,
    local: {
      tools:
        toolsResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              items: toolsResult.value.tools ?? [],
              message: toolsResult.value.tools?.length ? '工具健康状态已刷新。' : '还没有发现可管理工具。',
            }
          : {
              status: 'error',
              items: [],
              message: describeApiError(toolsResult.reason),
            },
      projects:
        projectsResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              items: projectsResult.value.projects ?? [],
              currentProjectId: projectsResult.value.currentProjectId ?? null,
              message: projectsResult.value.projects?.length ? '本地项目清单已刷新。' : '尚未注册本地项目。',
            }
          : {
              status: 'error',
              items: [],
              currentProjectId: null,
              message: describeApiError(projectsResult.reason),
            },
      settings:
        settingsResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              data: settingsResult.value.settings ?? null,
              message: '桌面设置已加载。',
            }
          : {
              status: 'error',
              data: null,
              message: describeApiError(settingsResult.reason),
            },
    },
  }));
}

async function loadRemoteData(session) {
  if (!session?.user) {
    store.setState((state) => ({
      ...state,
      notificationBadge: 0,
      reviewBadge: 0,
      remote: {
        market: { status: 'empty', results: [], message: '登录后可浏览市场。' },
        mySkills: { status: 'empty', items: [], message: '登录后可查看我的 Skill 与发布工作台。' },
        notifications: { status: 'empty', items: [], message: '登录后可查看通知。' },
        review: { status: 'empty', queue: null, message: '审核入口仅对 reviewer / admin 可见。' },
        management: { status: 'empty', skills: [], message: '管理入口仅对管理员开放。' },
      },
    }));
    events.connect();
    return;
  }

  const [mySkillsResult, marketResult, notificationsResult, reviewResult, managementResult] = await Promise.allSettled([
    app.features.mySkill.loadOwnedSkills(),
    app.features.market.loadMarket(store.getState().searchQuery),
    app.features.notifications.loadNotifications(),
    canReview(session) ? app.features.review.loadQueue() : Promise.resolve(null),
    canManage(session) ? app.features.management.loadManageableSkills() : Promise.resolve(null),
  ]);

  const notificationsPayload = notificationsResult.status === 'fulfilled' ? notificationsResult.value : null;
  const reviewQueue = reviewResult.status === 'fulfilled' ? reviewResult.value?.queue ?? null : null;

  store.setState((state) => ({
    ...state,
    notificationBadge: notificationsPayload?.badges?.unreadCount ?? 0,
    reviewBadge: reviewQueue?.todo?.length ?? 0,
    remote: {
      mySkills:
        mySkillsResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              items: mySkillsResult.value.skills ?? [],
              message: mySkillsResult.value.skills?.length ? '我的 Skill 已加载。' : '当前账号还没有 Skill。',
            }
          : {
              status: 'error',
              items: [],
              message: describeApiError(mySkillsResult.reason),
            },
      market:
        marketResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              results: marketResult.value.results ?? [],
              message: marketResult.value.results?.length ? '市场列表已刷新。' : '当前没有匹配的市场结果。',
            }
          : {
              status: 'error',
              results: [],
              message: describeApiError(marketResult.reason),
            },
      notifications:
        notificationsResult.status === 'fulfilled'
          ? {
              status: 'loaded',
              items: notificationsPayload.items ?? [],
              message: notificationsPayload.items?.length ? '通知已加载。' : '暂无通知。',
            }
          : {
              status: 'error',
              items: [],
              message: describeApiError(notificationsResult.reason),
            },
      review:
        canReview(session)
          ? reviewResult.status === 'fulfilled'
            ? {
                status: 'loaded',
                queue: reviewQueue,
                message: reviewQueue?.todo?.length ? '审核队列已加载。' : '当前没有待审核条目。',
              }
            : {
                status: 'error',
                queue: null,
                message: describeApiError(reviewResult.reason),
              }
          : {
              status: 'empty',
              queue: null,
              message: '审核入口仅对 reviewer / admin 可见。',
            },
      management:
        canManage(session)
          ? managementResult.status === 'fulfilled'
            ? {
                status: 'loaded',
                skills: managementResult.value?.skills ?? [],
                message: managementResult.value?.skills?.length ? '可管理 Skill 已加载。' : '当前没有可管理 Skill。',
              }
            : {
                status: 'error',
                skills: [],
                message: describeApiError(managementResult.reason),
              }
          : {
              status: 'empty',
              skills: [],
              message: '管理入口仅对管理员开放。',
            },
    },
  }));

  events.connect();
}

async function loadAll() {
  await Promise.all([refreshHealth(), loadLocalData()]);
  let session = null;
  try {
    const payload = await app.features.auth.loadSession();
    session = payload.session ?? null;
  } catch {
    session = null;
    app.setSession(null);
  }
  await loadRemoteData(session);
}

function showLoginDialog(intent, message) {
  openLoginPrompt(store, intent, message);
}

function toggleUserMenu() {
  if (!store.getState().session?.user) {
    showLoginDialog(null, '请先登录企业内网账号。');
    return;
  }
  store.setState((state) => ({
    ...state,
    userMenuOpen: !state.userMenuOpen,
    dialog: null,
  }));
}

function rememberProtectedAction(actionId, route, label, message) {
  showLoginDialog(createActionIntent(actionId, route, label), message);
}

async function restorePendingIntent(intent) {
  if (!intent) {
    router?.navigate('home', { replace: true });
    return;
  }

  if (intent.type === 'route') {
    router?.navigate(intent.pageId, { replace: true });
    return;
  }

  if (intent.route) {
    router?.navigate(intent.route, { replace: true });
  }

  if (intent.actionId === 'publish') {
    updateFlash('登录成功，已回到发布工作台。', 'success');
    return;
  }

  if (intent.actionId === 'market-install') {
    updateFlash('登录成功，已恢复到市场页面，可继续安装 / 启用流程。', 'success');
  }
}

function showConfirmPreview({ owner, title, preview, statusMessage, confirmLabel, onConfirm }) {
  store.setState((state) => ({
    ...state,
    preview: {
      owner,
      mode: 'confirm',
      title,
      preview,
      statusMessage,
      confirmLabel,
      onConfirm,
    },
  }));
}

function showDraftPreview({ owner, title, currentSummary, impact, statusMessage, pathValue, onBuild }) {
  store.setState((state) => ({
    ...state,
    preview: {
      owner,
      mode: 'draft',
      title,
      currentSummary,
      impact,
      statusMessage,
      pathValue,
      onBuild,
    },
  }));
}

async function handlePreviewBuild() {
  const preview = store.getState().preview;
  if (!preview || preview.mode !== 'draft') {
    return;
  }
  try {
    const result = await preview.onBuild(preview.pathValue ?? '');
    showConfirmPreview({
      owner: preview.owner,
      title: preview.title,
      preview: result.preview,
      statusMessage: '预览已生成，确认后再执行实际变更。',
      confirmLabel: preview.confirmLabel ?? '确认变更',
      onConfirm: result.onConfirm,
    });
  } catch (error) {
    updateFlash(error instanceof Error ? error.message : '预览生成失败。', 'danger');
  }
}

async function handlePreviewConfirm() {
  const preview = store.getState().preview;
  if (!preview || preview.mode !== 'confirm') {
    return;
  }
  try {
    await preview.onConfirm();
    resetPreview();
    await loadLocalData();
    updateFlash('本地变更已确认并刷新。', 'success');
  } catch (error) {
    updateFlash(error instanceof Error ? error.message : '确认变更失败。', 'danger');
  }
}

function updatePreviewPath(value) {
  const preview = store.getState().preview;
  if (!preview || preview.mode !== 'draft') {
    return;
  }
  store.setState((state) => ({
    ...state,
    preview: {
      ...state.preview,
      pathValue: value,
    },
  }));
}

async function submitLogin(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  store.setState((state) => ({
    ...state,
    dialog: {
      ...state.dialog,
      type: 'login',
      status: '登录中…',
    },
  }));

  try {
    const result = await app.features.auth.login(payload);
    const pendingIntent = takePendingIntent(store);
    store.setState((state) => ({
      ...state,
      dialog: null,
    }));
    await loadRemoteData(result.session ?? store.getState().session);
    updateFlash(`已登录为 ${result.user?.username ?? result.session?.user?.username ?? '当前用户'}。`, 'success');
    await restorePendingIntent(pendingIntent);
  } catch (error) {
    store.setState((state) => ({
      ...state,
      dialog: {
        ...state.dialog,
        type: 'login',
        status: describeApiError(error),
      },
    }));
  }
}

async function logout() {
  try {
    await app.features.auth.logout();
    await loadRemoteData(null);
    router?.navigate('home', { replace: true });
    updateFlash('已退出登录，受保护内容已立即收起。', 'success');
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function submitPublish(form) {
  if (!store.getState().session?.user) {
    rememberProtectedAction('publish', 'my-skill', '继续发布 Skill', '该功能需要登录后使用。');
    return;
  }

  try {
    await app.features.mySkill.submitPublish(Object.fromEntries(new FormData(form).entries()));
    updateFlash('发布请求已提交到审核工作台。', 'success');
    form.reset();
    const versionInput = form.querySelector('[name="version"]');
    if (versionInput) {
      versionInput.value = '1.0.0';
    }
    await loadRemoteData(store.getState().session);
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function submitProject(form) {
  try {
    await app.features.projects.createProject(Object.fromEntries(new FormData(form).entries()));
    updateFlash('项目已注册。', 'success');
    form.reset();
    await loadLocalData();
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function submitSettings(form) {
  try {
    await app.features.settings.saveSettings(Object.fromEntries(new FormData(form).entries()));
    updateFlash('桌面设置已保存。', 'success');
    await Promise.all([refreshHealth(), loadLocalData()]);
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function performProjectAction(action, projectId) {
  try {
    if (action === 'validate') {
      await app.features.projects.validate(projectId);
      updateFlash(`已验证项目 ${projectId}。`, 'success');
      await loadLocalData();
      return;
    }
    if (action === 'rescan') {
      await app.features.projects.rescan(projectId);
      updateFlash(`已重新扫描项目 ${projectId}。`, 'success');
      await loadLocalData();
      return;
    }
    if (action === 'switch') {
      const result = await app.features.projects.buildSwitchPreview(projectId);
      showConfirmPreview({
        owner: 'projects',
        title: `切换到项目 ${projectId}`,
        preview: result.preview,
        statusMessage: '该切换会先展示预览，再执行真实变更。',
        confirmLabel: '确认切换',
        onConfirm: () => app.features.projects.confirmSwitch(projectId, result.preview.previewId),
      });
      return;
    }
    if (action === 'repair') {
      showDraftPreview({
        owner: 'projects',
        title: `修复项目 ${projectId}`,
        currentSummary: '输入新的本地项目路径后构建修复预览。',
        impact: '项目修复会更新项目路径并触发一次本地重新验证。',
        statusMessage: '请填写新的项目路径。',
        pathValue: '',
        confirmLabel: '确认修复',
        onBuild: async (projectPath) => {
          const result = await app.features.projects.buildRepairPreview(projectId, projectPath);
          return {
            preview: result.preview,
            onConfirm: () => app.features.projects.confirmRepair(projectId, result.preview.previewId),
          };
        },
      });
      return;
    }
    if (action === 'remove') {
      await app.features.projects.remove(projectId);
      updateFlash(`已移除项目 ${projectId}。`, 'success');
      await loadLocalData();
    }
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function performReviewAction(action, ticketId) {
  if (action === 'noop') {
    return;
  }
  try {
    if (action === 'claim') {
      await app.features.review.claim(ticketId);
      updateFlash(`已领取审核 ${ticketId}。`, 'success');
    }
    if (action === 'approve') {
      const comment = window.prompt('Approval comment', 'Approved through desktop workbench.') ?? '';
      await app.features.review.approve(ticketId, comment);
      updateFlash(`已批准审核 ${ticketId}。`, 'success');
    }
    await loadRemoteData(store.getState().session);
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function markNotificationRead(notificationId) {
  try {
    await app.features.notifications.markRead(notificationId);
    updateFlash('通知已标记为已读。', 'success');
    await loadRemoteData(store.getState().session);
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function readAllNotifications() {
  try {
    await app.features.notifications.readAll();
    updateFlash('通知已全部标记为已读。', 'success');
    await loadRemoteData(store.getState().session);
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function buildToolRepair(toolId) {
  try {
    const result = await app.features.tools.buildRepairPreview(toolId);
    showConfirmPreview({
      owner: 'tools',
      title: `修复工具 ${toolId}`,
      preview: result.preview,
      statusMessage: '确认后将执行工具修复。',
      confirmLabel: '确认修复',
      onConfirm: () => app.features.tools.confirmRepair(toolId, result.preview.previewId),
    });
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function scanTools() {
  try {
    await app.features.tools.scan();
    updateFlash('桌面工具已重新扫描。', 'success');
    await loadLocalData();
  } catch (error) {
    updateFlash(describeApiError(error), 'danger');
  }
}

async function handleTopbarClick(event) {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    router?.navigate(routeButton.dataset.route);
    return;
  }

  if (event.target.closest('[data-open-auth]')) {
    showLoginDialog(null, '请通过统一登录对话框完成身份验证。');
    return;
  }

  if (event.target.closest('[data-toggle-user-menu]')) {
    toggleUserMenu();
    return;
  }

  if (event.target.closest('[data-logout-session]')) {
    await logout();
  }
}

async function handlePageClick(event) {
  const protectedAction = event.target.closest('[data-protected-action]');
  if (protectedAction) {
    rememberProtectedAction(
      protectedAction.dataset.protectedAction,
      protectedAction.dataset.routeAfterLogin ?? store.getState().route,
      protectedAction.dataset.actionLabel ?? '继续执行',
      '该功能需要登录后使用。',
    );
    return;
  }

  const toolsScan = event.target.closest('[data-tools-scan]');
  if (toolsScan) {
    await scanTools();
    return;
  }

  const toolsRepair = event.target.closest('[data-tools-repair]');
  if (toolsRepair?.dataset.toolsRepair) {
    await buildToolRepair(toolsRepair.dataset.toolsRepair);
    return;
  }

  const projectAction = event.target.closest('[data-project-action]');
  if (projectAction?.dataset.projectAction && projectAction.dataset.projectId) {
    await performProjectAction(projectAction.dataset.projectAction, projectAction.dataset.projectId);
    return;
  }

  const reviewAction = event.target.closest('[data-review-action]');
  if (reviewAction?.dataset.reviewAction && reviewAction.dataset.ticketId) {
    await performReviewAction(reviewAction.dataset.reviewAction, reviewAction.dataset.ticketId);
    return;
  }

  const tab = event.target.closest('[data-tab]');
  if (tab?.dataset.tab) {
    store.setState((state) => ({
      ...state,
      managementTab: tab.dataset.tab,
    }));
    return;
  }

  const notificationRead = event.target.closest('[data-mark-notification-read]');
  if (notificationRead?.dataset.markNotificationRead) {
    await markNotificationRead(notificationRead.dataset.markNotificationRead);
    return;
  }

  if (event.target.closest('[data-read-all-notifications]')) {
    await readAllNotifications();
    return;
  }

  const marketInstall = event.target.closest('[data-market-install]');
  if (marketInstall?.dataset.marketInstall) {
    showMessage('安装 / 启用', `已连接统一登录拦截；当前可继续对 ${marketInstall.dataset.marketInstall} 接入真实安装流程。`);
  }
}

async function handleDialogClick(event) {
  if (event.target.closest('[data-close-dialog]')) {
    closeDialog();
    return;
  }

  if (event.target.closest('[data-preview-dismiss]')) {
    resetPreview();
    return;
  }

  if (event.target.closest('[data-preview-build]')) {
    await handlePreviewBuild();
    return;
  }

  if (event.target.closest('[data-preview-confirm]')) {
    await handlePreviewConfirm();
  }
}

function attachInteractions() {
  navPanel?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-route]');
    if (button?.dataset.route) {
      router?.navigate(button.dataset.route);
    }
  });

  topbar?.addEventListener('click', (event) => {
    void handleTopbarClick(event);
  });

  topbar?.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-search-form]');
    if (!form) {
      return;
    }
    event.preventDefault();
    const formData = new FormData(form);
    const query = String(formData.get('query') ?? '').trim();
    store.setState((state) => ({
      ...state,
      searchQuery: query,
      userMenuOpen: false,
    }));
    router?.navigate('market');
    void loadRemoteData(store.getState().session);
  });

  pageOutlet?.addEventListener('click', (event) => {
    void handlePageClick(event);
  });

  pageOutlet?.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    event.preventDefault();

    if (form.matches('[data-publish-form]')) {
      void submitPublish(form);
      return;
    }
    if (form.matches('[data-project-form]')) {
      void submitProject(form);
      return;
    }
    if (form.matches('[data-settings-form]')) {
      void submitSettings(form);
    }
  });

  dialogHost?.addEventListener('click', (event) => {
    void handleDialogClick(event);
  });

  dialogHost?.addEventListener('input', (event) => {
    const input = event.target.closest('[data-preview-path]');
    if (input instanceof HTMLInputElement) {
      updatePreviewPath(input.value);
    }
  });

  dialogHost?.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-login-form]');
    if (!form) {
      return;
    }
    event.preventDefault();
    void submitLogin(form);
  });
}

router = createRouter({
  getSession: () => store.getState().session,
  onBlockedRoute(resolved) {
    if (resolved.pendingIntent) {
      showLoginDialog(resolved.pendingIntent, resolved.prompt ?? '该功能需要登录后使用。');
    }
  },
  onRouteChange(pageId) {
    store.setState((state) => ({
      ...state,
      route: pageId,
      userMenuOpen: false,
    }));
  },
});

attachInteractions();
router.start();
loadAll().catch((error) => {
  updateFlash(error instanceof Error ? error.message : 'Desktop shell bootstrap failed.', 'danger');
});
