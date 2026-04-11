import { renderMetric, renderNotice } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { canManage, canReview, escapeHtml } from '../core/utils.js';

function renderList(title, items, emptyText) {
  return `
    <section class="content-panel glass-panel overview-panel">
      <h2>${escapeHtml(title)}</h2>
      ${
        items.length
          ? `<div class="bullet-list">${items.map((item) => `<article class="bullet-list__item">${item}</article>`).join('')}</div>`
          : `<p class="page-copy">${escapeHtml(emptyText)}</p>`
      }
    </section>
  `;
}

export function createHomePage(app) {
  return createPageModule({
    id: 'home',
    async render({ host }) {
      const state = app.store.getState();
      const market = state.remote.market.results.slice(0, 3);
      const notifications = state.remote.notifications.items.slice(0, 3);
      const mySkills = state.remote.mySkills.items.slice(0, 3);
      const tools = state.local.tools.items.slice(0, 3);
      const projects = state.local.projects.items.slice(0, 3);
      const session = state.session;

      host.innerHTML = `
        <div class="page-header">
          <h1 class="page-header__title">工作区总览</h1>
          <span class="state-pill">${escapeHtml(state.health.label)}</span>
        </div>
        <div class="dashboard-container">
          ${state.flash ? renderNotice({ title: '系统通知', body: state.flash.message, tone: state.flash.tone ?? 'neutral' }) : ''}

          <section class="overview-grid">
            ${renderMetric({ label: '当前账户', value: session?.user?.username ?? '未登录', meta: session?.user?.roleCode ?? '访客' })}
            ${renderMetric({ label: '未读通知', value: String(state.notificationBadge), meta: state.realtime.message })}
            ${renderMetric({ label: '本地项目', value: String(state.local.projects.items.length), meta: '本地管理' })}
            ${renderMetric({ label: '系统状态', value: state.health.label, meta: state.health.apiBaseUrl })}
          </section>

          <div class="overview-cards">
            ${renderList(
              '最近通知',
              notifications.map(
                (item) => `<strong>${escapeHtml(item.title ?? item.category ?? '通知')}</strong><span class="inline-meta">${escapeHtml(item.body ?? item.message ?? '')}</span>`,
              ),
              '登录后可查看通知流。',
            )}

            ${renderList(
              '推荐 Skill',
              market.map(
                (item) => `<strong>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</strong><span class="inline-meta">${escapeHtml(item.summary ?? item.description ?? '暂无摘要')}</span>`,
              ),
              '市场推荐将在此显示。',
            )}

            ${renderList(
              '本地环境',
              [
                ...tools.map((tool) => `<strong>${escapeHtml(tool.displayName ?? tool.toolId ?? '工具')}</strong><span class="inline-meta">${escapeHtml(tool.healthState ?? '已注册')}</span>`),
                ...projects.map((project) => `<strong>${escapeHtml(project.displayName ?? project.projectId ?? '项目')}</strong><span class="inline-meta">${escapeHtml(project.projectPath ?? '')}</span>`),
              ],
              '暂无本地工具或项目。',
            )}

            ${session?.user ? renderList(
              '我的 Skill',
              mySkills.map(
                (skill) => `<strong>${escapeHtml(skill.title ?? skill.skillId ?? 'Skill')}</strong><span class="inline-meta">${escapeHtml(skill.summary ?? skill.description ?? '暂无摘要')}</span>`,
              ),
              '在此管理自己发布的 Skill。',
            ) : ''}

            ${canReview(session) || canManage(session) ? renderList(
              '管理队列',
              [
                `<strong>待审核</strong><span class="inline-meta">${escapeHtml(String(state.reviewBadge))} 条待处理</span>`
              ],
              '当前队列为空。',
            ) : ''}
          </div>
        </div>
      `;
    },
  });
}
