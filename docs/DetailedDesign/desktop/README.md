# 桌面端模块设计

## 模块索引
- [分域架构](./00_desktop_architecture.md)
- [desktop frontend shell refactor](./frontend-shell-refactor.md)
- [tool-scanner](./tool-scanner.md)
- [project-manager](./project-manager.md)
- [skill-sync](./skill-sync.md)
- [conflict-resolver](./conflict-resolver.md)
- [local-state](./local-state.md)
- [desktop-notify](./desktop-notify.md)
- [updater](./updater.md)

## 桌面端统一原则
- 以服务端市场与权限为权威，以本地 SQLite 为执行缓存
- refresh token 不落 SQLite，仅走 OS 安全存储
- 本地文件操作必须可回滚、可重试、可审计到安装记录
- Tool Adapter 隔离不同 AI 工具路径、格式和安装方式差异

## 当前前端维护约束
- `apps/desktop/ui` 的当前维护方向是“桌面壳 + 顶部栏 + 单活动页面出口”，不再把长页面仪表盘视为目标形态
- 页面级能力必须落到 `home` / `market` / `my-skill` / `review` / `management` / `tools` / `projects` / `notifications` / `settings`
- `ui/core/page-registry.js` 是页面可见性、路由保护、badge 与安全回退的当前单一事实源
- `ui/app.js`、`ui/index.html`、`ui/style.css` / `ui/styles.css` 仍是提取与清理重点，应按 `frontend-shell-refactor.md` 约束继续收敛
