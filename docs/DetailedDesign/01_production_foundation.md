# 01. 生产级基础架构详细设计

## 1. 范围与目标

本设计面向企业内网正式运行的第一阶段工程基础架构，覆盖 Desktop/Tauri 使用闭环和最小服务端能力。当前正式安装包交付仍以 Windows exe 为主，同时为 macOS 保留 Desktop runtime 的编译、运行和测试支持。目标是让用户可以登录、浏览市场、搜索、查看详情、安装、更新、卸载、启用/停用 Skill，并在离线时继续使用本地已安装 Skill。

设计原则：

- 桌面端只用 Tauri 承载窗口、权限隔离和本地系统能力，业务 UI 不直接写本地文件。
- 服务端采用 NestJS 模块化单体，模块边界清晰但部署单一。
- Skill 包和资源文件只进入 MinIO，数据库只保存元数据、权限、索引和对象引用。
- 搜索第一阶段使用 PostgreSQL FTS，避免引入额外搜索基础设施。
- 本地状态必须写入 SQLite，不能只存在 React state 或 Rust 内存。
- Central Store 是本机唯一真源，工具/项目目录只保存 symlink 或 copy 的分发结果。

## 2. 建议项目目录结构

```text
EnterpriseAgentHub/
├── apps/
│   ├── desktop/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── App.tsx
│   │   │   │   ├── routes.tsx
│   │   │   │   └── shell/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── home/
│   │   │   │   ├── market/
│   │   │   │   ├── skills/
│   │   │   │   ├── tools/
│   │   │   │   ├── projects/
│   │   │   │   ├── notifications/
│   │   │   │   └── settings/
│   │   │   ├── services/
│   │   │   │   ├── apiClient.ts
│   │   │   │   ├── tauriCommands.ts
│   │   │   │   └── queryKeys.ts
│   │   │   ├── state/
│   │   │   ├── styles/
│   │   │   └── types/
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json
│   │       ├── migrations/
│   │       └── src/
│   │           ├── main.rs
│   │           ├── commands/
│   │           │   ├── central_store.rs
│   │           │   ├── distribution.rs
│   │           │   ├── local_db.rs
│   │           │   ├── offline_queue.rs
│   │           │   ├── tool_detection.rs
│   │           │   └── path_validation.rs
│   │           ├── adapters/
│   │           │   ├── codex.rs
│   │           │   ├── claude.rs
│   │           │   ├── cursor.rs
│   │           │   ├── windsurf.rs
│   │           │   ├── opencode.rs
│   │           │   └── custom_directory.rs
│   │           ├── store/
│   │           ├── sqlite/
│   │           ├── sync/
│   │           └── windows/
│   └── api/
│       ├── package.json
│       ├── nest-cli.json
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/
│       │   ├── config/
│       │   ├── database/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── departments/
│       │   │   ├── skills/
│       │   │   ├── packages/
│       │   │   ├── market/
│       │   │   ├── search/
│       │   │   ├── notifications/
│       │   │   ├── desktop/
│       │   │   ├── storage/
│       │   │   ├── jobs/
│       │   │   └── health/
│       │   └── migrations/
│       └── test/
├── packages/
│   ├── shared-contracts/
│   │   ├── src/
│   │   └── package.json
│   └── tool-adapter-fixtures/
│       ├── codex/
│       ├── claude/
│       ├── cursor/
│       ├── windsurf/
│       └── opencode/
├── infra/
│   ├── docker-compose.yml
│   ├── minio/
│   ├── postgres/
│   └── redis/
├── scripts/
├── docs/
│   ├── RequirementDocument/
│   └── DetailedDesign/
├── ui-prototype/
└── README.md
```

说明：

- `apps/desktop/src` 承接 `ui-prototype` 中已验证的页面结构，但生产实现需要隐藏发布、审核、管理等 后续版本 入口。
- `apps/desktop/src-tauri` 是所有本地系统能力的唯一入口，React 只通过 `invoke` 调用命令。
- `packages/shared-contracts` 放 API DTO、枚举和跨端类型，避免 Desktop 与 API 字段漂移。
- `packages/tool-adapter-fixtures` 放 Codex、Claude、Cursor、Windsurf、opencode 的格式转换 golden fixture。
- `infra` 只提供单机内网生产/预生产可用的基础设施编排，不引入微服务网关。

## 3. 前后端模块划分

### 3.1 Desktop React 模块

