import { escapeHtml, summarizePreviewSide } from '../core/utils.js';

export function renderPreviewPanel(previewState) {
  if (!previewState) {
    return '';
  }

  const isDraft = previewState.mode === 'draft';

  return `
    <aside class="preview-drawer" aria-label="本地预览确认">
      <div class="preview-drawer__header">
        <div>
          <p class="page-eyebrow">Preview-first repair</p>
          <h2>${escapeHtml(previewState.title)}</h2>
        </div>
        <button type="button" class="modal-close" data-preview-dismiss="true">关闭</button>
      </div>
      <div class="preview-drawer__body">
        <div class="preview-block">
          <span>当前状态</span>
          <strong>${escapeHtml(isDraft ? previewState.currentSummary : summarizePreviewSide(previewState.preview.currentLocalSummary))}</strong>
        </div>
        <div class="preview-block">
          <span>即将变更</span>
          <strong>${escapeHtml(isDraft ? '先构建预览以检查确切变更。' : summarizePreviewSide(previewState.preview.incomingSummary))}</strong>
        </div>
        <div class="preview-block preview-block--full">
          <span>影响说明</span>
          <p>${escapeHtml(isDraft ? previewState.impact : previewState.preview.consequenceSummary ?? '无额外影响摘要。')}</p>
        </div>
        ${
          isDraft
            ? `
              <label class="preview-block preview-block--full">
                修复路径
                <input type="text" data-preview-path="true" value="${escapeHtml(previewState.pathValue ?? '')}" />
              </label>
            `
            : ''
        }
        <div class="preview-block preview-block--full">
          <span>状态</span>
          <p>${escapeHtml(previewState.statusMessage)}</p>
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="ghost-button" data-preview-dismiss="true">取消</button>
        ${
          isDraft
            ? '<button type="button" data-preview-build="true">构建预览</button>'
            : `<button type="button" data-preview-confirm="true">${escapeHtml(previewState.confirmLabel ?? '确认变更')}</button>`
        }
      </div>
    </aside>
  `;
}
