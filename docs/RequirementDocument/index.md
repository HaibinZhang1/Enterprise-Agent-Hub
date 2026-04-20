# 企业内部 Agent Skills 管理市场（Marketplace）需求说明

## 文档信息
- 文档名称：企业内部 Agent Skills 管理市场需求说明
- 文档版本：V1.6
- 当前状态：Desktop/API/Tauri 主链、作者治理闭环、审核/管理入口、手机号登录、固定中文分类/标签、本地扫描能力、客户端在线升级需求已整合；Windows 安装包与 Linux live 部署仍待目标环境验收
- 适用范围：企业内网部署场景，Desktop/Tauri 桌面客户端为主，Windows 安装包交付优先，服务端部署到 Linux 服务器
- 说明：本文档聚焦前端页面、功能、交互、权限、状态、业务规则与 Skill 包规范；不展开技术栈、数据库与接口实现细节。

> 当前交付边界（2026-04-19）：正式桌面交付仍以 Windows exe 为主，服务端部署仍以 Linux 服务器为目标并优先选择简单、兼容性高的方案。真实 API `download-ticket` -> Tauri 安装/更新 -> Central Store + SQLite -> 启用 -> 重启恢复的最小闭环已经验证；Desktop runtime 已完成 Windows/macOS 平台适配层收敛。剩余缺口集中在 Windows exe 打包、Linux live 部署、客户端在线升级链路实现，以及 Windows/macOS 实机验收。

> 交付入口口径（2026-04-12）：真实产品前端固定为 `apps/desktop`。`docs/design-ui/layout-prototype/` 只作为原型 UI/文案/信息架构参考，不作为交付界面、联调入口或验收依据。凡涉及登录、市场、通知、管理员权限和服务连接状态的能力，均以 live 服务端返回为准，不允许前端用 mock 或假远端数据兜底。


## 当前实现约束

- 账号：使用自建账号体系，由管理员开通账号；手机号是唯一登录凭证，格式为 1 开头的 11 位数字；用户名称对外展示且允许重名，内部账号 ID 不对外展示；后续再考虑接入企业系统或统一身份源。
- 客户端交付：正式安装包仍以 Windows exe 为主；Desktop/Tauri 本地能力已支持 macOS 编译、运行与测试，暂不提供 macOS、Linux 安装包或其他分发形式。
- 服务端部署：必须部署到 Linux 服务器，方案优先简单、稳定、兼容性高。
- 本地启用：采用 symlink 优先；当权限、文件系统或安全策略导致 symlink 失败时自动降级为 copy，并记录实际模式与降级原因。
- 包限制：单个 Skill 包最大 5MB，包内文件最多 100 个；当前版本不做风险脚本扫描。
- 内置目标：支持 Codex、Claude、Cursor、Windsurf、opencode 和自定义目录，并对内置工具做真实格式转换。
- 分类标签：Skill 分类固定为中文短分类且必选 1 个；标签固定为中文短标签且选择 1 到 5 个，暂不支持自由标签。
- 客户端更新：首期在线升级只覆盖 Windows x64 完整安装包，更新包由可信构建链路产出并完成签名，服务端只负责发布、检查、下载凭证和状态治理。

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
| 06 | [页面架构与导航](06_page_architecture.md) | 顶栏一级导航、页面骨架、角色菜单差异、跳转关系 |
| 07 | [页面：首页](07_page_home.md) | Agent 探索主舞台、提问编辑框与主页约束 |
| 08 | [页面：社区](08_page_market.md) | 社区 Skill 发现、搜索、筛选、卡片网格、热榜与发布入口 |
| 09 | [页面：本地 Skill 与发布中心](09_page_myskill.md) | 本地 Skill 列表与发布中心覆盖层、作者治理与提交详情 |
| 10 | [页面：审核](10_page_review.md) | 审核工作台、待审核、审核详情、文件预览、SLA |
| 11 | [页面：管理](11_page_manage.md) | 部门管理、用户管理、Skill 管理 |
| 12 | [页面：工具与项目](12_page_tool_project.md) | 本地入口内的工具与项目能力 |
| 13 | [页面：通知与设置](13_page_notify_settings.md) | 顶栏通知、设置模态、MCP/插件预留 |
| 14 | [Skill 包规范](14_skill_spec.md) | 包结构、SKILL.md 规范、元数据、校验规则 |
| 15 | [核心流程](15_core_flows.md) | 发布、变更、撤回、下架、安装、卸载流程 |
| 16 | [搜索与治理](16_search_governance.md) | 搜索规则、下载量/Star 口径、排序、曝光榜 |
| 17 | [交互与体验](17_interaction_ux.md) | 状态提示、组织变化规则、非功能性要求、离线场景 |
| 18 | [术语表](18_glossary.md) | 系统核心术语统一定义 |
| 19 | [视觉设计系统与页面统一规范](19_visual_design_system.md) | 统一设计风格、布局模板、视觉 token、组件与动效规范 |
| 21 | [客户端在线升级需求](21_client_online_upgrade.md) | 客户端版本检查、更新提示、下载校验、管理员推送与回滚 |

---

## 相关参考文档

| 文档 | 说明 |
|------|------|
| [skills_manage.md](skills_manage.md) | 多 AI 工具统一 Skills 管理器设计草案（Central Store 架构） |
| [../Progress/README.md](../Progress/README.md) | 历史进度归档入口；当前版本判断以规范源文档和 `docs/Verification/` 证据为准 |
