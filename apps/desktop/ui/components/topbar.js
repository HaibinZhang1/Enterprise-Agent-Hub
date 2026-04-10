import { escapeHtml } from '../core/utils.js';

export function renderTopbar(state) {
  const sessionText = state.session?.user
    ? `${state.session.user.username} (${state.session.user.roleCode ?? 'user'})`
    : '登录';
  const health = state.health;

  return `
    <div class="topbar__left">
      <button type="button" class="identity-chip" data-open-auth="true">
        <span class="identity-chip__eyebrow">${state.session?.user ? '当前用户' : '账户入口'}</span>
        <strong>${escapeHtml(sessionText)}</strong>
      </button>
    </div>
    <form class="topbar__search" data-search-form="true">
      <input type="search" name="query" value="${escapeHtml(state.searchQuery)}" placeholder="搜索 Skill，跳转到市场" />
      <button type="submit">搜索</button>
    </form>
    <div class="topbar__right">
      <span class="status-pill status-pill--${escapeHtml(health.status)}">${escapeHtml(health.label)}</span>
      <button type="button" class="utility-chip" data-route="notifications">
        通知
        ${state.notificationBadge ? `<span>${escapeHtml(state.notificationBadge)}</span>` : ''}
      </button>
      <button type="button" class="utility-chip" data-open-auth="true">${state.session?.user ? '用户' : '登录'}</button>
    </div>
  `;
}
