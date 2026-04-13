# P1 交付进度盘点（2026-04-13）

## 1. 盘点结论

当前仓库已经明显超过“只有原型/只有方案”的阶段，进入了 **P1 工程主链已落地、严格门禁持续通过、目标环境验收仍有缺口** 的状态。

和 [P1 Desktop 使用闭环 PRD](../RequirementDocument/20_p1_desktop_prd.md)、[P1 Desktop 数据契约](../RequirementDocument/21_p1_data_contract.md)、[P1 Tool Adapter 配置契约](../RequirementDocument/22_p1_tool_adapter_contract.md)、[P1 Desktop 交互规格](../RequirementDocument/23_p1_interaction_spec.md) 对照后，当前最准确的判断是：

- `apps/api`、`apps/desktop`、`apps/desktop/src-tauri`、`packages/shared-contracts`、`packages/tool-adapter-fixtures`、`infra`、`deploy`、`scripts/verification` 已形成完整 P1 工程骨架。
- 2026-04-13 再次执行 `node scripts/verification/p1-verify.mjs --strict`，结果仍为 `PASS`。
- Desktop 本地闭环已经覆盖：安装、更新、启用、停用、卸载、项目配置持久化、SQLite 恢复、离线事件恢复与同步确认。
- 当前主要缺口已经不再是旧文档里写的 `disable/uninstall` 或“项目目标持久化”，而是 **目标环境实机验收** 与 **少数契约/交互细节未完全对齐**。

## 2. 盘点依据

本次盘点主要依据：

- 需求文档：`docs/RequirementDocument/20-23`
- 当前工程目录：`apps/api`、`apps/desktop`、`apps/desktop/src-tauri`、`packages/shared-contracts`、`packages/tool-adapter-fixtures`
- 验证产物：`verification/reports/p1-verification-report.md`
- 验证脚本：`scripts/verification/p1-verify.mjs`
- 关键实现与测试：
  - `apps/desktop/src-tauri/src/commands/local_state.rs`
  - `apps/desktop/src/ui/desktopPages.tsx`
  - `apps/api/src/skills/skills.service.ts`
  - `apps/api/src/admin/admin.service.ts`
  - `tests/smoke/p1-real-delivery-static.test.mjs`

## 3. 需求对照矩阵

| 模块 | 需求口径 | 实际进度 | 判断 |
| --- | --- | --- | --- |
| 工程骨架与共享契约 | P1 需要 Desktop、API、共享契约、部署与验证入口 | monorepo、workspace、shared contracts、fixture 包、验证脚本均已落地 | 已完成 |
| Desktop 主框架与游客优先登录 | 游客先进入本地模式；登录后同步市场、通知、管理员权限 | 首页、市场、我的 Skill、工具、项目、通知、设置、审核、管理均已实现；登录/失效/回退本地模式链路已接上 | 已完成 |
| 市场浏览 / 搜索 / 详情 | 搜索、筛选、排序、受限详情、下载凭证安装 | 市场列表、详情、受限详情、Star、download-ticket 安装/更新已接上真实 API | 大部分完成 |
| 我的 Skill | 已安装列表、更新、卸载、启用范围、权限收缩提示 | 已安装筛选、异常提示、更新、编辑启用范围、卸载确认均已实现 | 已完成 |
| Tool / Project / Adapter | 工具探测、手动路径、项目路径、symlink 优先 copy 降级、停用/卸载安全 | 内置 Adapter、项目配置持久化、目标扫描、overwrite 确认、停用/卸载、Central Store 保留规则均已落地；fixture 与 Rust 测试覆盖 6 类目标 | 已完成 |
| 本地状态与离线同步 | SQLite 持久化、本地事件恢复、联网后同步 | `offline_event_queue`、重启恢复、`mark_offline_events_synced`、`/desktop/local-events` 已落地 | 已完成 |
| 通知中心 | 服务端通知 + 本机通知 + 已读状态 | 服务端通知、全部已读、同步入口已落地；但本机通知持久化未真正接通 SQLite | 部分完成 |
| 在线管理员审核 / 管理 | 审核只读；管理走真实后端 | 审核列表/详情/历史、部门/用户/Skill 管理接口与页面已存在 | 已完成（当前阶段口径） |
| Linux 服务端部署 | Linux Docker 一键部署与 live 健康检查 | Compose、env、脚本、健康检查与 seed/migrate 已落地，但当前机器无 Docker daemon，缺 live 证据 | 部分完成 |
| Windows exe 打包 | NSIS 安装包 | Tauri NSIS 配置与脚本已存在，但当前 macOS 主机未产出 Windows 安装包 | 部分完成 |

## 4. 实际偏差

以下偏差是当前仓库和需求目标之间仍然真实存在的差距：

1. **目标环境验收未完成**
   - Linux live Docker 部署尚无 `server-up.sh -> /health status=ok` 的实机证据。
   - Windows NSIS `.exe` 尚无真实构建产物与安装烟测证据。

2. **通知中心的“本机通知持久化”未完成**
   - SQLite migration 已有 `local_notifications` 表。
   - 但当前实现只统计未读数量，没有把安装/启用/停用/卸载结果真正写入并在重启后恢复展示。
   - 这意味着“通知页”对服务端通知是成立的，对本机通知仍是内存级表现。

3. **市场筛选与数据契约仍有细节未完全对齐**
   - UI 尚未提供 `category`、发布时间、更新时间等增强筛选入口。
   - 服务端 `GET /skills` 虽声明了 `installed` / `enabled` 查询参数，但当前 SQL 计划并未真正消费这两个参数。
   - 现阶段页面仍可用，因为安装/启用筛选主要由 Desktop 本地状态二次过滤完成；但这和数据契约不是完全同源。

## 5. 文档口径漂移

本次对照还发现文档之间存在两类“文档已落后于实现”的情况：

1. **旧进度文档低估了已完成范围**
   - `disable/uninstall`
   - 项目配置持久化
   - 项目目标启用
   - SQLite 重启恢复
   以上能力都已经进入当前代码和 Rust 测试，不应再列为“尚未实现”。

2. **需求子文档内部仍有旧口径残留**
   - [15_core_flows.md](../RequirementDocument/15_core_flows.md) 仍保留了 copy-only 叙述。
   - 但 P1 定稿 PRD、Tool Adapter 契约、交互规格、fixture 验收与当前实现均已切到“symlink 优先，失败自动 copy”。

本轮先更新进度归档，不直接改需求正文；后续若要统一需求全集口径，应优先清理该类残留描述。

## 6. 当前最准确的项目状态

如果只看仓库与门禁，P1 可以被定义为：

> **P1 工程闭环已成立，严格验证持续通过；距离“目标环境可交付完成”还差 Linux live 部署、Windows 打包实机验证，以及少量通知/契约对齐收尾。**

不应再使用以下旧说法：

- “P1 还没打通 disable/uninstall”
- “项目目标还没进入 SQLite 真源”
- “Desktop 仍主要停留在单一 Codex 纵向切片”

## 7. 建议的下一步

1. 先补通知持久化：把本机操作结果写入 `local_notifications` 并恢复已读状态。
2. 收口市场契约：补齐 `/skills` 的 `installed` / `enabled` 查询实现，评估是否补上 `category` / 时间筛选 UI。
3. 找到可用 Linux Docker 环境执行 `./deploy/server-up.sh`，补 live 健康检查证据。
4. 在 Windows 主机或 CI runner 执行 `npm run tauri:build:windows --workspace apps/desktop` 并补 `.exe` 安装烟测证据。
