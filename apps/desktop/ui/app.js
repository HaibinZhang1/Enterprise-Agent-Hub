const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const sessionMeta = document.getElementById('session-meta');
const reloadAll = document.getElementById('reload-all');
const marketQuery = document.getElementById('market-query');
const connectionStatus = document.getElementById('connection-status');
const serverUrl = document.getElementById('server-url');
const publishForm = document.getElementById('publish-form');
const publishState = document.getElementById('publish-state');
const publishStatus = document.getElementById('publish-status');
const reviewStatus = document.getElementById('review-status');
const toolsRescan = document.getElementById('tools-rescan');
const toolsStatus = document.getElementById('tools-status');
const projectForm = document.getElementById('project-form');
const projectsStatus = document.getElementById('projects-status');
const settingsForm = document.getElementById('settings-form');
const settingsStatus = document.getElementById('settings-status');
const previewPanel = document.getElementById('preview-panel');
const previewTitle = document.getElementById('preview-heading');
const previewTarget = document.getElementById('preview-target');
const previewStatus = document.getElementById('preview-status');
const previewCurrent = document.getElementById('preview-current');
const previewIncoming = document.getElementById('preview-incoming');
const previewImpact = document.getElementById('preview-impact');
const previewIssues = document.getElementById('preview-issues');
const previewPathRow = document.getElementById('preview-path-row');
const previewPathInput = document.getElementById('preview-path-input');
const previewBuild = document.getElementById('preview-build');
const previewConfirm = document.getElementById('preview-confirm');
const previewCancel = document.getElementById('preview-cancel');

const views = {
  tools: {
    output: document.getElementById('tools-output'),
    state: document.getElementById('tools-state'),
    empty: 'Scan the machine to load writable-path health for the desktop toolchain.',
    error: 'Unable to load tools.',
  },
  projects: {
    output: document.getElementById('projects-output'),
    state: document.getElementById('projects-state'),
    empty: 'Register a local project path to start multi-project management.',
    error: 'Unable to load projects.',
  },
  settings: {
    output: document.getElementById('settings-output'),
    state: document.getElementById('settings-state'),
    empty: 'Desktop settings will appear here after the local shell loads.',
    error: 'Unable to load settings.',
  },
  mySkills: {
    output: document.getElementById('my-skills-output'),
    state: document.getElementById('my-skills-state'),
    empty: 'Sign in to load your skills.',
    error: 'Unable to load My Skill.',
  },
  market: {
    output: document.getElementById('market-output'),
    state: document.getElementById('market-state'),
    empty: 'Sign in to browse the market.',
    error: 'Unable to load the market.',
  },
  notifications: {
    output: document.getElementById('notifications-output'),
    state: document.getElementById('notifications-state'),
    empty: 'Notification status will appear after sign in.',
    error: 'Unable to load notifications.',
  },
  events: {
    output: document.getElementById('events-output'),
    state: document.getElementById('events-state'),
    empty: 'Live notification events will stream here when available.',
    error: 'Realtime stream unavailable.',
  },
  reviewQueue: {
    output: document.getElementById('review-queue-output'),
    state: document.getElementById('review-queue-state'),
    empty: 'Assigned tickets will appear here for reviewer and administrator sessions.',
    error: 'Unable to load the review queue.',
  },
  management: {
    output: document.getElementById('management-output'),
    state: document.getElementById('management-state'),
    empty: 'Manageable skills load here for administrator sessions.',
    error: 'Unable to load manageable skills.',
  },
};

let eventSource = null;
let currentSession = null;
let currentProjects = [];
let previewContext = null;

function setState(viewName, state, label) {
  const view = views[viewName];
  view.state.dataset.state = state;
  view.state.textContent = label ?? state;
}

function clearView(viewName, message) {
  const view = views[viewName];
  view.output.className = 'data-view empty-state';
  view.output.textContent = message;
}

function renderError(viewName, error) {
  const view = views[viewName];
  setState(viewName, 'error', 'Error');
  view.output.className = 'data-view error-state';
  view.output.textContent = `${view.error}\n${error instanceof Error ? error.message : String(error)}`;
}

