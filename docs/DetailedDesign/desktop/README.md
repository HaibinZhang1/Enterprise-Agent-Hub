# 桌面端模块设计

## 模块索引
- [分域架构](./00_desktop_architecture.md)
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
