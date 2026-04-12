# P1 交付进度归档（2026-04-12）

## 1. 结论

P1 已完成从文档规划到工程骨架、服务端、Desktop 前端、Rust Store/Adapter、部署脚本和验证门禁的主要落地。当前状态更准确地说是：**工程门禁通过，真实客户端闭环收尾中**。

最快形成一个“能用的客户端”，下一步应集中打通单一纵向链路：登录真实 API -> 获取 download-ticket -> 下载一个种子 Skill 包 -> 写入 Central Store 和 SQLite -> 启用到一个内置目标（优先 Codex）-> 重启后状态可恢复 -> 在 Windows 主机生成并烟测 `.exe`。

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
| P1-T03 P1 服务端 API | 部分完成 | Auth、Bootstrap、Skills、Download Ticket、Star、Notifications、Local Events 已接入 PostgreSQL 查询；仍需要用部署脚本跑 live API 烟测。 |
| P1-T04 PostgreSQL FTS 与种子数据 | 部分完成 | PostgreSQL schema、FTS 对象和 seed SQL 已存在；当前服务层仍有内存过滤/排序路径，需在 live 数据库上验证并收敛为数据库查询口径。 |
| P1-T05 Desktop React 主框架 | 部分完成 | React P1 页面和真实 API client 已落地，浏览器 mock 只能通过显式 env flag 启用；本地安装/启用写入仍依赖 Tauri 命令进一步打通。 |
| P1-T06 Rust SQLite 与 Central Store | 部分完成 | SQLite schema、Central Store 写入/更新/卸载核心和测试已存在；Tauri 命令仍未接入应用级 SQLite adapter 和真实 downloaded package 参数。 |
| P1-T07 Tool Adapter 与启用分发 | 部分完成 | 内置 Adapter、格式转换、symlink-first/copy-fallback、fixture 和 Rust 测试已覆盖；Tauri `enable_skill` 命令仍返回集成错误，尚未连接 UI 输入与 Store 状态。 |
| P1-T08 离线队列与恢复同步 | 部分完成 | API `/desktop/local-events` 和前端同步入口已存在；离线队列仍主要是前端状态，尚未完成 SQLite 持久化端到端恢复验证。 |
| P1-T09 通知与状态闭环 | 部分完成 | 服务端通知、前端通知和本地操作通知路径已存在；离线已读、路径异常跳转、同步通知持久化还需要端到端补齐。 |
| P1-T10 验收与打包 | 部分完成 | 严格门禁、no-bundle Tauri 编译、Compose config 和脚本语法通过；Windows NSIS `.exe` 与 Linux live Docker 部署未在目标环境验证。 |

## 4. 已完成归档

- 需求边界和 P1/P2/P3 范围已澄清，P1 不包含发布、审核、管理台、MCP、插件和多端客户端。
- monorepo 基础结构已建立，根目录 workspace、Desktop、API、共享契约、Adapter fixture、部署和验证目录均已出现。
- P1 服务端从静态 seed 方向推进到 PostgreSQL-backed 路径，接口覆盖登录、bootstrap、市场、详情、download-ticket、Star、通知和本地事件。
- Desktop 前端已从静态原型推进到 React + Vite + Tauri 入口，真实 API client 默认指向 `http://127.0.0.1:3000`。
- Rust Store/Adapter 已有 Central Store、SQLite schema、离线队列 statement、内置工具转换、symlink/copy 分发和 fixture 测试。
- 交付证据文档已从“待 worker 集成模板”改写为当前验证证据。

## 5. 部分完成和风险

- Docker live 部署未验证：当前机器无法连接 Docker daemon，只能证明 Compose 配置和脚本语法。
- Windows `.exe` 未生成：当前 macOS Tauri CLI 不能产出 NSIS installer，需要 Windows 打包机或 CI runner。
- Tauri 写入命令未端到端打通：`install_skill_package`、`update_skill_package`、`enable_skill`、`disable_skill`、`uninstall_skill` 在 `main.rs` 中仍显式返回集成错误。
- SQLite 本地状态尚未成为 UI 真源：Rust schema 和 statements 已有，但应用 runtime adapter、持久化读取和重启恢复仍需补齐。
- 市场搜索需要从“可验收数据量的内存过滤”收敛到 PostgreSQL FTS 查询，避免数据量上来后行为和性能漂移。

## 6. 最快推进可用客户端的下一步

1. 先做单一纵向链路，不扩 P2/P3：选择一个种子 Skill 和一个目标工具（建议 Codex），从登录到安装再到启用跑通。
2. 打通 download-ticket 到 Tauri Store：前端拿到 ticket 后下载到临时目录，把 `skillID`、`version`、`downloadedPackageDir`、`expectedPackageHash` 传给 Rust，写入 Central Store。
3. 把 SQLite 接到 Tauri 命令：安装后 upsert `local_skill_installs`，启用后 upsert `enabled_targets` 和 `offline_event_queue`，`get_local_bootstrap`/`list_local_installs` 从 SQLite 读。
4. 把 `enable_skill` 接到 Adapter 分发：从 SQLite 读 Central Store 路径和目标配置，调用已有 `enable_distribution`，记录 `requestedMode`、`resolvedMode`、`fallbackReason`。
5. 做最小实机烟测：本地或服务器启动 API + PostgreSQL seed，Desktop 登录后完成安装/启用/重启恢复；随后在 Windows 主机生成 NSIS `.exe` 并重复同一条链路。
