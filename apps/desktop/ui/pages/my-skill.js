import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

const TABS = Object.freeze([
  Object.freeze({ id: 'installed', label: '已安装' }),
  Object.freeze({ id: 'published', label: '我发布的' }),
  Object.freeze({ id: 'publish', label: '发布 Skill' }),
]);

function renderTabs(activeTab) {
  return `
    <div class="tabs" role="tablist" aria-label="我的 Skill 标签">
      ${TABS.map((tab) => `
        <button
          type="button"
          class="tab${tab.id === activeTab ? ' is-active' : ''}"
          data-my-skill-tab="${escapeHtml(tab.id)}"
        >
          ${escapeHtml(tab.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderInstalledSkillCard(skill) {
  const versions = Array.isArray(skill.versions) && skill.versions.length
    ? skill.versions.map((entry) => `${entry.version}${entry.packageId ? ` · ${entry.packageId}` : ''}`).join(' / ')
    : '无本地包/版本记录';
  const enabledTools = Array.isArray(skill.enabledTools) && skill.enabledTools.length
    ? skill.enabledTools.map((entry) => entry.displayName ?? entry.toolId).join(', ')
    : '无已启用工具';
  const enabledProjects = Array.isArray(skill.enabledProjects) && skill.enabledProjects.length
    ? skill.enabledProjects.map((entry) => entry.displayName ?? entry.projectId).join(', ')
    : '无已启用项目';
  const materialization = Array.isArray(skill.materialization) && skill.materialization.length
    ? skill.materialization.map((entry) => `${entry.targetType}:${entry.targetId} · ${entry.status}${entry.mode ? ` · ${entry.mode}` : ''}`).join(' | ')
    : '无物化记录';

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">已安装技能</p>
          <h2>${escapeHtml(skill.skillId ?? 'installed-skill')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(skill.effectiveState ?? '未知')}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(versions)}</span>
        <span>更新于 ${escapeHtml(formatTimestamp(skill.updatedAt))}</span>
      </div>
      <p class="page-copy"><strong>启用工具：</strong>${escapeHtml(enabledTools)}</p>
      <p class="page-copy"><strong>启用项目：</strong>${escapeHtml(enabledProjects)}</p>
      <p class="page-copy"><strong>物化状态：</strong>${escapeHtml(materialization)}</p>
      ${skill.restrictionNote ? `<p class="page-copy">${escapeHtml(skill.restrictionNote)}</p>` : ''}
    </article>
  `;
}

function latestVersion(skill) {
  if (skill.publishedVersion) {
    return skill.publishedVersion;
  }
  const versions = Array.isArray(skill.versions) ? skill.versions : [];
  return versions.length ? versions[versions.length - 1].version : '无版本';
}

function renderPublishedSkillCard(skill) {
  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">我发布的</p>
          <h2>${escapeHtml(skill.title ?? skill.skillId ?? 'Skill')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(skill.status ?? '未知')}</span>
      </div>
      <p class="page-copy">${escapeHtml(skill.summary ?? skill.description ?? '暂无摘要')}</p>
      <div class="meta-row">
        <span>${escapeHtml(skill.skillId ?? '')}</span>
        <span>${escapeHtml(latestVersion(skill))}</span>
        <span>${escapeHtml(skill.visibility ?? 'private')}</span>
      </div>
    </article>
  `;
}

function renderPublishWorkbench() {
  return `
    <section class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">发布工具</p>
          <h2>发布工作台</h2>
        </div>
        <span class="state-pill">需要登录</span>
      </div>
      <p class="page-copy">未登录时会弹出统一登录提示；登录后可在此提交发布。</p>
      <form class="stack-form" data-publish-form="true">
        <label>Skill ID<input name="skillId" type="text" placeholder="dept.desktop.assistant" required /></label>
        <label>标题<input name="title" type="text" placeholder="桌面审核助手" required /></label>
        <label>版本<input name="version" type="text" value="1.0.0" required /></label>
        <label>审核人用户名<input name="reviewerUsername" type="text" placeholder="reviewer" required /></label>
        <label>
          可见性
          <select name="visibility">
            <option value="private">私有</option>
            <option value="summary_public">摘要公开</option>
            <option value="detail_public">详情公开</option>
            <option value="department">部门可见</option>
            <option value="global_installable">全局可安装</option>
          </select>
        </label>
        <label>允许的部门<input name="allowedDepartmentIds" type="text" placeholder="dept-1,dept-2" /></label>
        <label class="full-span">摘要<textarea name="summary" rows="3" placeholder="简要描述，展示于市场和审核页面。"></textarea></label>
        <label class="full-span">README.md<textarea name="readme" rows="5" placeholder="# 桌面审核助手"></textarea></label>
        <label class="full-span">SKILL.md<textarea name="skillDefinition" rows="5" placeholder="name: dept.desktop.assistant"></textarea></label>
        <div class="form-actions full-span">
          <button type="submit">上传并提交</button>
        </div>
      </form>
    </section>
  `;
}

export function createMySkillPage(app) {
  let selectedId = null;

  return createPageModule({
    id: 'my-skill',
    async render({ host }) {
      const state = app.store.getState();
      const activeTab = state.mySkillTab ?? 'installed';
      const installedSkills = state.local.installedSkills?.items ?? [];
      const publishedSkills = state.remote.mySkills?.items ?? [];

      let listData = [];
      let renderDetailFn = () => '';

      if (activeTab === 'installed') {
        listData = installedSkills;
        renderDetailFn = (item) => renderInstalledSkillCard(item);
      } else if (activeTab === 'published') {
        listData = publishedSkills;
        renderDetailFn = (item) => renderPublishedSkillCard(item);
      }

      if (activeTab !== 'publish' && listData.length) {
        if (!selectedId || !listData.find(i => i.skillId === selectedId)) {
          selectedId = listData[0].skillId;
        }
      } else {
        selectedId = null;
      }

      let innerContent = '';

      if (activeTab === 'publish') {
        innerContent = `<div class="page-padded">${renderPublishWorkbench()}</div>`;
      } else {
        if (!listData.length) {
          innerContent = `<div class="page-padded">${renderNotice({ title: '没有找到记录', body: '暂无数据', tone: 'neutral' })}</div>`;
        } else {
          const listHtml = listData.map((item) => `
            <div class="split-view__item${item.skillId === selectedId ? ' is-active' : ''}" data-id="${escapeHtml(item.skillId)}">
              <h3 class="split-view__item-title">${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h3>
              <p class="split-view__item-subtitle">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
            </div>
          `).join('');

          innerContent = `
            <div class="split-view">
              <div class="split-view__list">
                ${listHtml}
              </div>
              <div class="split-view__detail" id="myskill-detail-container"></div>
            </div>
          `;
        }
      }

      host.innerHTML = `
        <div class="workbench-header">
          <div class="workbench-header__title-bar">
            <div>
              <p class="page-eyebrow">能力管理</p>
              <h1>我的 Skill</h1>
            </div>
          </div>
          <div class="workbench-header__tabs">
            ${renderTabs(activeTab)}
          </div>
        </div>
        ${innerContent}
      `;

      if (activeTab !== 'publish' && listData.length) {
        bindSplitView(host, {
          selectedId,
          detailSelector: '#myskill-detail-container',
          onSelect: (id) => { selectedId = id; },
          renderDetail: (id) => {
            const item = listData.find(i => i.skillId === id);
            return item ? renderDetailFn(item) : '';
          },
        });
      }
    },
  });
}
