# 桌面端分域架构设计

## 1. 架构形态
- Windows-first 的 Tauri 2 客户端
- 本地采用 Central Store + Registry + Tool Adapter + Sync Engine
- SQLite 是桌面端本地状态仓
- 服务端通过 REST/SSE 提供市场、权限、通知与更新事实

## 2. 领域拆分
- `tool-scanner`：工具探测与默认路径识别
- `project-manager`：项目路径与项目级 Skill 根目录管理
- `skill-sync`：下载、安装、启用、停用、更新、卸载、修复
- `conflict-resolver`：冲突检测与用户决议
- `local-state`：SQLite 与离线状态
- `desktop-notify`：桌面通知与红点同步
- `updater`：Skill 更新检查与升级执行

## 3. 统一约束
- refresh token 仅走 OS 安全存储
- SQLite 不存服务端权威权限，不存 refresh token
- 所有本地文件操作必须可回滚、可重试、可对账
- 离线时可浏览缓存与使用已安装能力，但禁止 install/update/publish/review/search

## 4. 推荐分层
- Local-only 控制面：`tool-scanner` / `project-manager` / `conflict-resolver` / `local-state`
- Server-integrated 执行面：`skill-sync` / `desktop-notify` / `updater`

## 5. 核心张力
1. 中央仓一致性 vs copy 模式下的重复存储
2. 自动化冲突处理 vs 误伤用户本地自定义文件
3. 离线能力 vs 本地状态漂移风险
4. Windows 优先实现 vs 后续跨平台兼容
