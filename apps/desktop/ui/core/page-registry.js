import { canManage, canReview, isAuthenticated } from './utils.js';

const PAGE_ENTRIES = Object.freeze([
  { id: 'home', label: '首页', shortLabel: 'Home', icon: '⌂', visibility: () => true },
  { id: 'market', label: '市场', shortLabel: 'Market', icon: '◫', visibility: () => true, searchTarget: true },
  { id: 'my-skill', label: '我的 Skill', shortLabel: 'My Skill', icon: '□', visibility: () => true, requiresAuth: true },
  { id: 'review', label: '审核', shortLabel: 'Review', icon: '✓', visibility: canReview, requiresAuth: true, adminOnly: true, badgeKey: 'reviewBadge' },
  { id: 'management', label: '管理', shortLabel: 'Manage', icon: '⚙', visibility: canManage, requiresAuth: true, adminOnly: true },
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

export function requiresAuthentication(pageId) {
  return Boolean(findPageEntry(pageId)?.requiresAuth);
}

export function getDefaultPage() {
  return 'home';
}

export function getSafeFallback(pageId, session) {
  if (!findPageEntry(pageId)) {
    return getDefaultPage(session);
  }
  if ((pageId === 'review' || pageId === 'management') && !canAccessPage(pageId, session)) {
    return getDefaultPage(session);
  }
  if (pageId === 'my-skill' && !isAuthenticated(session)) {
    return 'home';
  }
  return getDefaultPage(session);
}

export function getProtectedPrompt(pageId) {
  if (pageId === 'my-skill') {
    return '我的 Skill 需要登录后使用。';
  }
  if (pageId === 'review' || pageId === 'management') {
    return '该管理功能需要具备对应权限并完成登录。';
  }
  return '该功能需要登录后使用。';
}

export function getPageEntries() {
  return PAGE_ENTRIES;
}
