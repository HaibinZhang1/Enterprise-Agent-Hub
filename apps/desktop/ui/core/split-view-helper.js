/**
 * split-view-helper.js
 *
 * 通用的 split-view 列表-详情交互绑定。
 * 通过 CSS class (.is-active) 驱动选中态，不直接操作 style。
 * 使用事件委托减少重复绑定。
 */

/**
 * 绑定 split-view 交互。
 *
 * @param {HTMLElement} host - 页面宿主容器
 * @param {Object} options
 * @param {string} options.selectedId - 当前选中 ID
 * @param {string} options.detailSelector - 详情容器选择器
 * @param {function} options.onSelect - 选中回调: (id) => void
 * @param {function} options.renderDetail - 渲染详情: (id) => string
 */
export function bindSplitView(host, { selectedId, detailSelector, onSelect, renderDetail }) {
  const detailContainer = host.querySelector(detailSelector);
  const listContainer = host.querySelector('.split-view__list');
  if (!detailContainer || !listContainer) return;

  // 初始渲染详情
  if (selectedId) {
    detailContainer.innerHTML = renderDetail(selectedId);
  }

  // 使用事件委托监听列表点击
  listContainer.addEventListener('click', (e) => {
    const item = e.target.closest('.split-view__item');
    if (!item || !item.dataset.id) return;

    const newId = item.dataset.id;

    // 更新列表项的 active 状态（仅操作 class）
    listContainer.querySelectorAll('.split-view__item').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.id === newId);
    });

    // 通知外部状态变更
    onSelect(newId);

    // 更新详情区
    detailContainer.innerHTML = renderDetail(newId);
  });
}
