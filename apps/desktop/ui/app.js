const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const sessionMeta = document.getElementById('session-meta');
const reloadAll = document.getElementById('reload-all');
const marketQuery = document.getElementById('market-query');
const outputs = {
  market: document.getElementById('market-output'),
  notifications: document.getElementById('notifications-output'),
  users: document.getElementById('users-output'),
  mySkills: document.getElementById('my-skills-output'),
  manageableSkills: document.getElementById('manage-skills-output'),
  reviews: document.getElementById('reviews-output'),
  events: document.getElementById('events-output'),
};

let eventSource = null;

function render(target, payload) {
  outputs[target].textContent = JSON.stringify(payload, null, 2);
}

async function json(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  return response.json();
}

function connectEvents() {
  if (eventSource) {
    eventSource.close();
  }
  eventSource = new EventSource('/api/events');
  const events = [];
  const append = (type, payload) => {
    events.unshift({ type, payload, at: new Date().toISOString() });
    render('events', events.slice(0, 20));
  };
  eventSource.addEventListener('notification.created', (event) => append('notification.created', JSON.parse(event.data)));
  eventSource.addEventListener('badge.updated', (event) => append('badge.updated', JSON.parse(event.data)));
  eventSource.addEventListener('review.queue.updated', (event) => append('review.queue.updated', JSON.parse(event.data)));
  eventSource.addEventListener('sse.reconnect-required', (event) => append('sse.reconnect-required', JSON.parse(event.data)));
}

async function loadAll() {
  const [session, market, notifications, users, mySkills, manageableSkills, reviews] = await Promise.all([
    json('/api/session'),
    json(`/api/market?query=${encodeURIComponent(marketQuery.value || '')}`),
    json('/api/notifications'),
    json('/api/users'),
    json('/api/skills/my'),
    json('/api/skills/manageable'),
    json('/api/reviews'),
  ]);

  sessionMeta.textContent = session.session?.user ? `Signed in as ${session.session.user.username}` : 'Not signed in';
  render('market', market.results ?? market);
  render('notifications', notifications.items ?? notifications);
  render('users', users.users ?? users);
  render('mySkills', mySkills.skills ?? mySkills);
  render('manageableSkills', manageableSkills.skills ?? manageableSkills);
  render('reviews', reviews.queue ?? reviews);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = Object.fromEntries(formData.entries());
  const result = await json('/api/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    loginStatus.textContent = `${result.code ?? 'LOGIN_FAILED'}: ${result.reason ?? 'unknown'}`;
    return;
  }
  loginStatus.textContent = `Connected as ${result.user.username}`;
  await loadAll();
  connectEvents();
});

reloadAll.addEventListener('click', () => {
  loadAll().catch((error) => {
    loginStatus.textContent = error.message;
  });
});

marketQuery.addEventListener('change', () => {
  loadAll().catch(() => {});
});

json('/api/session').then((session) => {
  if (session.session?.user) {
    sessionMeta.textContent = `Signed in as ${session.session.user.username}`;
    loadAll().then(connectEvents).catch(() => {});
  }
});