function createItemCard({ title, body, meta = [], footer = null }) {
  const card = document.createElement('div');
  card.className = 'item-card';

  const heading = document.createElement('h3');
  heading.textContent = title;
  card.append(heading);

  if (body) {
    if (body instanceof Node) {
      card.append(body);
    } else {
      const paragraph = document.createElement('p');
      paragraph.textContent = body;
      card.append(paragraph);
    }
  }

  if (meta.length > 0) {
    const metaRow = document.createElement('div');
    metaRow.className = 'item-meta';
    for (const item of meta) {
      const span = document.createElement('span');
      span.textContent = item;
      metaRow.append(span);
    }
    card.append(metaRow);
  }

  if (footer) {
    card.append(footer);
  }

  return card;
}

function renderCards(viewName, entries, mapEntry) {
  const view = views[viewName];
  view.output.replaceChildren();
  view.output.className = 'data-view data-list';

  if (!entries || entries.length === 0) {
    setState(viewName, 'empty', 'Empty');
    clearView(viewName, view.empty);
    return;
  }

  setState(viewName, 'loaded', `${entries.length} loaded`);
  for (const entry of entries) {
    view.output.append(createItemCard(mapEntry(entry)));
  }
}

async function json(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.reason || payload.code || `Request failed: ${response.status}`);
  }
  return payload;
}

function roleCode(session) {
  return session?.user?.roleCode ?? '';
}

function canReview(session) {
  const code = roleCode(session);
  return code.startsWith('review_admin') || code.startsWith('system_admin');
}

function canManage(session) {
  return roleCode(session).includes('admin');
}