| 模块 | 责任 |
| --- | --- |
| `auth` | 登录、会话恢复、退出、服务地址配置展示。 |
| `home` | 连接状态、已安装数量、可更新数量、热门/最近更新、通知摘要。 |
| `market` | 市场列表、搜索、筛选、排序、简单榜单。 |
| `skills` | Skill 详情、受限详情、安装/更新/卸载入口、我的已安装列表。 |
| `tools` | 本机工具列表、检测状态、路径配置入口、启用/停用入口。 |
| `projects` | 项目路径配置、项目级 skills 路径、项目级启用管理。 |
| `notifications` | 应用内通知、未读筛选、标记已读、跳转关联对象。 |
| `settings` | 语言、Central Store 路径展示、本地同步偏好。 |
| `services/apiClient` | 只调用服务端 HTTP API，不直接处理本地文件。 |
| `services/tauriCommands` | 只封装 Tauri `invoke`，不包含业务 UI 状态。 |

### 3.2 Tauri Rust 模块

| 模块 | 责任 |
| --- | --- |
| `tool_detection` | Windows 注册表扫描、默认路径探测、手动路径校验、marker file 检测。 |
| `central_store` | 下载临时目录、SHA-256 校验、包大小/文件数校验、写入/覆盖/删除 Central Store。 |
| `adapters` | Codex、Claude、Cursor、Windsurf、opencode、自定义目录的目标布局和格式转换。 |
| `distribution` | 从 Central Store 的转换产物启用到工具/项目；优先 symlink，失败自动 copy；停用和卸载目标清理。 |
| `local_db` | SQLite 迁移、读写本地安装状态、工具/项目配置、启用目标、同步状态。 |
| `offline_queue` | 离线启用/停用事件入队、恢复网络后批量上报、成功后确认删除。 |
| `path_validation` | 路径存在性、可写性、目标冲突、覆盖确认所需的预检查。 |
| `windows` | Windows 专属能力封装，避免平台细节散落在业务命令中。 |

### 3.3 NestJS 服务端模块

| 模块 | 责任 |
| --- | --- |
| `AuthModule` | 自建账号登录、会话/JWT、密码策略、管理员预置账号。 |
| `UsersModule` | 用户、角色、部门归属的只读消费与后续 后续版本 管理扩展。 |
| `DepartmentsModule` | 部门树、授权范围计算所需基础数据。 |
| `SkillsModule` | Skill 元数据、版本、状态、权限、Star、下载计数。 |
| `PackagesModule` | 包元数据、Hash、大小、文件数、下载凭证生成。 |
| `MarketModule` | `/skills`、`/skills/{skillID}` 聚合查询和 当前版本 筛选排序。 |
| `SearchModule` | PostgreSQL FTS 查询、排序权重和 GIN 索引维护。 |
| `NotificationsModule` | 应用内通知、未读计数、标记已读。 |
| `DesktopModule` | `/desktop/bootstrap`、`/desktop/local-events`、设备状态和本地事件接收。 |
| `StorageModule` | MinIO bucket、对象 key、短期下载 URL、资源文件引用。 |
| `JobsModule` | BullMQ 队列注册、包入库校验、通知生成、后台维护任务。 |
| `HealthModule` | 服务健康检查、数据库/Redis/MinIO 连通性探测。 |

## 4. Tauri 前端层与 Rust 层边界

### 4.1 React 可以做的事

- 渲染页面、弹窗、表格、筛选器和进度状态。
- 调用 NestJS API 获取市场、详情、通知、download-ticket。
- 调用 Rust command 执行本地安装、启用、停用、卸载、检测、离线同步。
- 根据 Rust 返回的结构化结果展示成功、失败、重试和覆盖确认。

React 不直接做：

- 读取或写入任意本地文件。
- 扫描 Windows 注册表或系统默认路径。
- 创建 symlink、复制目录、删除目标目录。
- 维护 SQLite 连接或手写本地持久化文件。
- 推导服务端权限、下架、版本、可安装资格。

### 4.2 Rust command 边界

建议第一阶段暴露以下命令：

| Command | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `get_local_bootstrap` | 无 | 本地安装、工具、项目、队列概览 | 启动时支撑离线首页和我的 Skill。 |
| `scan_tools` | `toolIDs?` | 工具检测结果列表 | 执行注册表、默认路径、marker file、可写性检查。 |
| `validate_target_path` | `targetPath` | 路径状态 | 添加工具/项目或修改路径前调用。 |
| `install_skill_package` | `downloadTicket` | `LocalSkillInstall` | 下载、校验、写入 Central Store 和 SQLite。 |
| `update_skill_package` | `downloadTicket` | `LocalSkillInstall` | 校验后全量覆盖 Central Store。 |
| `enable_skill` | `skillID, version, targetType, targetID, preferredMode` | `EnabledTarget` | 默认 `preferredMode=symlink`，失败降级 `copy`。 |
| `disable_skill` | `skillID, targetType, targetID` | `EnabledTarget` | 删除目标 symlink 或 copy，保留 Central Store。 |
| `uninstall_skill` | `skillID` | 卸载结果 | 删除 Central Store 和所有启用目标，部分失败需返回失败路径。 |
| `flush_offline_events` | 服务端地址/认证上下文 | 同步结果 | 联网后调用 `/desktop/local-events` 并更新队列状态。 |

