import { renderMetric, renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { canManage, canReview, escapeHtml } from '../core/utils.js';

function renderList(title, items, emptyText) {
  return `
    <section class="content-panel glass-panel page-section">
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
        ${renderSectionHeader({
          eyebrow: 'Desktop summary workspace',
          title: 'Home',
          body: '首页现在是摘要工作台，集中展示连接、通知、推荐 Skill、本地环境和管理员待办。',
        })}
        <section class="metric-grid">
          ${renderMetric({ label: '连接状态', value: state.health.label, meta: state.health.apiBaseUrl })}
          ${renderMetric({ label: '当前账号', value: session?.user?.username ?? '未登录', meta: session?.user?.roleCode ?? 'guest' })}
          ${renderMetric({ label: '未读通知', value: String(state.notificationBadge), meta: state.realtime.message })}
          ${renderMetric({ label: '本地项目', value: String(state.local.projects.items.length), meta: 'Projects page' })}
        </section>
        ${state.flash ? renderNotice({ title: '状态提示', body: state.flash.message, tone: state.flash.tone ?? 'neutral' }) : ''}
        ${renderList(
          '最近通知摘要',
          notifications.map(
            (item) => `<strong>${escapeHtml(item.title ?? item.category ?? '通知')}</strong><span>${escapeHtml(item.body ?? item.message ?? '')}</span>`,
          ),
          '登录后可查看通知摘要与实时更新。',
        )}
        ${renderList(
          '推荐或最近访问的 Skill',
          market.map(
            (item) => `<strong>${escapeHtml(item.title ?? item.skillId ?? 'Skill')}</strong><span>${escapeHtml(item.summary ?? item.description ?? '暂无摘要')}</span>`,
          ),
          '市场数据会在登录后显示推荐或最近访问的 Skill。',
        )}
        ${renderList(
          '本地环境摘要',
          [
            `<strong>工具状态</strong><span>${escapeHtml(state.local.tools.message)}</span>`,
            `<strong>项目状态</strong><span>${escapeHtml(state.local.projects.message)}</span>`,
            `<strong>桌面设置</strong><span>${escapeHtml(state.local.settings.message)}</span>`,
            ...tools.map((tool) => `<strong>${escapeHtml(tool.toolId ?? tool.displayName ?? 'Tool')}</strong><span>${escapeHtml(tool.healthState ?? tool.summary ?? 'Unknown')}</span>`),
            ...projects.map((project) => `<strong>${escapeHtml(project.displayName ?? project.projectId ?? 'Project')}</strong><span>${escapeHtml(project.projectPath ?? '')}</span>`),
          ],
          '本地桌面工具、项目和设置摘要会在这里展示。',
        )}
        ${
          session?.user
            ? renderList(
                '我的 Skill 摘要',
                mySkills.map(
                  (skill) => `<strong>${escapeHtml(skill.title ?? skill.skillId ?? 'My Skill')}</strong><span>${escapeHtml(skill.summary ?? skill.description ?? '暂无摘要')}</span>`,
                ),
                '已登录普通用户可在这里看到“我的 Skill”摘要。',
              )
            : renderNotice({ title: '我的 Skill 摘要', body: '登录后可在首页摘要查看最近维护的 Skill。', tone: 'neutral' })
        }
        ${
          canReview(session) || canManage(session)
            ? renderList(
                '待审核摘要',
                [
                  `<strong>待处理审核</strong><span>${escapeHtml(String(state.reviewBadge))} 个 ticket 需要关注</span>`,
                  `<strong>管理入口</strong><span>部门管理 / 用户管理 / Skill 管理 已经归属到 Management 页面</span>`,
                ],
                '管理员摘要暂时为空。',
              )
            : ''
        }
      `;
    },
  });
}