function parseDepartmentIds(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseScanCommands(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function setPublishState(state, label) {
  publishState.dataset.state = state;
  publishState.textContent = label ?? state;
}

function setPublishEnabled(enabled) {
  for (const element of publishForm.elements) {
    if ('disabled' in element) {
      element.disabled = !enabled;
    }
  }
}

function updateSession(session) {
  currentSession = session ?? null;
  sessionMeta.textContent = session?.user ? `${session.user.username} (${session.user.roleCode ?? 'user'})` : 'Not signed in';
}

function formatIssues(issues) {
  return Array.isArray(issues) && issues.length > 0 ? issues.join(' ') : 'No blocking issues detected.';
}

function summarizePreviewSide(summary) {
  if (!summary) {
    return 'No data available.';
  }
  return [
    summary.displayName ?? summary.projectId ?? summary.installPath ?? summary.skillId ?? 'Unknown target',
    summary.projectPath ?? summary.installPath ?? summary.healthState ?? summary.version ?? null,
    Array.isArray(summary.issues) && summary.issues.length > 0 ? summary.issues.join(' ') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

async function cancelPreview(previewId) {
  await json(`/api/previews/${encodeURIComponent(previewId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

function resetPreviewFields() {
  previewTarget.textContent = 'No preview';
  previewCurrent.textContent = 'No active preview.';
  previewIncoming.textContent = 'No active preview.';
  previewImpact.textContent = 'No active preview.';
  previewIssues.textContent = 'No active preview.';
  previewStatus.textContent = 'Select a local action to preview the exact mutation before it runs.';
  previewPathRow.hidden = true;
  previewPathInput.value = '';
  previewBuild.hidden = true;
  previewConfirm.hidden = true;
  previewConfirm.textContent = 'Confirm change';
}

function hidePreviewPanel() {
  previewContext = null;
  resetPreviewFields();
  previewPanel.hidden = true;
}

function showPreviewDraft(input) {
  previewContext = Object.freeze({
    mode: 'draft',
    title: input.title,
    targetLabel: input.targetLabel,
    currentSummary: input.currentSummary,
    impact: input.impact,
    issues: input.issues ?? [],
    statusTarget: input.statusTarget,
    buildPreview: input.buildPreview,
  });
  previewPanel.hidden = false;
  previewTitle.textContent = input.title;
  previewTarget.textContent = input.targetLabel;
  previewCurrent.textContent = input.currentSummary;
  previewIncoming.textContent = 'Build a preview to inspect the exact incoming state before the change runs.';
  previewImpact.textContent = input.impact;
  previewIssues.textContent = formatIssues(input.issues);
  previewStatus.textContent = 'Provide the local change input, then build a preview before confirming anything.';
  previewPathRow.hidden = false;
  previewBuild.hidden = false;
  previewConfirm.hidden = true;
  previewPathInput.value = input.pathValue ?? '';
}

function showPreviewConfirmation(input) {
  previewContext = Object.freeze({
    mode: 'confirm',
    preview: input.preview,
    title: input.title,
    targetLabel: input.targetLabel,
    confirmLabel: input.confirmLabel,
    successMessage: input.successMessage,
    statusTarget: input.statusTarget,
    confirmRequest: input.confirmRequest,
  });
  previewPanel.hidden = false;
  previewTitle.textContent = input.title;
  previewTarget.textContent = input.targetLabel;
  previewCurrent.textContent = summarizePreviewSide(input.preview.currentLocalSummary);
  previewIncoming.textContent = summarizePreviewSide(input.preview.incomingSummary);
  previewImpact.textContent = input.preview.consequenceSummary ?? 'No preview impact summary was returned.';
  previewIssues.textContent = formatIssues(input.preview.incomingSummary?.issues);
  previewStatus.textContent = 'Review the exact mutation. The change will only run after you confirm this preview.';
  previewPathRow.hidden = true;
  previewBuild.hidden = true;
  previewConfirm.hidden = false;
  previewConfirm.textContent = input.confirmLabel;
}

function setLocalStatus(target, message) {
  if (target === 'tools') {
    toolsStatus.textContent = message;
    return;
  }
  if (target === 'projects') {
    projectsStatus.textContent = message;
    return;
  }
  settingsStatus.textContent = message;
}

function renderReviewQueue(queue) {
  const output = views.reviewQueue.output;
  output.replaceChildren();
  output.className = 'data-view data-list';

  const groups = [
    ['Todo', queue?.todo ?? []],
    ['In Progress', queue?.inProgress ?? []],
    ['Done', queue?.done ?? []],
  ];
  const total = groups.reduce((count, [, entries]) => count + entries.length, 0);
  if (total === 0) {
    setState('reviewQueue', 'empty', 'Empty');
    clearView('reviewQueue', views.reviewQueue.empty);
    return;
  }

  setState('reviewQueue', 'loaded', `${total} tickets`);

  for (const [label, entries] of groups) {
    if (entries.length === 0) {
      continue;
    }
    const section = document.createElement('section');
    section.className = 'queue-group';

    const heading = document.createElement('h3');
    heading.className = 'queue-group-title';
    heading.textContent = `${label} (${entries.length})`;
    section.append(heading);

    const list = document.createElement('div');
    list.className = 'queue-group-list';

    for (const ticket of entries) {
      const body = document.createElement('div');

      const summary = document.createElement('p');
      summary.textContent = `Skill ${ticket.skillId} · reviewer ${ticket.reviewerId}`;
      body.append(summary);

      if (ticket.decision?.comment || ticket.resolution?.comment) {
        const comment = document.createElement('p');
        comment.textContent = ticket.decision?.comment ?? ticket.resolution?.comment ?? '';
        body.append(comment);
      }

      const actions = document.createElement('div');
      actions.className = 'item-actions';
      if (ticket.status === 'todo') {
        const claimButton = document.createElement('button');
        claimButton.type = 'button';
        claimButton.dataset.reviewAction = 'claim';
        claimButton.dataset.ticketId = ticket.ticketId;
        claimButton.textContent = 'Claim';
        actions.append(claimButton);
      }
      if (ticket.status === 'in_progress' && ticket.claimedBy === currentSession?.user?.userId) {
        const approveButton = document.createElement('button');
        approveButton.type = 'button';
        approveButton.dataset.reviewAction = 'approve';
        approveButton.dataset.ticketId = ticket.ticketId;
        approveButton.textContent = 'Approve';
        actions.append(approveButton);
      }

      list.append(
        createItemCard({
          title: ticket.ticketId ?? 'Review ticket',
          body,
          meta: [
            ticket.status,
            ticket.packageId,
            ticket.claimedBy ? `claimed by ${ticket.claimedBy}` : null,
            ticket.claimExpiresAt ? `claim expires ${ticket.claimExpiresAt}` : null,
            ticket.needsSlaWarning ? 'SLA warning' : null,
          ].filter(Boolean),
          footer: actions.childElementCount > 0 ? actions : null,
        }),
      );
    }

    section.append(list);
    output.append(section);
  }
}

function renderManagementSkills(skills) {
  renderCards('management', skills ?? [], (skill) => ({
    title: skill.title ?? skill.skillId ?? 'Manageable skill',
    body: skill.summary ?? 'No summary provided.',
    meta: [
      skill.skillId,
      skill.status,
      skill.publishedVersion ? `published ${skill.publishedVersion}` : 'unpublished',
      skill.visibility,
    ].filter(Boolean),
  }));
}

function renderTools(tools) {
  renderCards('tools', tools ?? [], (tool) => {
    const body = document.createElement('div');
    const path = document.createElement('p');
    path.textContent = `Install path: ${tool.installPath}`;
    body.append(path);

    const issues = document.createElement('p');
    issues.textContent = formatIssues(tool.issues);
    body.append(issues);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    if (tool.actions?.canRepair) {
      const repair = document.createElement('button');
      repair.type = 'button';
      repair.className = 'secondary';
      repair.dataset.toolsAction = 'repair';
      repair.dataset.toolId = tool.toolId;
      repair.textContent = 'Preview repair';
      actions.append(repair);
    }

    return {
      title: tool.displayName,
      body,
      meta: [tool.toolId, tool.healthLabel, tool.updatedAt].filter(Boolean),
      footer: actions,
    };
  });
  toolsStatus.textContent = 'Tools reflect the current desktop authority model and writable-path health.';
}

function renderProjects(projects) {
  currentProjects = projects ?? [];
  renderCards('projects', currentProjects, (project) => {
    const body = document.createElement('div');
    const path = document.createElement('p');
    path.textContent = `Path: ${project.projectPath}`;
    body.append(path);

    const summary = document.createElement('p');
    summary.textContent = formatIssues(project.issues);
    body.append(summary);

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const validate = document.createElement('button');
    validate.type = 'button';
    validate.className = 'secondary';
    validate.dataset.projectAction = 'validate';
    validate.dataset.projectId = project.projectId;
    validate.textContent = 'Validate';
    actions.append(validate);

    const rescan = document.createElement('button');
    rescan.type = 'button';
    rescan.className = 'secondary';
    rescan.dataset.projectAction = 'rescan';
    rescan.dataset.projectId = project.projectId;
    rescan.textContent = 'Rescan';
    actions.append(rescan);

    const switchProject = document.createElement('button');
    switchProject.type = 'button';
    switchProject.dataset.projectAction = 'switch';
    switchProject.dataset.projectId = project.projectId;
    switchProject.textContent = project.isCurrent ? 'Preview switch again' : 'Preview switch';
    actions.append(switchProject);

    const repair = document.createElement('button');
    repair.type = 'button';
    repair.className = 'secondary';
    repair.dataset.projectAction = 'repair';
    repair.dataset.projectId = project.projectId;
    repair.textContent = 'Preview repair';
    actions.append(repair);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.dataset.projectAction = 'remove';
    remove.dataset.projectId = project.projectId;
    remove.textContent = 'Remove';
    actions.append(remove);

    return {
      title: project.displayName,
      body,
      meta: [project.projectId, project.healthLabel, project.isCurrent ? 'current project' : null].filter(Boolean),
      footer: actions,
    };
  });
  projectsStatus.textContent = 'Project switch and repair actions stay preview-first with an explicit second confirmation.';
}

function renderSettingsSummary(settings) {
  settingsForm.querySelector('[name="apiBaseUrl"]').value = settings.execution.apiBaseUrl ?? '';
  settingsForm.querySelector('[name="scanCommands"]').value = (settings.execution.scanCommands ?? []).join(', ');
  settingsForm.querySelector('[name="defaultProjectBehavior"]').value = settings.execution.defaultProjectBehavior ?? 'last-active';
  settingsForm.querySelector('[name="appearance"]').value = settings.desktop.appearance ?? 'system';
  settingsForm.querySelector('[name="updateChannel"]').value = settings.desktop.updateChannel ?? 'stable';

  const accountSummary = settings.account.currentSessionUser
    ? `${settings.account.currentSessionUser.username} (${settings.account.currentSessionUser.roleCode ?? 'user'})`
    : 'No active session';

  renderCards('settings', [
    {
      title: 'Execution settings',
      body: `API base URL: ${settings.execution.apiBaseUrl}`,
      meta: [
        `scan ${settings.execution.scanCommands.join(', ')}`,
        `default project ${settings.execution.defaultProjectBehavior}`,
      ],
    },
    {
      title: 'Desktop preferences',
      body: `Appearance: ${settings.desktop.appearance} · Update channel: ${settings.desktop.updateChannel}`,
      meta: [accountSummary, settings.storage.summary],
    },
  ], (entry) => entry);

  settingsStatus.textContent = 'Execution-critical connectivity and scan rules are editable here. SQLite remains managed internally.';
}

async function refreshConnectionStatus() {
  try {
    const health = await json('/health');
    connectionStatus.textContent = health.ok ? 'Online' : 'Unavailable';
    serverUrl.textContent = health.apiBaseUrl ?? 'Not configured';
  } catch (error) {
    connectionStatus.textContent = 'Offline';
    serverUrl.textContent = error instanceof Error ? error.message : 'Health check failed';
  }
}

async function loadLocalViews() {
  for (const viewName of ['tools', 'projects', 'settings']) {
    setState(viewName, 'loading', 'Loading…');
  }

  const [toolsResult, projectsResult, settingsResult] = await Promise.allSettled([
    json('/api/tools'),
    json('/api/projects'),
    json('/api/settings'),
  ]);

  if (toolsResult.status === 'fulfilled') {
    renderTools(toolsResult.value.tools ?? []);
  } else {
    renderError('tools', toolsResult.reason);
    toolsStatus.textContent = toolsResult.reason instanceof Error ? toolsResult.reason.message : 'Tool scan failed.';
  }

  if (projectsResult.status === 'fulfilled') {
    renderProjects(projectsResult.value.projects ?? []);
  } else {
    renderError('projects', projectsResult.reason);
    projectsStatus.textContent = projectsResult.reason instanceof Error ? projectsResult.reason.message : 'Project load failed.';
  }

  if (settingsResult.status === 'fulfilled') {
    renderSettingsSummary(settingsResult.value.settings);
  } else {
    renderError('settings', settingsResult.reason);
    settingsStatus.textContent = settingsResult.reason instanceof Error ? settingsResult.reason.message : 'Settings load failed.';
  }
}

function renderSignedOutRemoteState() {
  renderCards('mySkills', [], () => null);
  renderCards('market', [], () => null);
  renderCards('notifications', [], () => null);
  setState('reviewQueue', 'empty', 'Role gated');
  clearView('reviewQueue', 'Review queue unlocks for review_admin and system_admin roles.');
  setState('management', 'empty', 'Role gated');
  clearView('management', 'Skill management is reserved for administrator sessions.');
  setPublishState('empty', 'Sign in required');
  setPublishEnabled(false);
  publishStatus.textContent = 'Sign in to stage a package and submit it for review.';
  reviewStatus.textContent = 'Review actions unlock for review_admin and system_admin roles.';
}

async function loadRemoteViews(session) {
  for (const viewName of ['mySkills', 'market', 'notifications', 'reviewQueue', 'management']) {
    setState(viewName, 'loading', 'Loading…');
  }

  if (!session?.user) {
    renderSignedOutRemoteState();
    return;
  }

  setPublishState('loaded', 'Ready');
  setPublishEnabled(true);
  publishStatus.textContent = 'Prepare a package, then upload and submit it for review.';

  const results = await Promise.allSettled([
    json('/api/skills/my'),
    json(`/api/market?query=${encodeURIComponent(marketQuery.value || '')}`),
    json('/api/notifications'),
    canReview(session) ? json('/api/reviews') : Promise.resolve(null),
    canManage(session) ? json('/api/skills/manageable') : Promise.resolve(null),
  ]);

  const [mySkills, market, notifications, reviewQueue, management] = results;

  if (mySkills.status === 'fulfilled') {
    renderCards('mySkills', mySkills.value.skills ?? [], (skill) => ({
      title: skill.title ?? skill.skillId ?? 'Untitled skill',
      body: skill.summary ?? skill.description ?? 'No summary provided.',
      meta: [skill.skillId, skill.status, skill.version].filter(Boolean),
    }));
  } else {
    renderError('mySkills', mySkills.reason);
  }

  if (market.status === 'fulfilled') {
    renderCards('market', market.value.results ?? [], (skill) => ({
      title: skill.title ?? skill.skillId ?? 'Untitled market entry',
      body: skill.summary ?? skill.description ?? 'No summary provided.',
      meta: [skill.skillId, skill.canInstall ? 'installable' : 'summary only', skill.updatedAt].filter(Boolean),
    }));
  } else {
    renderError('market', market.reason);
  }

  if (notifications.status === 'fulfilled') {
    renderCards('notifications', notifications.value.items ?? [], (item) => ({
      title: item.title ?? item.category ?? 'Notification',
      body: item.body ?? item.message ?? '',
      meta: [item.category, item.createdAt, item.readAt ? 'read' : 'unread'].filter(Boolean),
    }));
  } else {
    renderError('notifications', notifications.reason);
  }

  if (canReview(session)) {
    if (reviewQueue.status === 'fulfilled') {
      reviewStatus.textContent = 'Assigned review tickets load here. Claim a todo ticket before approving it.';
      renderReviewQueue(reviewQueue.value?.queue);
    } else {
      renderError('reviewQueue', reviewQueue.reason);
      reviewStatus.textContent = reviewQueue.reason instanceof Error ? reviewQueue.reason.message : 'Review queue failed.';
    }
  } else {
    setState('reviewQueue', 'empty', 'Role gated');
    clearView('reviewQueue', 'Review queue unlocks for review_admin and system_admin roles.');
    reviewStatus.textContent = 'Review actions unlock for review_admin and system_admin roles.';
  }

  if (canManage(session)) {
    if (management.status === 'fulfilled') {
      renderManagementSkills(management.value?.skills ?? []);
    } else {
      renderError('management', management.reason);
    }
  } else {
    setState('management', 'empty', 'Role gated');
    clearView('management', 'Skill management is reserved for administrator sessions.');
  }
}

async function loadAll() {
  await loadLocalViews();

  let sessionPayload = null;
  try {
    sessionPayload = await json('/api/session');
    updateSession(sessionPayload.session);
  } catch (error) {
    updateSession(null);
    loginStatus.textContent = error instanceof Error ? error.message : 'Session bootstrap failed.';
  }

  await loadRemoteViews(sessionPayload?.session ?? null);
}

function connectEvents() {
  if (!currentSession?.user) {
    return;
  }

  if (eventSource) {
    eventSource.close();
  }

  setState('events', 'loading', 'Connecting…');
  eventSource = new EventSource('/api/events');
  const events = [];
  const append = (type, payload) => {
    events.unshift({ type, payload, at: new Date().toISOString() });
    renderCards('events', events.slice(0, 20), (event) => ({
      title: event.type,
      body: JSON.stringify(event.payload),
      meta: [event.at],
    }));
    if (['notify.badge.updated', 'review.queue.updated'].includes(type)) {
      loadAll().catch(() => {});
    }
  };

  for (const eventName of ['notify.badge.updated', 'review.queue.updated', 'install.update-available', 'sse.reconnect-required']) {
    eventSource.addEventListener(eventName, (event) => append(eventName, JSON.parse(event.data)));
  }

  eventSource.onopen = () => {
    setState('events', 'loaded', 'Connected');
    if (events.length === 0) {
      clearView('events', views.events.empty);
    }
  };
  eventSource.onerror = () => {
    setState('events', 'error', 'Disconnected');
  };
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    loginStatus.textContent = 'Connecting…';
    const result = await json('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    loginStatus.textContent = `Connected as ${result.user.username}.`;
    updateSession(result.session);
    await loadAll();
    connectEvents();
  } catch (error) {
    loginStatus.textContent = error instanceof Error ? error.message : 'Login failed.';
  }
});

projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    projectsStatus.textContent = 'Registering project…';
    await json('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    projectForm.reset();
    projectsStatus.textContent = 'Project registered. Refreshing project inventory…';
    await loadLocalViews();
  } catch (error) {
    projectsStatus.textContent = error instanceof Error ? error.message : 'Project registration failed.';
  }
});

settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(settingsForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    settingsStatus.textContent = 'Saving desktop settings…';
    await json('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        apiBaseUrl: payload.apiBaseUrl,
        scanCommands: parseScanCommands(payload.scanCommands),
        defaultProjectBehavior: payload.defaultProjectBehavior,
        appearance: payload.appearance,
        updateChannel: payload.updateChannel,
      }),
    });
    settingsStatus.textContent = 'Desktop settings saved.';
    await refreshConnectionStatus();
    await loadLocalViews();
  } catch (error) {
    settingsStatus.textContent = error instanceof Error ? error.message : 'Settings save failed.';
  }
});

previewBuild.addEventListener('click', async () => {
  if (!previewContext || previewContext.mode !== 'draft') {
    return;
  }

  try {
    previewStatus.textContent = 'Building preview…';
    const previewResult = await previewContext.buildPreview();
    showPreviewConfirmation({
      title: previewContext.title,
      targetLabel: previewResult.preview.targetKey,
      preview: previewResult.preview,
      confirmLabel: 'Confirm project repair',
      successMessage: `${previewResult.preview.incomingSummary?.displayName ?? 'Project'} repaired.`,
      statusTarget: previewContext.statusTarget,
      confirmRequest: () =>
        json(`/api/projects/${encodeURIComponent(previewResult.preview.installId)}/repair`, {
          method: 'POST',
          body: JSON.stringify({ previewId: previewResult.preview.previewId }),
        }),
    });
  } catch (error) {
    previewStatus.textContent = error instanceof Error ? error.message : 'Preview build failed.';
  }
});

previewConfirm.addEventListener('click', async () => {
  if (!previewContext || previewContext.mode !== 'confirm') {
    return;
  }

  try {
    previewStatus.textContent = 'Applying confirmed change…';
    await previewContext.confirmRequest();
    hidePreviewPanel();
    setLocalStatus(previewContext.statusTarget, previewContext.successMessage);
    await loadLocalViews();
  } catch (error) {
    previewStatus.textContent = error instanceof Error ? error.message : 'Confirmed change failed.';
  }
});

previewCancel.addEventListener('click', async () => {
  if (!previewContext) {
    hidePreviewPanel();
    return;
  }

  try {
    if (previewContext.mode === 'confirm' && previewContext.preview?.previewId) {
      await cancelPreview(previewContext.preview.previewId);
      setLocalStatus(previewContext.statusTarget, `${previewContext.targetLabel} preview cancelled.`);
    } else {
      setLocalStatus(previewContext.statusTarget, `${previewContext.targetLabel} preview dismissed.`);
    }
  } catch (error) {
    previewStatus.textContent = error instanceof Error ? error.message : 'Preview cancellation failed.';
    return;
  }

  hidePreviewPanel();
});

publishForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentSession?.user) {
    publishStatus.textContent = 'Sign in before staging a review submission.';
    return;
  }

  const formData = new FormData(publishForm);
  const values = Object.fromEntries(formData.entries());
  const packageId = `pkg-desktop-${Date.now()}`;
  const summary = String(values.summary ?? '').trim();
  const title = String(values.title ?? '').trim();
  const skillId = String(values.skillId ?? '').trim();
  const version = String(values.version ?? '').trim();

  try {
    setPublishState('loading', 'Submitting…');
    publishStatus.textContent = 'Uploading package to the desktop proxy…';

    await json('/api/packages/upload', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        manifest: {
          skillId,
          version,
          title,
          summary,
        },
        files: [
          {
            path: 'README.md',
            contentText: String(values.readme ?? '').trim() || `# ${title}\n\n${summary}\n`,
          },
          {
            path: 'SKILL.md',
            contentText:
              String(values.skillDefinition ?? '').trim() ||
              `name: ${skillId}\ndescription: ${summary || title}\n`,
          },
        ],
      }),
    });

    publishStatus.textContent = 'Package uploaded. Creating review ticket…';
    const submission = await json('/api/reviews/submit', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        skillId,
        reviewerUsername: String(values.reviewerUsername ?? '').trim(),
        visibility: String(values.visibility ?? 'private'),
        allowedDepartmentIds: parseDepartmentIds(values.allowedDepartmentIds),
      }),
    });

    publishStatus.textContent = `Submitted ${skillId} for review as ${submission.ticket.ticketId}.`;
    publishForm.reset();
    publishForm.querySelector('[name="version"]').value = '1.0.0';
    publishForm.querySelector('[name="visibility"]').value = 'private';
    await loadAll();
  } catch (error) {
    setPublishState('error', 'Error');
    publishStatus.textContent = error instanceof Error ? error.message : 'Publish workbench request failed.';
  }
});

