import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

export function createSettingsPage(app) {
  return createPageModule({
    id: 'settings',
    async render({ host }) {
      const settings = app.store.getState().local.settings.data;
      host.innerHTML = `
        <div class="page-header">
          <div>
            <p class="page-eyebrow">桌面配置</p>
            <h1 class="page-header__title">设置</h1>
          </div>
        </div>
        <div class="page-padded">
          <section class="content-panel glass-panel page-section">
            <form class="stack-form" data-settings-form="true">
              <label>API 地址<input name="apiBaseUrl" type="text" value="${escapeHtml(settings?.execution?.apiBaseUrl ?? '')}" placeholder="http://127.0.0.1:8787" /></label>
              <label>扫描命令<input name="scanCommands" type="text" value="${escapeHtml((settings?.execution?.scanCommands ?? []).join(','))}" placeholder="node,pnpm,git,python3,sqlite3,cargo" /></label>
              <label>
                默认项目行为
                <select name="defaultProjectBehavior">
                  <option value="last-active">上次活跃</option>
                  <option value="manual">手动选择</option>
                </select>
              </label>
              <label>
                外观
                <select name="appearance">
                  <option value="system">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </label>
              <label>
                更新通道
                <select name="updateChannel">
                  <option value="stable">稳定版</option>
                  <option value="preview">预览版</option>
                </select>
              </label>
              <div class="form-actions full-span"><button type="submit">保存设置</button></div>
            </form>
          </section>
          ${settings ? renderNotice({ title: '当前设置摘要', body: `API 地址：${settings.execution?.apiBaseUrl ?? '未配置'} ｜ 存储模式：${settings.storage?.mode ?? 'managed_sqlite'}`, tone: 'neutral' }) : renderNotice({ title: '等待设置数据', body: '桌面设置将在加载后显示。', tone: 'neutral' })}
        </div>
      `;
    },
  });
}
