import { renderNotice, renderSectionHeader } from '../components/states.js';
import { createPageModule } from '../core/page-lifecycle.js';
import { escapeHtml } from '../core/utils.js';

export function createSettingsPage(app) {
  return createPageModule({
    id: 'settings',
    async render({ host }) {
      const settings = app.store.getState().local.settings.data;
      host.innerHTML = `
        ${renderSectionHeader({ eyebrow: 'Desktop policy', title: 'Settings', body: '设置页负责桌面代理地址、扫描命令与外观策略。' })}
        <section class="content-panel glass-panel page-section">
          <form class="stack-form" data-settings-form="true">
            <label>API base URL<input name="apiBaseUrl" type="text" value="${escapeHtml(settings?.execution?.apiBaseUrl ?? '')}" placeholder="http://127.0.0.1:8787" /></label>
            <label>Scan commands<input name="scanCommands" type="text" value="${escapeHtml((settings?.execution?.scanCommands ?? []).join(','))}" placeholder="node,pnpm,git,python3,sqlite3,cargo" /></label>
            <label>
              Default project behavior
              <select name="defaultProjectBehavior">
                <option value="last-active">last-active</option>
                <option value="manual">manual</option>
              </select>
            </label>
            <label>
              Appearance
              <select name="appearance">
                <option value="system">system</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
              </select>
            </label>
            <label>
              Update channel
              <select name="updateChannel">
                <option value="stable">stable</option>
                <option value="preview">preview</option>
              </select>
            </label>
            <div class="form-actions full-span"><button type="submit">Save settings</button></div>
          </form>
        </section>
        ${settings ? renderNotice({ title: '当前设置摘要', body: `API Base URL: ${settings.execution?.apiBaseUrl ?? '未配置'}；存储模式：${settings.storage?.mode ?? 'managed_sqlite'}`, tone: 'neutral' }) : renderNotice({ title: '等待设置数据', body: '桌面设置将在加载后显示。', tone: 'neutral' })}
      `;
    },
  });
}

