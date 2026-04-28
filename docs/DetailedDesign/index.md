# 企业内部 Agent Skills Marketplace 详细设计

## 文档定位

本目录用于承接 `docs/RequirementDocument` 的需求方案，输出可进入工程落地的详细设计。当前内容聚焦生产级基础架构、游客优先 Desktop、显式菜单权限，以及在线管理员审核/管理入口。

## 已阅读输入

- `docs/RequirementDocument/index.md`：Desktop 范围与文档索引。
- `docs/RequirementDocument/06_page_architecture.md`：Desktop 页面架构与导航入口。
- `docs/RequirementDocument/14_skill_spec.md`：Skill 包结构、元数据和校验规则。
- `docs/RequirementDocument/15_core_flows.md`：发布、审核、安装、启用、卸载与升级流程。
- `docs/RequirementDocument/17_interaction_ux.md`：交互、错误、离线和体验规则。
- `docs/RequirementDocument/21_client_online_upgrade.md`：客户端在线升级需求。
- `docs/RequirementDocument/skills_manage.md`：Central Store + Tool Adapter 的历史设计草案。
- `docs/design-ui/layout-prototype/`：当前 UI 原型，覆盖首页、社区、本地、管理与覆盖层参考。

## 当前设计决策

| 决策 | 口径 |
| --- | --- |
| 客户端入口 | Desktop/Electron，正式安装包交付以 Windows exe 为主；业务 UI 使用 React + TypeScript + Vite。 |
| 本地系统能力 | Windows 注册表扫描 + 默认路径探测、macOS 默认路径/规则目录探测、marker file 检测、Central Store 管理、symlink/copy 分发、离线队列和 SQLite 持久化通过 Electron 主进程/Node 处理器承载；Rust 仅可按迁移例外门保留为 standalone helper。 |
| Skill 本地模型 | 下载先进入本机 Central Store，再启用到工具或项目目录。Central Store 是唯一真源，目标目录只是分发结果。 |
| 启用策略 | 按本次技术要求采用 symlink 优先，symlink 失败自动降级为 copy，并记录实际落地模式和失败原因。 |
| 服务端形态 | NestJS 模块化单体，部署到 Linux 服务器，不拆微服务。 |
| 数据存储 | 服务端使用 PostgreSQL；本地状态使用 SQLite；Skill 包和资源使用 MinIO；后台任务使用 Redis + BullMQ。 |
| 搜索 | 第一阶段只使用 PostgreSQL Full-Text Search，不引入 Elasticsearch、Meilisearch 等额外搜索引擎。 |

> 说明：需求文档曾保留 copy-only 旧口径。本详细设计按当前实现统一为 symlink 优先、失败自动 copy；需求索引、核心流程、Skill 包规范与共享契约设计已同步 `installMode`、`requestedMode`、`resolvedMode` 与降级验收项，后续实现不得退回 copy-only。

> Runtime 迁移约束：Electron 迁移只替换桌面宿主、包装和本地命令边界，不包含业务 UI 重设计、服务端 API 变更、共享 DTO 破坏性改名或新产品功能。

## 文档索引

| 编号 | 文档 | 内容 |
| --- | --- | --- |
| 01 | [生产级基础架构详细设计](01_production_foundation.md) | 项目目录结构、前后端模块划分、Electron 主/预加载/渲染边界、核心数据表设计建议、第一阶段开发顺序。 |
| 03 | [服务端 Docker 一键部署详细设计](03_server_docker_deployment.md) | Compose 一键部署、低版本服务器兼容、离线镜像包、数据持久化、健康检查和验收边界。 |
| 04 | [共享契约落地对齐](04_p1_shared_contracts_alignment.md) | 共享 TypeScript 契约包、workspace 脚本、symlink-first/copy-fallback 字段和 DTO 对接规则。 |
| 05 | Runtime migration map | former runtime 命令到 Electron IPC/Node/standalone helper 的能力映射、测试证据和删除门禁；文件位于本目录的运行时迁移映射文档。 |

## P2 平台化资产

- [Architecture Assets](../Architecture/index.md)：领域边界、分层规则、shared-contracts 演进规则与扩展接入面。
- [Config and Security Operations](../Operations/config-and-security.md)：环境模板、配置校验、部署前检查与安全反模式。

## 暂不展开

- 复杂审计报表、企业 IM、系统托盘、多端安装包。
- 微服务拆分、独立搜索引擎、RAG、MCP/插件治理。
- 自动依赖安装、风险脚本扫描和多维护者协作。
