# 企业内部 Agent Skills 管理市场（Marketplace）需求说明

## 文档信息
- 文档名称：企业内部 Agent Skills 管理市场需求说明
- 文档版本：V1.3
- 当前状态：Desktop/API/Tauri 主链已落地；Windows 安装包与 Linux live 部署仍待实机验收
- 适用范围：企业内网部署场景，Desktop/Tauri 桌面客户端为主，Windows 安装包交付优先，服务端部署到 Linux 服务器
- 说明：本文档聚焦前端页面、功能、交互、权限、状态、业务规则与 Skill 包规范；不展开技术栈、数据库与接口实现细节。

> 当前交付边界（2026-04-13）：正式桌面交付仍以 Windows exe 为主，服务端部署仍以 Linux 服务器为目标并优先选择简单、兼容性高的方案。真实 API `download-ticket` -> Tauri 安装/更新 -> Central Store + SQLite -> 启用 -> 重启恢复的最小闭环已经验证；Desktop runtime 已完成 Windows/macOS 平台适配层收敛。剩余缺口集中在 Windows exe 打包、Linux live 部署，以及 Windows/macOS 实机验收。

> 交付入口口径（2026-04-12）：真实产品前端固定为 `apps/desktop`。`ui-prototype/` 只作为原型 UI/文案/信息架构参考，不作为交付界面、联调入口或验收依据。凡涉及登录、市场、通知、管理员权限和服务连接状态的能力，均以 live 服务端返回为准，不允许前端用 mock 或假远端数据兜底。

## 当前实现约束

- 账号：使用自建账号体系，由管理员开通账号；后续再考虑接入企业系统或统一身份源。
- 客户端交付：正式安装包仍以 Windows exe 为主；Desktop/Tauri 本地能力已支持 macOS 编译、运行与测试，暂不提供 macOS、Linux 安装包或其他分发形式。
- 服务端部署：必须部署到 Linux 服务器，方案优先简单、稳定、兼容性高。
- 本地启用：采用 symlink 优先；当权限、文件系统或安全策略导致 symlink 失败时自动降级为 copy，并记录实际模式与降级原因。
- 包限制：单个 Skill 包最大 5MB，包内文件最多 100 个；当前版本不做风险脚本扫描。
- 内置目标：支持 Codex、Claude、Cursor、Windsurf、opencode 和自定义目录，并对内置工具做真实格式转换。

---

## 文档结构

本需求说明按模块拆分为以下子文档，涉及到具体模块按照需要查询：

| 编号 | 文档 | 内容摘要 |
|------|------|---------|
| 00 | 📖 本文件（index.md） | 文档索引与版本变更记录 |
| 01 | [背景与范围](01_background_scope.md) | 项目背景、目标、定位与边界 |
| 02 | [核心概念](02_core_concepts.md) | Skill 定义、权限维度、安装与启用、Star、删除与下架 |
| 03 | [角色与权限](03_roles_permissions.md) | 角色分类、权限矩阵、审核规则、审核链路决策树 |
| 04 | [业务规则](04_business_rules.md) | 发布/可见/可安装分离、权限收缩、版本更新、存量用户影响 |
| 05 | [生命周期与状态机](05_lifecycle_states.md) | 状态定义、状态流转图、撤回规则、权限变更状态流 |
| 06 | [页面架构与导航](06_page_architecture.md) | 页面列表、导航布局、角色菜单差异、跳转关系 |
| 07 | [页面：首页](07_page_home.md) | 首页模块、待办、快捷入口、推荐内容 |
| 08 | [页面：市场](08_page_market.md) | 搜索、筛选、排序、卡片、详情页、排行榜 |
| 09 | [页面：我的 Skill](09_page_myskill.md) | 已安装、我发布的、发布 Skill、权限修改 |
| 10 | [页面：审核](10_page_review.md) | 审核工作台、待审核、审核详情、SLA |
| 11 | [页面：管理](11_page_manage.md) | 部门管理、用户管理、Skill 管理 |
| 12 | [页面：工具与项目](12_page_tool_project.md) | 工具管理、项目管理、路径冲突规则 |
| 13 | [页面：通知与设置](13_page_notify_settings.md) | 通知类型、设置、MCP/插件预留 |
| 14 | [Skill 包规范](14_skill_spec.md) | 包结构、SKILL.md 规范、元数据、校验规则 |
| 15 | [核心流程](15_core_flows.md) | 发布、变更、撤回、下架、安装、卸载流程 |
| 16 | [搜索与治理](16_search_governance.md) | 搜索规则、下载量/Star 口径、排序、曝光榜 |
| 17 | [交互与体验](17_interaction_ux.md) | 状态提示、组织变化规则、非功能性要求、离线场景 |
| 18 | [术语表](18_glossary.md) | 系统核心术语统一定义 |
| 20 | [Desktop PRD](20_p1_desktop_prd.md) | Desktop 使用闭环范围、功能、数据契约与验收标准 |
| 21 | [Desktop 数据契约](21_p1_data_contract.md) | 服务端接口、字段枚举、本地状态模型与接口验收 |
| 22 | [Tool Adapter 配置契约](22_p1_tool_adapter_contract.md) | 工具/项目路径适配、内置 Adapter、启用停用与冲突规则 |
| 23 | [Desktop 交互规格](23_p1_interaction_spec.md) | 页面结构、状态、操作、弹窗、空态错误态与验收清单 |

---

## 相关参考文档

| 文档 | 说明 |
|------|------|
| [skills_manage.md](skills_manage.md) | 多 AI 工具统一 Skills 管理器设计草案（Central Store 架构） |
