import { escapeHtml } from '../core/utils.js';

function renderUserMenu(state) {
  if (!state.session?.user || !state.userMenuOpen) {
    return '';
  }

  return `
    <div class="user-menu" role="menu" aria-label="当前用户菜单">
      <p class="user-menu__eyebrow">当前账号</p>
      <strong>${escapeHtml(state.session.user.username)}</strong>
      <span>${escapeHtml(state.session.user.roleCode ?? 'user')}</span>
      <button type="button" class="ghost-button" data-logout-session="true">退出登录</button>
    </div>
  `;
}

export function renderTopbar(state) {
  const health = state.health;
  const identityLabel = state.session?.user ? state.session.user.username : '登录';
  const identityEyebrow = state.session?.user ? '当前用户' : '账户入口';
  const identityAction = state.session?.user ? 'data-toggle-user-menu="true"' : 'data-open-auth="true"';
  const utilityAuth = state.session?.user
    ? `<button type="button" class="utility-chip" data-toggle-user-menu="true">用户</button>`
    : `<button type="button" class="utility-chip" data-open-auth="true">登录</button>`;

  return `
    <div class="topbar__left">
      <button type="button" class="identity-chip" ${identityAction}>
        <span class="identity-chip__eyebrow">${escapeHtml(identityEyebrow)}</span>
        <strong>${escapeHtml(identityLabel)}</strong>
      </button>
      ${renderUserMenu(state)}
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
      ${utilityAuth}
    </div>
  `;
}
