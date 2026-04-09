const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const sessionMeta = document.getElementById('session-meta');
const reloadAll = document.getElementById('reload-all');
const marketQuery = document.getElementById('market-query');
const connectionStatus = document.getElementById('connection-status');
const serverUrl = document.getElementById('server-url');

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
};

let eventSource = null;

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

function createItemCard({ title, body, meta = [] }) {
  const card = document.createElement('div');
  card.className = 'item-card';

  const heading = document.createElement('h3');
  heading.textContent = title;
  card.append(heading);

  if (body) {
    const paragraph = document.createElement('p');
    paragraph.textContent = body;
    card.append(paragraph);
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
  sessionMeta.textContent = session?.user ? `${session.user.username} (${session.user.roleCode ?? 'user'})` : 'Not signed in';
}

async function loadAll() {
  for (const viewName of ['mySkills', 'market', 'notifications']) {
    setState(viewName, 'loading', 'Loading…');
  }

  try {
    const [session, mySkills, market, notifications] = await Promise.all([
      json('/api/session'),
      json('/api/skills/my'),
      json(`/api/market?query=${encodeURIComponent(marketQuery.value || '')}`),
      json('/api/notifications'),
    ]);

    updateSession(session.session);
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
  } catch (error) {
    for (const viewName of ['mySkills', 'market', 'notifications']) {
      renderError(viewName, error);
    }
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

reloadAll.addEventListener('click', () => {
  refreshConnectionStatus();
  loadAll().catch((error) => {
    loginStatus.textContent = error.message;
  });
});

marketQuery.addEventListener('input', () => {
  loadAll().catch(() => {});
});

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