### 4.3 symlink 优先、copy 降级规则

启用流程：

1. 校验 Skill 已安装在 Central Store。
2. 根据 Tool Adapter 将原始包转换到 Central Store 下的工具产物缓存，例如 `derived/{skillID}/{version}/{toolID}`。
3. 校验目标路径存在或可创建，并检查是否有同名目标。
4. 尝试创建 symlink。目录型目标创建目录 symlink；文件型目标按 Adapter 输出类型创建文件 symlink。
5. 若 symlink 因权限、文件系统限制、目标已存在不可替换、杀毒/安全策略等原因失败，自动降级为 copy。
6. SQLite `enabled_targets` 记录 `requestedMode=symlink`、`resolvedMode=symlink|copy`、`fallbackReason`、`targetPath`、`artifactHash`。
7. 生成离线事件；联网时上报服务端，服务端只记录事实，不改变权限或版本治理状态。

停用流程：

- 若 `resolvedMode=symlink`，只删除目标 symlink，不删除 Central Store 产物。
- 若 `resolvedMode=copy`，删除目标副本。
- 删除前确认目标仍指向或匹配本次启用记录，避免误删用户手动创建的非托管目录。

## 5. 核心数据表设计建议

### 5.1 PostgreSQL 服务端表

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `users` | `id, username, password_hash, display_name, department_id, role, status, created_at` | 自建账号体系；当前版本 只需登录和身份展示。 |
| `departments` | `id, parent_id, name, path, level, status` | 支撑部门筛选和后续权限范围计算。 |
| `skills` | `id, skill_id, display_name, description, author_id, department_id, status, visibility_level, current_version_id, created_at, updated_at` | Skill 主表，不存包体。 |
| `skill_versions` | `id, skill_id, version, readme_object_key, changelog, risk_level, review_summary, published_at, package_id` | 当前版本和历史版本元数据。 |
| `skill_packages` | `id, skill_version_id, bucket, object_key, sha256, size_bytes, file_count, content_type, created_at` | MinIO 对象引用、Hash、大小和文件数。 |
| `skill_assets` | `id, skill_version_id, asset_type, bucket, object_key, sha256, size_bytes` | 图标、截图、README 附件等资源对象。 |
| `skill_authorizations` | `id, skill_id, scope_type, department_id, created_at` | 授权范围；当前版本 服务端返回 `canInstall` 结果。 |
| `skill_tool_compatibilities` | `id, skill_id, tool_id, system` | 兼容工具和系统筛选。 |
| `skill_tags` | `id, skill_id, tag` | 标签搜索和展示。 |
| `skill_stars` | `user_id, skill_id, created_at` | Star 实时计数来源，唯一键为 `user_id + skill_id`。 |
| `download_events` | `id, user_id, skill_id, version, purpose, created_at` | 下载计数与追踪；更新不计入下载量时按 `purpose` 区分。 |
| `notifications` | `id, user_id, type, title, summary, object_type, object_id, read_at, created_at` | 应用内通知。 |
| `desktop_devices` | `id, user_id, device_name, platform, app_version, last_seen_at` | 桌面设备登记和本地事件来源。 |
| `desktop_local_events` | `id, device_id, event_id, event_type, skill_id, version, target_type, target_id, target_path, requested_mode, resolved_mode, result, occurred_at, received_at` | 离线启用/停用事件接收，按 `device_id + event_id` 去重。 |
| `job_runs` | `id, job_type, job_id, status, payload_ref, error_message, created_at, finished_at` | BullMQ 关键后台任务的可观测记录。 |

搜索建议：

- 在 `skills` 或物化查询表中维护 `search_vector`，组合 `display_name`、`description`、`skill_id`、作者、部门、标签。
- 使用 GIN 索引：`CREATE INDEX ... USING GIN(search_vector);`
- 排序先用 FTS rank，再叠加 Star、下载量、更新时间的轻量权重；不要在第一阶段引入独立搜索服务。

