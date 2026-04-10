import { escapeHtml } from '../core/utils.js';

export function renderDialog(dialog) {
  if (!dialog) {
    return '';
  }

  if (dialog.type === 'login') {
    return `
      <div class="modal-backdrop" data-close-dialog="true"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <div class="modal-card__header">
          <div>
            <p class="page-eyebrow">身份验证</p>
            <h2 id="auth-dialog-title">${escapeHtml(dialog.title ?? '登录企业内网账号')}</h2>
          </div>
          <button type="button" class="modal-close" data-close-dialog="true">关闭</button>
        </div>
        <p class="modal-copy">${escapeHtml(dialog.message ?? '该功能需要登录后使用。')}</p>
        <form class="dialog-form" data-login-form="true">
          <label>
            用户名
            <input name="username" type="text" value="${escapeHtml(dialog.username ?? 'admin')}" autocomplete="username" />
          </label>
          <label>
            密码
            <input name="password" type="password" value="${escapeHtml(dialog.password ?? 'admin')}" autocomplete="current-password" />
          </label>
          <div class="dialog-actions">
            <button type="button" class="ghost-button" data-close-dialog="true">取消</button>
            <button type="submit">立即登录</button>
          </div>
          <p class="dialog-status">${escapeHtml(dialog.status ?? '请先登录企业内网账号。')}</p>
        </form>
      </div>
    `;
  }

  if (dialog.type === 'message') {
    return `
      <div class="modal-backdrop" data-close-dialog="true"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="message-dialog-title">
        <div class="modal-card__header">
          <h2 id="message-dialog-title">${escapeHtml(dialog.title ?? '提示')}</h2>
          <button type="button" class="modal-close" data-close-dialog="true">关闭</button>
        </div>
        <p class="modal-copy">${escapeHtml(dialog.message ?? '')}</p>
        <div class="dialog-actions">
          <button type="button" data-close-dialog="true">知道了</button>
        </div>
      </div>
    `;
  }

  return '';
}
