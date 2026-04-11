import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml, formatTimestamp } from '../core/utils.js';

const TABS = Object.freeze([
  Object.freeze({ id: 'installed', label: '已安装 / Installed' }),
  Object.freeze({ id: 'published', label: '我发布的 / Published' }),
  Object.freeze({ id: 'publish', label: '发布 Skill / Publish' }),
]);

function renderTabs(activeTab) {
  return `
    <div class="tabs" role="tablist" aria-label="My Skill tabs">
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
    : 'No local package/version recorded.';
  const enabledTools = Array.isArray(skill.enabledTools) && skill.enabledTools.length
    ? skill.enabledTools.map((entry) => entry.displayName ?? entry.toolId).join(', ')
    : 'No enabled tools';
  const enabledProjects = Array.isArray(skill.enabledProjects) && skill.enabledProjects.length
    ? skill.enabledProjects.map((entry) => entry.displayName ?? entry.projectId).join(', ')
    : 'No enabled projects';
  const materialization = Array.isArray(skill.materialization) && skill.materialization.length
    ? skill.materialization.map((entry) => `${entry.targetType}:${entry.targetId} · ${entry.status}${entry.mode ? ` · ${entry.mode}` : ''}`).join(' | ')
    : 'No materialization records';

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Installed skill</p>
          <h2>${escapeHtml(skill.skillId ?? 'installed-skill')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(skill.effectiveState ?? 'unknown')}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(versions)}</span>
        <span>${escapeHtml(`Updated ${formatTimestamp(skill.updatedAt)}`)}</span>
      </div>
      <p class="page-copy"><strong>Enabled tools:</strong> ${escapeHtml(enabledTools)}</p>
      <p class="page-copy"><strong>Enabled projects:</strong> ${escapeHtml(enabledProjects)}</p>
      <p class="page-copy"><strong>Materialization:</strong> ${escapeHtml(materialization)}</p>
      ${skill.restrictionNote ? `<p class="page-copy">${escapeHtml(skill.restrictionNote)}</p>` : ''}
    </article>
  `;
}

function latestVersion(skill) {
  if (skill.publishedVersion) {
    return skill.publishedVersion;
  }
  const versions = Array.isArray(skill.versions) ? skill.versions : [];
  return versions.length ? versions[versions.length - 1].version : 'No version';
}

function renderPublishedSkillCard(skill) {
  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">Owned catalog entry</p>
          <h2>${escapeHtml(skill.title ?? skill.skillId ?? 'My Skill')}</h2>
        </div>
        <span class="state-pill">${escapeHtml(skill.status ?? 'unknown')}</span>
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
          <p class="page-eyebrow">Publisher mutation</p>
          <h2>Publish Workbench</h2>
        </div>
        <span class="state-pill">统一登录拦截</span>
      </div>
      <p class="page-copy">未登录时入口会弹统一登录提示；登录后发布表单留在当前页面边界内。</p>
      <form class="stack-form" data-publish-form="true">
        <label>Skill ID<input name="skillId" type="text" placeholder="dept.desktop.assistant" required /></label>
        <label>Title<input name="title" type="text" placeholder="Desktop Review Assistant" required /></label>
        <label>Version<input name="version" type="text" value="1.0.0" required /></label>
        <label>Reviewer username<input name="reviewerUsername" type="text" placeholder="reviewer" required /></label>
        <label>
          Visibility
          <select name="visibility">
            <option value="private">private</option>
            <option value="summary_public">summary_public</option>
            <option value="detail_public">detail_public</option>
            <option value="department">department</option>
            <option value="global_installable">global_installable</option>
          </select>
        </label>
        <label>Allowed departments<input name="allowedDepartmentIds" type="text" placeholder="dept-1,dept-2" /></label>
        <label class="full-span">Summary<textarea name="summary" rows="3" placeholder="Brief summary shown in My Skill, market, and review surfaces."></textarea></label>
        <label class="full-span">README.md<textarea name="readme" rows="6" placeholder="# Desktop Review Assistant"></textarea></label>
        <label class="full-span">SKILL.md<textarea name="skillDefinition" rows="6" placeholder="name: dept.desktop.assistant"></textarea></label>
        <div class="form-actions full-span">
          <button type="submit">Upload + Submit</button>
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
        innerContent = `<div style="padding: 24px; overflow-y: auto;">${renderPublishWorkbench()}</div>`;
      } else {
        if (!listData.length) {
          innerContent = `<div style="padding: 24px; flex: 1;">${renderNotice({ title: '没有找到记录', body: '暂无数据', tone: 'neutral' })}</div>`;
        } else {
          const listHtml = listData.map((item) => `
            <div class="split-view__item ${item.skillId === selectedId ? 'is-active' : ''}" data-id="${escapeHtml(item.skillId)}" style="${item.skillId === selectedId ? 'background: rgba(0,0,0,0.05);' : ''}">
              <h3 style="margin: 0 0 4px; font-size: 14px;">${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</h3>
              <p style="margin: 0; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.summary ?? item.description ?? '暂无描述')}</p>
            </div>
          `).join('');

          innerContent = `
            <div class="split-view">
              <div class="split-view__list">
                ${listHtml}
              </div>
              <div class="split-view__detail" id="myskill-detail-container">
                <!-- JS inserted -->
              </div>
            </div>
          `;
        }
      }

      host.innerHTML = `
        <div class="dashboard-container" style="padding: 0; gap: 0;">
          <div style="padding: 16px 24px 0; border-bottom: 1px solid var(--border-color, #e0e0e0); background: var(--panel-bg, #fff);">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
              <div>
                <p class="page-eyebrow" style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Owned capability</p>
                <h1 style="margin: 0; font-size: 20px;">My Skills</h1>
              </div>
            </div>
            ${renderTabs(activeTab)}
          </div>
          ${innerContent}
        </div>
      `;

      if (activeTab !== 'publish' && listData.length) {
        const detailContainer = host.querySelector('#myskill-detail-container');
        const itemsElements = host.querySelectorAll('.split-view__item');

        const updateDetail = () => {
          const item = listData.find(i => i.skillId === selectedId);
          if (!item) return;
          detailContainer.innerHTML = renderDetailFn(item);
        };

        itemsElements.forEach(el => {
          el.addEventListener('click', () => {
             itemsElements.forEach(i => { i.classList.remove('is-active'); i.style.background = ''; });
             el.classList.add('is-active');
             el.style.background = 'rgba(0,0,0,0.05)';
             selectedId = el.dataset.id;
             updateDetail();
          });
        });

        updateDetail();
      }
    },
  });
}
