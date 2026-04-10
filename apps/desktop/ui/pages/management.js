import { renderNotice, renderSectionHeader, renderTabs } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

const TABS = [
  { id: 'departments', label: '部门管理' },
  { id: 'users', label: '用户管理' },
  { id: 'skills', label: 'Skill 管理' },
];

function renderTabBody(state) {
  const activeTab = state.managementTab;
  if (activeTab === 'departments') {
    return renderNotice({ title: '部门管理', body: '部门管理后端接口尚未完全接入，当前先交付页面骨架、权限边界与空态。', tone: 'neutral' });
  }
  if (activeTab === 'users') {
    return renderNotice({ title: '用户管理', body: '用户管理当前为占位骨架，后续可在不改动信息架构的前提下接入真实数据。', tone: 'neutral' });
  }

  const skills = state.remote.management.skills;
  return skills.length
    ? `<div class="bullet-list">${skills
        .map(
          (skill) => `<article class="bullet-list__item"><strong>${escapeHtml(skill.title ?? skill.skillId ?? 'Skill')}</strong><span>${escapeHtml(skill.summary ?? skill.description ?? '暂无摘要')}</span></article>`,
        )
        .join('')}</div>`
    : renderNotice({ title: 'Skill 管理', body: state.remote.management.message, tone: 'neutral' });
}

export function createManagementPage(app) {
  return createPageModule({
    id: 'management',
    async render({ host }) {
      const state = app.store.getState();
      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Admin read surface',
          title: 'Management',
          body: '管理页先交付部门管理、用户管理、Skill 管理三层信息架构，即使部分接口仍为占位。',
        })}
        <section class="content-panel glass-panel page-section">
          ${renderTabs(TABS, state.managementTab)}
          <div class="management-body">${renderTabBody(state)}</div>
        </section>
      `;
    },
  });
}

