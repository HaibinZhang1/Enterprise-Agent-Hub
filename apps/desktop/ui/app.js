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

const views = {
  mySkills: {
    output: document.getElementById('my-skills-output'),
    state: document.getElementById('my-skills-state'),
    empty: 'No owned skills yet.',
    error: 'Unable to load My Skill.',
  },
  market: {
    output: document.getElementById('market-output'),
    state: document.getElementById('market-state'),
    empty: 'No market results match this query.',
    error: 'Unable to load the market.',
  },
  notifications: {
    output: document.getElementById('notifications-output'),
    state: document.getElementById('notifications-state'),
    empty: 'No notifications yet.',
    error: 'Unable to load notifications.',
  },
  events: {
    output: document.getElementById('events-output'),
    state: document.getElementById('events-state'),
    empty: 'No live events received yet.',
    error: 'Realtime stream unavailable.',
  },
  reviewQueue: {
    output: document.getElementById('review-queue-output'),
    state: document.getElementById('review-queue-state'),
    empty: 'No review tickets are assigned right now.',
    error: 'Unable to load the review queue.',
  },
  management: {
    output: document.getElementById('management-output'),
    state: document.getElementById('management-state'),
    empty: 'No manageable skills are available for this administrator.',
    error: 'Unable to load manageable skills.',
  },
};

let eventSource = null;
let currentSession = null;

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

function updateSession(session) {
  currentSession = session ?? null;
  sessionMeta.textContent = session?.user ? `${session.user.username} (${session.user.roleCode ?? 'user'})` : 'Not signed in';
}

async function loadAll() {
  for (const viewName of ['mySkills', 'market', 'notifications', 'reviewQueue', 'management']) {
    setState(viewName, 'loading', 'Loading…');
  }

  try {
    const session = await json('/api/session');
    updateSession(session.session);

    const [mySkills, market, notifications, reviewQueue, management] = await Promise.all([
      json('/api/skills/my'),
      json(`/api/market?query=${encodeURIComponent(marketQuery.value || '')}`),
      json('/api/notifications'),
      canReview(session.session) ? json('/api/reviews') : Promise.resolve(null),
      canManage(session.session) ? json('/api/skills/manageable') : Promise.resolve(null),
    ]);

    renderCards('mySkills', mySkills.skills ?? [], (skill) => ({
      title: skill.title ?? skill.skillId ?? 'Untitled skill',
      body: skill.summary ?? skill.description ?? 'No summary provided.',
      meta: [skill.skillId, skill.status, skill.version].filter(Boolean),
    }));
    renderCards('market', market.results ?? [], (skill) => ({
      title: skill.title ?? skill.skillId ?? 'Untitled market entry',
      body: skill.summary ?? skill.description ?? 'No summary provided.',
      meta: [skill.skillId, skill.canInstall ? 'installable' : 'summary only', skill.updatedAt].filter(Boolean),
    }));
    renderCards('notifications', notifications.items ?? [], (item) => ({
      title: item.title ?? item.category ?? 'Notification',
      body: item.body ?? item.message ?? '',
      meta: [item.category, item.createdAt, item.readAt ? 'read' : 'unread'].filter(Boolean),
    }));

    if (session.session?.user) {
      setPublishState('loaded', 'Ready');
      setPublishEnabled(true);
      publishStatus.textContent = 'Prepare a package, then upload and submit it for review.';
    } else {
      setPublishState('empty', 'Sign in required');
      setPublishEnabled(false);
      publishStatus.textContent = 'Sign in to stage a package and submit it for review.';
    }

    if (canReview(session.session)) {
      reviewStatus.textContent = 'Assigned review tickets load here. Claim a todo ticket before approving it.';
      renderReviewQueue(reviewQueue?.queue);
    } else {
      setState('reviewQueue', 'empty', 'Role gated');
      clearView('reviewQueue', 'Review queue unlocks for review_admin and system_admin roles.');
      reviewStatus.textContent = 'Review actions unlock for review_admin and system_admin roles.';
    }

    if (canManage(session.session)) {
      renderManagementSkills(management?.skills ?? []);
    } else {
      setState('management', 'empty', 'Role gated');
      clearView('management', 'Skill management is reserved for administrator sessions.');
    }
  } catch (error) {
    for (const viewName of ['mySkills', 'market', 'notifications', 'reviewQueue', 'management']) {
      renderError(viewName, error);
    }
    setPublishState('error', 'Error');
    publishStatus.textContent = error instanceof Error ? error.message : 'Workbench load failed.';
    throw error;
  }
}

function connectEvents() {
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
    if (['notify.badge.updated', 'review.queue.updated'].includes(type) && currentSession?.user) {
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

reloadAll.addEventListener('click', () => {
  refreshConnectionStatus();
  loadAll().catch((error) => {
    loginStatus.textContent = error.message;
  });
});

marketQuery.addEventListener('input', () => {
  loadAll().catch(() => {});
});

setPublishEnabled(false);

refreshConnectionStatus();
json('/api/session')
  .then((session) => {
    updateSession(session.session);
    if (session.session?.user) {
      loadAll().then(connectEvents).catch(() => {});
    }
  })
  .catch(() => {
    updateSession(null);
  });
