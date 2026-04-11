import { renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { bindSplitView } from '../core/split-view-helper.js';
import { escapeHtml, formatIssues } from '../core/utils.js';

function summarizeBinding(binding) {
  const materialization = binding.materializationStatus;
  if (!binding.enabled) {
    return '已禁用，需要重新启用此项目的 Skill 绑定。';
  }
  if (!materialization) {
    return '已启用，等待预览-确认物化检查。';
  }
  const status = materialization.status ?? '未知';
  const mode = materialization.mode ?? '无';
  return `物化 ${status} · 模式 ${mode}`;
}

function renderBinding(binding, project) {
  const toggleEnabled = binding.enabled ? 'false' : 'true';
  const toggleLabel = binding.enabled ? '禁用' : '启用';
  const materialization = binding.materializationStatus;
  const materializationLabel = materialization ? `${materialization.status ?? '未知'} · ${materialization.mode ?? '无'}` : '尚未物化';

  return `
    <article class="content-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">绑定的 Skill</p>
          <h3>${escapeHtml(binding.skillId ?? 'Skill')}</h3>
        </div>
        <span class="state-pill">${binding.enabled ? '已启用' : '已禁用'}</span>
      </div>
      <div class="meta-row">
        <span>${escapeHtml(binding.packageId ?? '无包')}</span>
        <span>${escapeHtml(binding.version ?? '无版本')}</span>
        <span>${escapeHtml(materializationLabel)}</span>
      </div>
      <p class="page-copy">${escapeHtml(summarizeBinding(binding))}</p>
      <form class="stack-form" data-project-skill-form="toggle" data-project-skill-toggle="true">
        <input type="hidden" name="projectId" value="${escapeHtml(project.projectId ?? '')}" />
        <input type="hidden" name="skillId" value="${escapeHtml(binding.skillId ?? '')}" />
        <input type="hidden" name="packageId" value="${escapeHtml(binding.packageId ?? '')}" />
        <input type="hidden" name="version" value="${escapeHtml(binding.version ?? '')}" />
        <input type="hidden" name="skillsDirectory" value="${escapeHtml(project.skillsDirectory ?? '')}" />
        <input type="hidden" name="enabled" value="${escapeHtml(toggleEnabled)}" />
        <div class="form-actions full-span">
          <button type="submit">${toggleLabel}</button>
        </div>
      </form>
    </article>
  `;
}

function renderProject(project, currentProjectId) {
  const isCurrent = project.projectId === currentProjectId || project.isCurrent;
  const bindingsMarkup = project.skillBindings?.length
    ? project.skillBindings.map((binding) => renderBinding(binding, project)).join('')
    : renderNotice({
        title: '暂无绑定 Skill',
        body: '逐个绑定 Skill，所有项目-Skill 变更均需预览确认。',
        tone: 'neutral',
      });

  return `
    <article class="content-panel glass-panel page-section">
      <div class="content-header">
        <div>
          <p class="page-eyebrow">项目管理</p>
          <h2>${escapeHtml(project.displayName ?? project.projectId ?? '项目')}</h2>
        </div>
        <span class="state-pill">${isCurrent ? '当前' : '空闲'}</span>
      </div>
      <p class="page-copy">${escapeHtml(project.projectPath ?? '')}</p>
      <div class="meta-row">
        <span>${escapeHtml(project.healthLabel ?? project.healthState ?? '未知')}</span>
        <span>${escapeHtml(project.skillsDirectory ?? '无 Skills 目录')}</span>
      </div>
      <p class="page-copy">${escapeHtml(formatIssues(project.issues))}</p>
      <p class="page-copy">${escapeHtml(project.effectiveSummary ?? '暂无项目有效摘要。')}</p>
      <div class="button-row">
        <button type="button" data-project-action="validate" data-project-id="${escapeHtml(project.projectId ?? '')}">验证</button>
        <button type="button" data-project-action="rescan" data-project-id="${escapeHtml(project.projectId ?? '')}">重新扫描</button>
        <button type="button" data-project-action="switch" data-project-id="${escapeHtml(project.projectId ?? '')}">切换</button>
        <button type="button" data-project-action="repair" data-project-id="${escapeHtml(project.projectId ?? '')}">修复</button>
        <button type="button" class="ghost-button" data-project-action="remove" data-project-id="${escapeHtml(project.projectId ?? '')}">移除</button>
      </div>
      <section class="page-section">
        <div class="content-header">
          <div>
            <p class="page-eyebrow">Skill 管理</p>
            <h3>项目详情 / Skill 面板</h3>
          </div>
          <span class="state-pill">单项目 · 单 Skill</span>
        </div>
        <p class="page-copy">绑定的 Skill、版本、启用状态、物化状态和有效本地摘要显示在此。</p>
        ${bindingsMarkup}
        <form class="stack-form" data-project-skill-form="bind" data-project-skill-bind-form="true">
          <input type="hidden" name="projectId" value="${escapeHtml(project.projectId ?? '')}" />
          <label>Skill ID<input name="skillId" type="text" placeholder="skill-market-1" required /></label>
          <label>包 ID<input name="packageId" type="text" placeholder="pkg-market-1" required /></label>
          <label>版本<input name="version" type="text" placeholder="1.0.0" required /></label>
          <label>Skills 目录<input name="skillsDirectory" type="text" value="${escapeHtml(project.skillsDirectory ?? '')}" /></label>
          <label>
            启用状态
            <select name="enabled">
              <option value="true">启用</option>
              <option value="false">禁用</option>
            </select>
          </label>
          <div class="form-actions full-span"><button type="submit">预览绑定 / 更新</button></div>
        </form>
      </section>
    </article>
  `;
}

function renderRegisterForm() {
  return `
    <div class="detail-section">
      <h2 class="detail-header">注册新项目</h2>
      <form class="stack-form" data-project-form="true">
        <label>显示名称<input name="displayName" type="text" placeholder="桌面工作区" required /></label>
        <label>项目路径<input name="projectPath" type="text" placeholder="C:\\Users\\you\\workspace\\project" required /></label>
        <div class="form-actions full-span"><button type="submit">注册项目</button></div>
      </form>
    </div>
  `;
}

export function createProjectsPage(app) {
  let selectedId = 'new';

  return createPageModule({
    id: 'projects',
    async render({ host }) {
      const state = app.store.getState();
      const projects = state.local.projects.items;

      if (!selectedId || (selectedId !== 'new' && !projects.find(i => i.projectId === selectedId))) {
        selectedId = projects.length ? projects[0].projectId : 'new';
      }

      const listHtml = projects.map((project) => `
        <div class="split-view__item${project.projectId === selectedId ? ' is-active' : ''}" data-id="${escapeHtml(project.projectId)}">
          <h3 class="split-view__item-title">${escapeHtml(project.displayName ?? project.projectId ?? '项目')}</h3>
          <p class="split-view__item-subtitle">${escapeHtml(project.projectPath ?? '无路径')}</p>
        </div>
      `).join('');

      const listNewHtml = `
        <div class="split-view__item split-view__action-item${selectedId === 'new' ? ' is-active' : ''}" data-id="new">
          <h3 class="split-view__item-title">+ 注册项目</h3>
        </div>
      `;

      host.innerHTML = `
        <div class="split-view">
          <div class="split-view__list">
            <div class="split-view__list-header">
              <h2>本地项目</h2>
            </div>
            ${listNewHtml}
            ${listHtml}
          </div>
          <div class="split-view__detail" id="projects-detail-container"></div>
        </div>
      `;

      bindSplitView(host, {
        selectedId,
        detailSelector: '#projects-detail-container',
        onSelect: (id) => { selectedId = id; },
        renderDetail: (id) => {
          if (id === 'new') {
            return renderRegisterForm();
          }
          const item = projects.find(i => i.projectId === id);
          return item ? renderProject(item, state.local.projects.currentProjectId) : '';
        },
      });
    },
  });
}
