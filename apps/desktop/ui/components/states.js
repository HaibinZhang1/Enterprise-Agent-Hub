import { escapeHtml } from '../core/utils.js';

export function renderNotice({ title, body, tone = 'neutral', action = '' }) {
  return `
    <section class="state-card state-card--${escapeHtml(tone)}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${action}
    </section>
  `;
}

export function renderMetric({ label, value, meta = '' }) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
    </article>
  `;
}

export function renderSectionHeader({ eyebrow = '', title, body = '', actions = '' }) {
  return `
    <header class="section-header" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #e0e0e0);">
        <div>
          ${eyebrow ? `<p class="page-eyebrow" style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--text-secondary, #666); text-transform: uppercase;">${escapeHtml(eyebrow)}</p>` : ''}
          <h1 style="margin: 0; font-size: 20px;">${escapeHtml(title)}</h1>
        </div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
      ${body ? `<p class="page-copy" style="margin: 12px 0 0; color: var(--text-secondary, #5e5e5e); font-size: 13px;">${escapeHtml(body)}</p>` : ''}
    </header>
  `;
}

export function renderTabs(tabs, activeId) {
  return `
    <div class="tabs" role="tablist">
      ${tabs
        .map(
          (tab) => `
            <button type="button" class="tab${tab.id === activeId ? ' is-active' : ''}" data-tab="${escapeHtml(tab.id)}">
              ${escapeHtml(tab.label)}
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}
