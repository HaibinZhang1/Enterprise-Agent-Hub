import { getVisiblePages } from '../core/page-registry.js';
import { escapeHtml } from '../core/utils.js';

export function renderNav(state) {
  const pages = getVisiblePages(state.session);
  const topPages = pages.filter((page) => page.section !== 'footer');
  const footerPages = pages.filter((page) => page.section === 'footer');

  const renderItems = (entries) =>
    entries
      .map((entry) => {
        const badgeValue = entry.badgeKey ? state[entry.badgeKey] : 0;
        return `
          <button type="button" class="nav-item${state.route === entry.id ? ' is-active' : ''}" data-route="${escapeHtml(entry.id)}">
            <span class="nav-item__icon" aria-hidden="true">${escapeHtml(entry.icon)}</span>
            <span class="nav-item__label">${escapeHtml(entry.label)}</span>
            ${badgeValue ? `<span class="nav-item__badge">${escapeHtml(badgeValue)}</span>` : ''}
          </button>
        `;
      })
      .join('');

  return `
    <div class="nav-panel__brand">
      <p>Enterprise Agent Hub</p>
      <span>Windows-first desktop workspace</span>
    </div>
    <div class="nav-panel__group">${renderItems(topPages)}</div>
    <div class="nav-panel__footer">${renderItems(footerPages)}</div>
  `;
}
