# 详细设计实施交接说明

## 1. 文档目的
本文档将详细设计包转换为“可执行的落地入口”，用于帮助实施、测试、评审三类角色在真正开始编码前对齐：
- 先做什么，后做什么
- 哪些契约必须先冻结
- 哪些设计文档分别约束 backend / web / desktop / deployment
- 每一阶段以什么证据作为通过标准

> 约束说明：当前仓库仍以需求文档与详细设计文档为主，尚未存在可复用的应用骨架、共享契约包或自动化测试基线，因此实施必须先完成基础骨架与 Phase 0.5 契约冻结，再进入并行编码。

> 当前发布边界（2026-04-09）：本交接文档中的 web/frontend 并行 lane 是完整产品蓝图的历史实施建议；Windows-first 内网生产发布的产品/演示入口仅为 `apps/desktop`。本轮不得把 `apps/web`、发布/审核页面或 Web MVP 作为发布验收依赖。

## 2. 当前审阅结论

### 2.1 已具备的实施基础
- 详细设计已覆盖四层系统边界：React/Tauri 客户端、REST/SSE、NestJS 服务、PostgreSQL/File Volume/SQLite。
- Auth 方案已单独定稿，可作为后续所有受保护接口与客户端行为的固定基线。
- 前端页面、服务端模块、桌面端模块都已按领域拆分，具备按垂直切片实施的条件。

### 2.2 当前仍缺失的落地前置项
- **缺少仓库级工程骨架**：尚无 backend / web / desktop / shared-contracts / test-harness 的实际目录与脚手架。
- **缺少契约冻结产物**：`AUTHZ_RECALC_PENDING`、auth/org 收敛语义、install/reconcile 状态枚举、SSE payload、事实权威矩阵仍未以共享 fixture 形式固化。
- **缺少阶段门禁证据模板**：如果直接并行开发，容易在 DTO、枚举、错误码、SSE 事件上产生漂移。

### 2.3 实施结论
1. 必须先完成 **Phase 0（工程骨架）**。
2. 紧接着完成 **Phase 0.5（共享契约冻结）**。
3. 只有在 0.5 门禁通过后，才能拆成 backend / web / desktop / infra / QA 并行工作。

## 3. 建议阅读顺序
1. [总体架构](./architecture/01_system_architecture.md)
2. [Auth 模块专用设计](./auth/README.md)
3. [服务端模块设计](./backend/README.md)
4. [桌面端模块设计](./desktop/README.md)
5. [前端页面设计](./frontend-pages/README.md)
6. [数据层设计](./data/01_data_architecture.md)
7. [部署层设计](./deployment/01_deployment_architecture.md)
8. 本文档（实施交接与阶段门禁）

## 4. 阶段实施与门禁

| 阶段 | 目标 | 主要输出 | 主要约束文档 | 通过标准 |
| --- | --- | --- | --- | --- |
| Phase 0 | 建立可编码骨架 | Monorepo 目录、backend/web/desktop/shared 包、配置与迁移入口 | architecture / data / deployment | 本地可构建；PostgreSQL 与 SQLite 迁移链路可执行 |
| Phase 0.5 | 冻结共享契约 | 错误码 fixture、DTO/event fixture、安装/收敛状态枚举、事实权威矩阵 | auth / backend / desktop / frontend-pages | backend、web、desktop 共用同一份契约产物，无重复定义 |
| Phase 1 | 落地身份与治理底座 | auth、org、audit、notify、管理类基础流程 | auth / backend / frontend-pages | 登录、首登改密、组织调整、冻结/解冻、通知/审计链路打通 |
| Phase 2 | 落地发布-审核-最小搜索通知闭环 | package / skill / review / 最小 search / notify 页面联通 | backend/package、skill、review、search、frontend-pages | 上传->审核->发布->可见->通知红点 最小闭环通过 |
| Phase 3 | 落地安装与桌面执行闭环 | install、desktop local-state、skill-sync、冲突处理、工具/项目联动 | backend/install + desktop/* + tools/projects 页面 | 安装/启停/卸载/重试/收敛恢复可用，且服务端与桌面权威边界不混淆 |
| Phase 4 | 完成搜索广度、更新器、部署加固 | 完整搜索体验、通知广度、updater、Nginx/SSE、备份恢复 | data / deployment / desktop/updater / frontend-pages | 搜索、通知、更新与恢复演练全部有证据闭环 |

## 5. 必须先冻结的共享契约

### 5.1 Auth / Org 收敛契约
必须固定以下字段与语义：
- `authz_version`
- `authz_recalc_pending`
- `AUTHZ_RECALC_PENDING`
- 用户端在“权限收敛中”时的 fail-closed 行为

### 5.2 安装 / 收敛状态枚举
必须显式区分三类事实：
- **服务端权威事实**：是否允许安装、当前版本可见性、审核发布状态
- **桌面端本地事实**：下载、解压、激活、路径冲突、重试状态
- **派生事实**：reconcile 结果、恢复建议、阻塞原因摘要

### 5.3 SSE / 通知契约
至少冻结以下 payload：
- 未读计数
- 审核待办计数
- 安装/更新可用提醒
- 重连元数据
- SSE 失败后的轮询退化约定

### 5.4 事实权威矩阵
需要一张统一表，逐项回答：
- 哪个事实由 server 写入
- 哪个事实由 desktop 写入
- 哪些字段只能由派生逻辑计算
- 冲突恢复时谁可以覆盖谁

## 6. 推荐的首轮工程骨架
为了让详细设计可以直接映射到代码目录，建议第一轮脚手架至少包含：

```text
apps/
  api/
  web/
  desktop/
packages/
  shared-contracts/
  config/
  test-fixtures/
  ui/
infra/
  compose/
  nginx/
  scripts/
tests/
  integration/
  e2e/
```

### 目录职责建议
- `apps/api`：NestJS 模块单体，按 auth/org/skill/package/review/install/search/notify/audit 分域
- `apps/web`：React 管理台与终端用户页面
- `apps/desktop`：Tauri shell + Rust/TS bridge + 本地状态能力
- `packages/shared-contracts`：错误码、DTO、枚举、SSE payload、source-of-truth schema
- `packages/test-fixtures`：Phase 0.5 冻结的 fixture 与 snapshot
- `infra`：Compose、Nginx、备份恢复、worker/outbox 运行配置

## 7. 并行开发前的文件所有权建议
为避免多人同时修改共享契约导致漂移，建议明确文件 owner：

| 资产 | 建议 owner |
| --- | --- |
| auth error / convergence 契约 | backend governance lane |
| install/reconcile/source-of-truth 契约 | backend marketplace lane + desktop lane 联合评审 |
| SSE / badge / notify payload | backend governance lane，web/desktop 只消费 |
| Phase gate fixture / traceability | QA / verifier lane |
| 页面状态矩阵与权限态说明 | web lane |

## 8. 文档使用建议
- 详细设计文档继续作为**业务与技术约束源**。
- 本文档作为**实施顺序与阶段门禁源**。
- 真正开始编码后，任何新增目录、契约、fixture 命名都应优先回填到本文档，防止实施与设计入口脱节。
