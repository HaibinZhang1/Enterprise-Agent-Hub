export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function roleCode(session) {
  return session?.user?.roleCode ?? '';
}

export function canReview(session) {
  const code = roleCode(session);
  return code.startsWith('review_admin') || code.startsWith('system_admin');
}

export function canManage(session) {
  return roleCode(session).includes('admin');
}

export function isAuthenticated(session) {
  return Boolean(session?.user);
}

export function formatIssues(issues) {
  return Array.isArray(issues) && issues.length > 0 ? issues.join(' ') : 'No blocking issues reported.';
}

export function formatTimestamp(value) {
  if (!value) {
    return 'Unknown time';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

export function summarizePreviewSide(summary) {
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

export function groupReviewQueue(queue) {
  return [
    ['todo', queue?.todo ?? []],
    ['in_progress', queue?.inProgress ?? []],
    ['done', queue?.done ?? []],
  ];
}

export function computeUnreadCount(items) {
  return (items ?? []).filter((item) => !item.readAt).length;
}

export function computeReviewTodoCount(queue) {
  return (queue?.todo ?? []).length;
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function slugFromPage(pageId) {
  return String(pageId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

export function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.values(value);
  }
  return [];
}
