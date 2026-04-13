# P1 交付进度归档（2026-04-12）

## 1. 结论

P1 已完成从文档规划到工程骨架、服务端、Desktop 前端、Rust Store/Adapter、部署脚本和验证门禁的主要落地。当前状态更准确地说是：**工程门禁通过，最小纵向链路已打通，目标环境实机验收待补齐**。

当前不再是“从 0 打通第一条链路”的阶段。更贴近事实的下一步是：在已经验证的链路基础上，补齐 `disable/uninstall`、项目目标持久化、SQLite 离线事件恢复同步，以及 Windows `.exe` / Linux Docker 的目标环境实机验收。

## 2. 证据来源

| 证据 | 当前记录 |
| --- | --- |
| 严格门禁 | `verification/reports/p1-verification-report.md` 记录 `Overall status: PASS`，12/12 命令通过，13/13 验收场景覆盖。 |
| 打包/部署证据 | `docs/Verification/p1-packaging-deployment-evidence.md` 记录 Compose 配置、脚本语法、TypeScript/Rust 测试、Tauri no-bundle 编译通过；同时记录 Docker daemon 和 Windows NSIS 打包阻塞。 |
| Adapter fixture 证据 | `docs/Verification/p1-fixture-acceptance-report.md` 记录 Codex、Claude、Cursor、Windsurf、opencode、自定义目录 fixture 覆盖，以及 symlink 失败 copy fallback 语义。 |
| 工程状态 | 当前仓库已有 `apps/api`、`apps/desktop`、`packages/shared-contracts`、`packages/tool-adapter-fixtures`、`infra`、`deploy`、`scripts/verification`、`tests/smoke`。 |

## 3. P1 任务进度

| 任务 | 当前进度 | 说明 |
| --- | --- | --- |
| P1-T01 工程骨架与共享契约 | 已完成 | Root workspace、共享契约包、基础脚本和 DTO/枚举门禁已落地。 |
| P1-T02 基础设施与服务端底座 | 部分完成 | Compose、env 模板、部署脚本、PostgreSQL/Redis/MinIO 服务形态和健康检查脚本已落地；本机 Docker daemon 不可用，尚未取得 live `/health status=ok` 运行证据。 |
| P1-T03 P1 服务端 API | 已完成 | Auth、Bootstrap、Skills、Download Ticket、Star、Notifications、Local Events 等接口、测试和 source-smoke 脚本已落地；剩余 live API 烟测归入部署实机验证缺口。 |
| P1-T04 PostgreSQL FTS 与种子数据 | 部分完成 | PostgreSQL schema、FTS 对象和 seed SQL 已存在；当前服务层仍有内存过滤/排序路径，需在 live 数据库上验证并收敛为数据库查询口径。 |
| P1-T05 Desktop React 主框架 | 已完成 | React P1 页面、真实 API client、Tauri bridge 和浏览器预览保护已落地；安装/更新/启用已走真实桥接命令，未完成项集中在 `disable/uninstall` 的应用侧闭环。 |
| P1-T06 Rust SQLite 与 Central Store | 已完成（最小闭环） | `install_skill_package` / `update_skill_package` 已下载、校验、写入 Central Store 与 SQLite，`list_local_installs` / `get_local_bootstrap` 可恢复本地状态；`disable/uninstall` 和项目配置持久化仍待补齐。 |
| P1-T07 Tool Adapter 与启用分发 | 已完成（Codex 纵向链路） | 内置 Adapter、格式转换、symlink-first/copy-fallback、fixture 和 Rust 测试已覆盖；`enable_skill` 已接到 Codex 目标分发并记录 `requestedMode` / `resolvedMode` / `fallbackReason`。 |
| P1-T08 离线队列与恢复同步 | 部分完成 | API `/desktop/local-events`、前端同步入口，以及启用结果写入 SQLite `offline_event_queue` / bootstrap 计数已存在；重启后从 SQLite 恢复事件并继续同步的闭环仍待补齐。 |
| P1-T09 通知与状态闭环 | 部分完成 | 服务端通知、前端通知、`mark-read` 和本地未读计数入口已存在；`local_notifications` 的持久化写入与离线已读恢复还需要端到端补齐。 |
| P1-T10 验收与打包 | 部分完成 | 严格门禁、no-bundle Tauri 编译、Compose config 和脚本语法通过；Windows NSIS `.exe` 与 Linux live Docker 部署未在目标环境验证。 |

## 4. 已完成归档

- 需求边界和 P1/P2/P3 范围已澄清，P1 不包含发布、审核、管理台、MCP、插件和多端客户端。
- monorepo 基础结构已建立，根目录 workspace、Desktop、API、共享契约、Adapter fixture、部署和验证目录均已出现。
- P1 服务端从静态 seed 方向推进到 PostgreSQL-backed 路径，接口覆盖登录、bootstrap、市场、详情、download-ticket、Star、通知和本地事件。
- Desktop 前端已从静态原型推进到 React + Vite + Tauri 入口，真实 API client 默认指向 `http://127.0.0.1:3000`。
- Rust Store/Adapter 已有 Central Store、SQLite schema、离线队列 statement、内置工具转换、symlink/copy 分发和 fixture 测试。
- 最小纵向链路已验证：真实 API `download-ticket` -> Tauri 安装/更新 -> Central Store + SQLite -> Codex 启用 -> 重启后 `list_local_installs` 恢复状态。
- 交付证据文档已从“待 worker 集成模板”改写为当前验证证据。

## 5. 部分完成和风险

- Docker live 部署未验证：当前机器无法连接 Docker daemon，只能证明 Compose 配置和脚本语法。
- Windows `.exe` 未生成：当前 macOS Tauri CLI 不能产出 NSIS installer，需要 Windows 打包机或 CI runner。
- `disable_skill` / `uninstall_skill` 仍未接到应用级 Tauri 命令，当前最小闭环只覆盖安装、更新、启用和恢复读取。
- 项目配置与项目目标启用仍未进入 SQLite 真源，`get_local_bootstrap` 目前返回的项目列表仍为空。
- SQLite 离线队列已能记录启用结果并返回 pending 计数，但重启后恢复事件内容并继续同步的闭环尚未完成。
- 市场搜索需要从“可验收数据量的内存过滤”收敛到 PostgreSQL FTS 查询，避免数据量上来后行为和性能漂移。

## 6. 最快推进可用客户端的下一步

1. 补齐 `disable_skill` / `uninstall_skill`：让“安装/更新/启用/停用/卸载”在同一套 SQLite / Store / Adapter 真源上闭环。
2. 把项目配置和项目目标启用接到 SQLite：`get_local_bootstrap` 返回持久化项目列表，而不是空数组。
3. 让离线队列真正从 SQLite 恢复：重启后能读出待同步事件内容，并继续调用 `/desktop/local-events`。
4. 在可用 Docker daemon 的 Linux 环境跑 `./deploy/server-up.sh`，取得 live `/health status=ok` 证据。
5. 在 Windows 主机或 CI runner 生成 NSIS `.exe`，并重复最小纵向链路的安装/启用/重启烟测。