views.tools.output.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-tools-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.toolsAction;
  const toolId = button.dataset.toolId;

  try {
    if (action === 'scan') {
      toolsStatus.textContent = 'Scanning desktop tools…';
      await json('/api/tools/scan', { method: 'POST', body: JSON.stringify({}) });
      toolsStatus.textContent = 'Tool scan complete.';
      await loadLocalViews();
      return;
    }

    if (action === 'repair' && toolId) {
      toolsStatus.textContent = `Building repair preview for ${toolId}…`;
      const previewResult = await json(`/api/tools/${encodeURIComponent(toolId)}/repair-preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showPreviewConfirmation({
        title: `Repair ${toolId}`,
        targetLabel: previewResult.preview.targetKey,
        preview: previewResult.preview,
        confirmLabel: 'Confirm tool repair',
        successMessage: `Tool repair applied for ${toolId}.`,
        statusTarget: 'tools',
        confirmRequest: () =>
          json(`/api/tools/${encodeURIComponent(toolId)}/repair`, {
            method: 'POST',
            body: JSON.stringify({ previewId: previewResult.preview.previewId }),
          }),
      });
    }
  } catch (error) {
    toolsStatus.textContent = error instanceof Error ? error.message : 'Tool action failed.';
  }
});

toolsRescan.addEventListener('click', async () => {
  try {
    toolsStatus.textContent = 'Scanning desktop tools…';
    await json('/api/tools/scan', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    toolsStatus.textContent = 'Tool scan complete.';
    await loadLocalViews();
  } catch (error) {
    toolsStatus.textContent = error instanceof Error ? error.message : 'Tool scan failed.';
  }
});

views.projects.output.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-project-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.projectAction;
  const projectId = button.dataset.projectId;
  if (!action || !projectId) {
    return;
  }

  const project = currentProjects.find((entry) => entry.projectId === projectId);

  try {
    if (action === 'validate' || action === 'rescan') {
      projectsStatus.textContent = `${action === 'validate' ? 'Validating' : 'Rescanning'} ${projectId}…`;
      await json(`/api/projects/${encodeURIComponent(projectId)}/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      projectsStatus.textContent = `${projectId} refreshed.`;
      await loadLocalViews();
      return;
    }

    if (action === 'switch') {
      projectsStatus.textContent = `Building switch preview for ${projectId}…`;
      const previewResult = await json(`/api/projects/${encodeURIComponent(projectId)}/switch-preview`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      showPreviewConfirmation({
        title: `Switch ${project?.displayName ?? projectId}`,
        targetLabel: previewResult.preview.targetKey,
        preview: previewResult.preview,
        confirmLabel: 'Confirm project switch',
        successMessage: `${project?.displayName ?? projectId} is now the active project.`,
        statusTarget: 'projects',
        confirmRequest: () =>
          json(`/api/projects/${encodeURIComponent(projectId)}/switch`, {
            method: 'POST',
            body: JSON.stringify({ previewId: previewResult.preview.previewId }),
          }),
      });
      return;
    }

    if (action === 'repair') {
      showPreviewDraft({
        title: `Repair ${project?.displayName ?? projectId}`,
        targetLabel: `project:${projectId}`,
        currentSummary: summarizePreviewSide({
          displayName: project?.displayName,
          projectPath: project?.projectPath,
          healthState: project?.healthState,
        }),
        impact: `Review the replacement path for ${project?.displayName ?? projectId}, build a preview, then confirm the exact mutation.`,
        issues: project?.issues ?? [],
        pathValue: project?.projectPath ?? '',
        statusTarget: 'projects',
        buildPreview: async () =>
          json(`/api/projects/${encodeURIComponent(projectId)}/repair-preview`, {
            method: 'POST',
            body: JSON.stringify({ projectPath: previewPathInput.value }),
          }),
      });
      projectsStatus.textContent = `Preview draft opened for ${projectId}.`;
      return;
    }

    if (action === 'remove') {
      if (!window.confirm(`Remove ${project?.displayName ?? projectId} from local project inventory?`)) {
        return;
      }
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ reason: 'project_remove_failed' }));
        throw new Error(payload.reason || `Project removal failed: ${response.status}`);
      }
      projectsStatus.textContent = `${project?.displayName ?? projectId} removed.`;
      await loadLocalViews();
    }
  } catch (error) {
    projectsStatus.textContent = error instanceof Error ? error.message : 'Project action failed.';
  }
});

