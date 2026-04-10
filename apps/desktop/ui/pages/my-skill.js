import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

function renderSkillCard(skill) {
  return `
    <article class="content-panel glass-panel page-section">
      <h2>${escapeHtml(skill.title ?? skill.skillId ?? 'My Skill')}</h2>
      <p class="page-copy">${escapeHtml(skill.summary ?? skill.description ?? '暂无摘要')}</p>
      <div class="meta-row">
        <span>${escapeHtml(skill.skillId ?? '')}</span>
        <span>${escapeHtml(skill.status ?? 'active')}</span>
        <span>${escapeHtml(skill.version ?? '1.0.0')}</span>
      </div>
    </article>
  `;
}

export function createMySkillPage(app) {
  return createPageModule({
    id: 'my-skill',
    async render({ host }) {
      const state = app.store.getState();
      const skills = state.remote.mySkills.items;

      host.innerHTML = `
        ${renderSectionHeader({
          eyebrow: 'Owned capability',
          title: 'My Skill',
          body: '我的 Skill 页面现在负责已登录用户的资产摘要与发布工作台。',
        })}
        ${skills.length ? skills.map((skill) => renderSkillCard(skill)).join('') : renderNotice({ title: '暂无 Skill', body: state.remote.mySkills.message, tone: 'neutral' })}
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
    },
  });
}