MinIO 建议：

```text
bucket: skill-packages
  skills/{skillID}/{version}/package.zip

bucket: skill-assets
  skills/{skillID}/{version}/icon.png
  skills/{skillID}/{version}/screenshots/{assetID}.png
  skills/{skillID}/{version}/readme.md
```

### 5.2 SQLite 本地表

| 表 | 关键字段 | 说明 |
| --- | --- | --- |
| `local_skill_installs` | `skill_id, display_name, local_version, local_hash, source_package_hash, central_store_path, local_status, has_update, is_scope_restricted, can_update, installed_at, updated_at` | 我的已安装和离线可用的核心状态。 |
| `enabled_targets` | `id, skill_id, target_type, target_id, target_name, target_path, artifact_path, requested_mode, resolved_mode, fallback_reason, artifact_hash, status, last_error, enabled_at, updated_at` | 工具/项目启用记录，支持 symlink/copy 实际落地模式。 |
| `tool_configs` | `tool_id, display_name, adapter_status, detected_path, configured_path, skills_path, enabled, detection_method, transform_strategy, last_scanned_at, updated_at` | 工具检测与用户手动配置。 |
| `project_configs` | `project_id, display_name, project_path, skills_path, enabled, created_at, updated_at` | 项目级启用配置。 |
| `offline_event_queue` | `event_id, event_type, payload_json, status, retry_count, last_error, occurred_at, synced_at` | 离线启用/停用事件持久队列。 |
| `local_notifications` | `notification_id, type, title, summary, object_type, object_id, read_at, created_at` | 最近通知缓存，离线可展示。 |
| `sync_state` | `key, value, updated_at` | 最近 bootstrap、市场缓存版本、同步游标等轻量状态。 |
| `store_metadata` | `key, value, updated_at` | Central Store 根路径、schema 版本、迁移标记。 |

本地目录建议：

```text
%USERPROFILE%\.ai-skills\
├── registry\
│   └── skills.db
├── skills\
│   └── {skillID}\
│       └── {version}\
├── derived\
│   └── {skillID}\
│       └── {version}\
│           └── {toolID}\
├── downloads\
├── logs\
└── backups\
```

## 6. 第一阶段开发顺序

1. 搭建工程骨架：创建 `apps/desktop`、`apps/api`、`packages/shared-contracts`、`infra`，固化环境变量和本地启动脚本。
2. 启动基础设施：PostgreSQL、Redis、MinIO；完成 NestJS 配置、健康检查和数据库迁移基线。
3. 固化共享契约：枚举、DTO、错误码、分页响应、`installMode` 的 `symlink|copy` 实际模式字段。
4. 实现服务端 当前版本 API：登录、`/desktop/bootstrap`、`/skills`、`/skills/{skillID}`、download-ticket、Star、通知、`/desktop/local-events`。
5. 接入 MinIO 与 BullMQ：包对象元数据、短期下载凭证、包校验任务、通知生成任务。
6. 实现 Desktop React 主框架：登录、首页、市场、详情、我的已安装、工具、项目、通知、设置；以 `ui-prototype` 为页面参考，移除 后续版本 正式入口。
7. 实现 Rust SQLite 与 Central Store：本地迁移、安装状态、工具/项目配置、下载校验、覆盖更新、卸载。
8. 实现 Tool Adapter 与本地分发：Codex、Claude、Cursor、Windsurf、opencode、自定义目录；优先 symlink，失败 copy；补齐 fixture 验收。
9. 实现离线闭环：离线启用/停用写 SQLite 队列；恢复网络后上报本地事件；权限、下架、版本仍以服务端为准。
10. 做生产化收尾：Windows 安装包配置、日志脱敏、错误码映射、基础测试、端到端安装/启用/更新/卸载验收。

## 7. 第一阶段验收重点

- 断网后仍可进入我的已安装、工具、项目，并可启用/停用已安装 Skill。
- 安装和更新必须经过下载凭证、包大小、文件数和 SHA-256 校验。
- Central Store 写入失败不得污染本地状态；Hash 校验失败必须删除临时文件。
- symlink 失败时自动 copy，并在 SQLite 和 UI 结果中能看到实际落地模式。
- 停用和卸载不会误删非本系统托管的用户文件。
- 市场搜索使用 PostgreSQL FTS，服务端不依赖额外搜索引擎。
- Skill 包、图标、截图、README 资源都在 MinIO，数据库只保存对象引用。
- 服务端仍是 NestJS 模块化单体，后台任务只通过 BullMQ 解耦耗时工作。
