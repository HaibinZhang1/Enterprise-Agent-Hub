import { renderNotice, renderTabs } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

const TABS = [
  { id: 'departments', label: '部门管理' },
  { id: 'users', label: '用户管理' },
  { id: 'skills', label: 'Skill 管理' },
];

function renderDepartmentsTable() {
  return `
    <table class="workbench-table">
      <thead>
        <tr>
          <th>部门 ID</th>
          <th>部门名称</th>
          <th>成员数</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr class="workbench-table__empty">
          <td colspan="5">部门管理后端接口尚未接入，当前为空态骨架。</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderUsersTable() {
  return `
    <table class="workbench-table">
      <thead>
        <tr>
          <th>用户名</th>
          <th>角色</th>
          <th>部门</th>
          <th>最后登录</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr class="workbench-table__empty">
          <td colspan="5">用户管理当前为占位骨架，后续接入真实数据。</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderSkillsTable(skills) {
  if (!skills.length) {
    return `
      <table class="workbench-table">
        <thead>
          <tr>
            <th>Skill ID</th>
            <th>标题</th>
            <th>版本</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr class="workbench-table__empty">
            <td colspan="5">暂无 Skill 管理数据。</td>
          </tr>
        </tbody>
      </table>
    `;
  }

  return `
    <table class="workbench-table">
      <thead>
        <tr>
          <th>Skill ID</th>
          <th>标题</th>
          <th>摘要</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${skills.map((skill) => `
          <tr>
            <td>${escapeHtml(skill.skillId ?? '')}</td>
            <td>${escapeHtml(skill.title ?? skill.skillId ?? 'Skill')}</td>
            <td>${escapeHtml(skill.summary ?? skill.description ?? '暂无')}</td>
            <td><span class="state-pill">${escapeHtml(skill.status ?? '未知')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderTabBody(state) {
  const activeTab = state.managementTab;
  if (activeTab === 'departments') {
    return renderDepartmentsTable();
  }
  if (activeTab === 'users') {
    return renderUsersTable();
  }
  return renderSkillsTable(state.remote.management.skills);
}

export function createManagementPage(app) {
  return createPageModule({
    id: 'management',
    async render({ host }) {
      const state = app.store.getState();
      host.innerHTML = `
        <div class="workbench-header">
          <div class="workbench-header__title-bar">
            <div>
              <p class="page-eyebrow">管理员</p>
              <h1>管理中心</h1>
            </div>
          </div>
          <div class="workbench-header__tabs">
            ${renderTabs(TABS, state.managementTab)}
          </div>
        </div>
        <div class="management-body">
          ${renderTabBody(state)}
        </div>
      `;
    },
  });
}
