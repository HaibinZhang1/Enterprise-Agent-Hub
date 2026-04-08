const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const sessionMeta = document.getElementById('session-meta');
const reloadAll = document.getElementById('reload-all');
const marketQuery = document.getElementById('market-query');
const publishForm = document.getElementById('publish-form');
const publishStatus = document.getElementById('publish-status');
const publishOutput = document.getElementById('publish-output');
const reviewActionForm = document.getElementById('review-action-form');
const claimTicketButton = document.getElementById('claim-ticket');
const approveTicketButton = document.getElementById('approve-ticket');
const ticketIdInput = document.getElementById('ticket-id');
const reviewCommentInput = document.getElementById('review-comment');
const reviewStatus = document.getElementById('review-status');

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

function toBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function fileToPayload(file) {
  return {
    path: file.webkitRelativePath || file.name,
    size: file.size,
    contentBase64: toBase64(await file.arrayBuffer()),
  };
}

function suggestTicketId(queue) {
  const nextTicket = queue.todo?.[0] ?? queue.inProgress?.[0] ?? queue.done?.[0] ?? null;
  if (nextTicket && !ticketIdInput.value) {
    ticketIdInput.value = nextTicket.ticketId;
  }
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
  if (reviews.queue) {
    suggestTicketId(reviews.queue);
  }
}

async function requireSession() {
  const session = await json('/api/session');
  if (!session.session?.user) {
    throw new Error('Please sign in first.');
  }
  return session.session;
}

async function handlePublish(event) {
  event.preventDefault();
  try {
    await requireSession();
    const formData = new FormData(publishForm);
    const selectedFiles = document.getElementById('package-files').files;
    if (!selectedFiles || selectedFiles.length === 0) {
      throw new Error('Select at least one package file before uploading.');
    }
    const files = await Promise.all([...selectedFiles].map(fileToPayload));
    const manifest = {
      skillId: String(formData.get('skillId') || ''),
      version: String(formData.get('version') || ''),
      title: String(formData.get('title') || ''),
      summary: String(formData.get('summary') || ''),
      tags: ['desktop'],
    };
    const packageId = `pkg-${Date.now()}`;
    const upload = await json('/api/packages/upload', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        manifest,
        files,
      }),
    });
    if (!upload.ok) {
      throw new Error(upload.reason || 'Package upload failed.');
    }
    const submit = await json('/api/reviews/submit', {
      method: 'POST',
      body: JSON.stringify({
        packageId,
        reviewerUsername: String(formData.get('reviewerUsername') || ''),
        visibility: String(formData.get('visibility') || 'detail_public'),
      }),
    });
    if (!submit.ok) {
      throw new Error(submit.reason || 'Submit for review failed.');
    }
    publishStatus.textContent = `Uploaded ${packageId} and submitted ticket ${submit.ticket.ticketId}.`;
    publishOutput.textContent = JSON.stringify({ upload, submit }, null, 2);
    ticketIdInput.value = submit.ticket.ticketId;
    await loadAll();
  } catch (error) {
    publishStatus.textContent = error.message;
  }
}

async function runReviewAction(action) {
  try {
    await requireSession();
    if (!ticketIdInput.value) {
      throw new Error('Provide a ticket id first.');
    }
    const payload =
      action === 'approve'
        ? { comment: reviewCommentInput.value || 'Approved from desktop shell.' }
        : {};
    const result = await json(`/api/reviews/${encodeURIComponent(ticketIdInput.value)}/${action}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      throw new Error(result.reason || `${action} failed.`);
    }
    reviewStatus.textContent = `${action} succeeded for ${ticketIdInput.value}.`;
    await loadAll();
  } catch (error) {
    reviewStatus.textContent = error.message;
  }
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

publishForm.addEventListener('submit', handlePublish);
claimTicketButton.addEventListener('click', () => runReviewAction('claim'));
approveTicketButton.addEventListener('click', () => runReviewAction('approve'));
reviewActionForm.addEventListener('submit', (event) => event.preventDefault());

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