views.reviewQueue.output.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-review-action]');
  if (!button) {
    return;
  }

  const ticketId = button.dataset.ticketId;
  const action = button.dataset.reviewAction;
  if (!ticketId || !action) {
    return;
  }

  try {
    reviewStatus.textContent = action === 'claim' ? `Claiming ${ticketId}…` : `Approving ${ticketId}…`;
    if (action === 'claim') {
      await json(`/api/reviews/${ticketId}/claim`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      reviewStatus.textContent = `Claimed ${ticketId}.`;
    } else if (action === 'approve') {
      const comment = window.prompt('Approval comment', 'Approved through desktop workbench.') ?? '';
      await json(`/api/reviews/${ticketId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      });
      reviewStatus.textContent = `Approved ${ticketId}.`;
    }
    await loadAll();
  } catch (error) {
    reviewStatus.textContent = error instanceof Error ? error.message : 'Review action failed.';
  }
});

reloadAll.addEventListener('click', async () => {
  await refreshConnectionStatus();
  await loadAll();
});

marketQuery.addEventListener('input', () => {
  loadRemoteViews(currentSession).catch(() => {});
});

setPublishEnabled(false);
refreshConnectionStatus();
loadAll()
  .then(() => {
    if (currentSession?.user) {
      connectEvents();
    }
  })
  .catch((error) => {
    loginStatus.textContent = error instanceof Error ? error.message : 'Desktop shell bootstrap failed.';
  });
