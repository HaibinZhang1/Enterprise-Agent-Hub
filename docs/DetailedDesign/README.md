# Enterprise Agent Hub 详细设计文档

## 设计包说明
本目录基于需求文档、deep-interview 规格与已批准的 auth 方案，沉淀准实施级详细设计。

> 当前发布边界（2026-04-09）：Windows-first 内网生产交付以 `apps/desktop` 为唯一维护的产品/演示入口。本文档包仍保留完整产品蓝图（含前端页面与审核模块），但本轮发布验收不得把 `apps/web` 或发布/审核页面作为当前产品 UI、演示 UI、参考 UI或退出条件。

## 目录总览
- [实施交接说明](./00_execution_handoff.md)
- [总体架构](./architecture/01_system_architecture.md)
- [服务端模块设计](./backend/README.md)
- [桌面端模块设计](./desktop/README.md)
- [前端页面设计](./frontend-pages/README.md)
- [数据层设计](./data/01_data_architecture.md)
- [部署层设计](./deployment/01_deployment_architecture.md)
- [Auth 模块专用设计](./auth/README.md)

## 设计边界
- 覆盖：模块职责、关键流程、API、数据模型、事件、错误反馈、部署与备份策略
- 不覆盖：具体代码实现、CI/CD 细节、二期功能全量展开、外部 LDAP/AD 一期实现

## 当前 V1 批量操作边界
- 本轮 Desktop 工具/项目 Skill 管理只交付单个目标、单个 Skill 的显式预览确认流程。
- V1 不交付批量绑定、批量启用/停用、批量升级等一键批处理能力。
- 数据结构与页面信息架构可以为后续批量工作流预留扩展点，但不得在当前产品 UI、Desktop API 或测试退出标准中把批量操作作为已上线能力。

## 建议实施入口
- 阅读顺序：总体架构 -> Auth -> 服务端/桌面端/前端 -> 数据/部署 -> [实施交接说明](./00_execution_handoff.md)
- 进入编码前，先冻结共享契约（Auth 错误码与收敛语义、install/reconcile 状态、SSE payload、事实权威矩阵），再拆分并行开发任务
- 若仓库中尚无工程骨架，应优先完成 Phase 0/0.5，而不是直接从业务模块横向铺开

## 模块范围
### 服务端
- auth
- org
- skill
- package
- review
- install
- search
- notify
- audit

### 桌面端
- tool-scanner
- project-manager
- skill-sync
- conflict-resolver
- local-state
- desktop-notify
- updater

### 前端页面
- home
- market
- my-skill
- review
- department management
- user management
- skill management
- tools
- projects
- notifications
- settings
