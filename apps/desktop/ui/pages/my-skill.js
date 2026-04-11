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
  return createPageModule({
    id: 'my-skill',
    async render({ host }) {
      const state = app.store.getState();
      const activeTab = state.mySkillTab ?? 'installed';
      const installedSkills = state.local.installedSkills?.items ?? [];
      const publishedSkills = state.remote.mySkills?.items ?? [];

      let content = '';
      if (activeTab === 'installed') {
        content = installedSkills.length
          ? installedSkills.map((skill) => renderInstalledSkillCard(skill)).join('')
          : renderNotice({
              title: '暂无已安装 Skill',
              body: state.local.installedSkills?.message ?? '当前没有从桌面本地控制平面聚合出的已安装 Skill。',
              tone: 'neutral',
            });
      } else if (activeTab === 'published') {
        content = publishedSkills.length
          ? publishedSkills.map((skill) => renderPublishedSkillCard(skill)).join('')
          : renderNotice({
              title: '暂无发布记录',
              body: state.remote.mySkills?.message ?? '当前账号还没有发布或提交中的 Skill。',
              tone: 'neutral',
            });
      } else {
        content = renderPublishWorkbench();
      }

      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Owned capability',
          title: 'My Skill',
          body: '我的 Skill 页面拆分为已安装、我发布的、发布 Skill 三个真实子视图。',
        })}
        ${renderTabs(activeTab)}
        ${content}
      `;
    },
  });
}
