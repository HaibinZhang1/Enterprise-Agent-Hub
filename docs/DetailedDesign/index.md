# 企业内部 Agent Skills Marketplace 详细设计

## 文档定位

本目录用于承接 `docs/RequirementDocument` 的需求方案，输出可进入工程落地的详细设计。当前批次聚焦生产级基础架构、游客优先 Desktop、显式菜单权限，以及在线管理员审核/管理入口。

## 已阅读输入

- `docs/RequirementDocument/index.md`：P1 Desktop 范围、阶段矩阵和文档索引。
- `docs/RequirementDocument/20_p1_desktop_prd.md`：Windows-first Desktop 使用闭环。
- `docs/RequirementDocument/21_p1_data_contract.md`：P1 服务端接口与本地状态模型。
- `docs/RequirementDocument/22_p1_tool_adapter_contract.md`：Tool Adapter、Central Store、路径检测和启用规则。
- `docs/RequirementDocument/23_p1_interaction_spec.md`：首页、市场、我的 Skill、工具、项目、通知、设置的交互规格。
- `docs/RequirementDocument/skills_manage.md`：Central Store + Tool Adapter 的历史设计草案。
- `ui-prototype/`：当前 UI 原型，覆盖首页、市场、我的 Skill、工具、项目、通知、设置，并包含发布、审核、管理等后续版本占位。

## 当前设计决策

| 决策 | 口径 |
| --- | --- |
| 客户端入口 | Windows-first Desktop，Tauri 2 只作为桌面壳，业务 UI 使用 React + TypeScript + Vite。 |
| 本地系统能力 | Windows 注册表扫描、默认路径探测、marker file 检测、Central Store 管理、symlink/copy 分发、离线队列和 SQLite 持久化全部下沉到 Rust commands/plugins。 |
| Skill 本地模型 | 下载先进入本机 Central Store，再启用到工具或项目目录。Central Store 是唯一真源，目标目录只是分发结果。 |
| 启用策略 | 按本次技术要求采用 symlink 优先，symlink 失败自动降级为 copy，并记录实际落地模式和失败原因。 |
| 服务端形态 | NestJS 模块化单体，部署到 Linux 服务器，不拆微服务。 |
| 数据存储 | 服务端使用 PostgreSQL；本地状态使用 SQLite；Skill 包和资源使用 MinIO；后台任务使用 Redis + BullMQ。 |
| 搜索 | 第一阶段只使用 PostgreSQL Full-Text Search，不引入 Elasticsearch、Meilisearch 等额外搜索引擎。 |

> 说明：需求文档 P1 旧口径为 copy-only。本详细设计按后续技术要求调整为 symlink 优先、失败自动 copy；P1 PRD、数据契约和 Tool Adapter 契约已同步 `installMode`、`requestedMode`、`resolvedMode` 与降级验收项，后续实现不得退回 copy-only。

## 文档索引

| 编号 | 文档 | 内容 |
| --- | --- | --- |
| 01 | [生产级基础架构详细设计](01_production_foundation.md) | 项目目录结构、前后端模块划分、Tauri 前端层与 Rust 层边界、核心数据表设计建议、第一阶段开发顺序。 |
| 02 | [P1 任务详细设计](02_p1_task_design.md) | P1 任务包拆分、接口/命令/状态设计、依赖顺序、验收路径和需求差异同步项。 |
| 03 | [服务端 Docker 一键部署详细设计](03_server_docker_deployment.md) | Compose 一键部署、低版本服务器兼容、离线镜像包、数据持久化、健康检查和验收边界。 |
| 04 | [P1 共享契约落地对齐](04_p1_shared_contracts_alignment.md) | 共享 TypeScript 契约包、workspace 脚本、symlink-first/copy-fallback 字段和后续 DTO 对接规则。 |

## 暂不展开

- 发布 Skill 表单、审核处理动作（锁单/同意/拒绝/退回）。
- 复杂审计报表、企业 IM、系统托盘、多端安装包。
- 微服务拆分、独立搜索引擎、RAG、MCP/插件治理。
- 自动依赖安装、风险脚本扫描和多维护者协作。
