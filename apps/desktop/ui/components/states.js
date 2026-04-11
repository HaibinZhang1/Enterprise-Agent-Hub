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
    <header class="section-header">
      <div class="section-header__bar">
        <div>
          ${eyebrow ? `<p class="section-header__eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
          <h1 class="section-header__title">${escapeHtml(title)}</h1>
        </div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
      ${body ? `<p class="section-header__body">${escapeHtml(body)}</p>` : ''}
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
