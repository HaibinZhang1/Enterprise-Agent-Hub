import { canManage, canReview, isAuthenticated } from './utils.js';

const PAGE_ENTRIES = Object.freeze([
  { id: 'home', label: '首页', shortLabel: 'Home', icon: '⌂', visibility: () => true },
  { id: 'market', label: '市场', shortLabel: 'Market', icon: '◫', visibility: () => true, searchTarget: true },
  { id: 'my-skill', label: '我的 Skill', shortLabel: 'My Skill', icon: '□', visibility: () => true, requiresAuth: true },
  { id: 'review', label: '审核', shortLabel: 'Review', icon: '✓', visibility: canReview, adminOnly: true, badgeKey: 'reviewBadge' },
  { id: 'management', label: '管理', shortLabel: 'Manage', icon: '⚙', visibility: canManage, adminOnly: true },
  { id: 'tools', label: '工具', shortLabel: 'Tools', icon: '⌘', visibility: () => true },
  { id: 'projects', label: '项目', shortLabel: 'Projects', icon: '⋯', visibility: () => true },
  { id: 'notifications', label: '通知', shortLabel: 'Notify', icon: '●', visibility: () => true, badgeKey: 'notificationBadge' },
  { id: 'settings', label: '设置', shortLabel: 'Settings', icon: '☰', visibility: () => true, section: 'footer' },
]);

function findPageEntry(pageId) {
  return PAGE_ENTRIES.find((entry) => entry.id === pageId) ?? null;
}

export function getPageEntry(pageId) {
  return findPageEntry(pageId) ?? PAGE_ENTRIES[0];
}

export function getVisiblePages(session) {
  return PAGE_ENTRIES.filter((entry) => entry.visibility(session));
}

export function canAccessPage(pageId, session) {
  const entry = findPageEntry(pageId);
  return Boolean(entry?.visibility(session));
}

export function getDefaultPage(session) {
  if (isAuthenticated(session)) {
    return 'home';
  }
  return 'home';
}

export function getSafeFallback(pageId, session) {
  if (!findPageEntry(pageId)) {
    return getDefaultPage(session);
  }
  if (pageId === 'review' || pageId === 'management') {
    return getDefaultPage(session);
  }
  if (pageId === 'my-skill' && !isAuthenticated(session)) {
    return 'home';
  }
  return getDefaultPage(session);
}

export function getPageEntries() {
  return PAGE_ENTRIES;
}
