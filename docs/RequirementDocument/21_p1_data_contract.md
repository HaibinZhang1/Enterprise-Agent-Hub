# P1 Desktop 数据契约

## 1. 文档信息

| 字段 | 内容 |
|------|------|
| 文档名称 | P1 Desktop 数据契约 |
| 版本 | V1.1 |
| 状态 | P1 定稿 |
| 日期 | 2026-04-11 |
| 关联 PRD | [P1 Desktop 使用闭环 PRD](20_p1_desktop_prd.md) |

## 2. 契约原则

- JSON 字段使用 camelCase；历史业务术语 `skillID` 保持现有写法。
- 时间统一使用 ISO 8601 字符串，服务端返回 UTC 时间。
- 枚举值统一使用 lower_snake_case。
- 服务端只返回当前用户可见、可操作范围内的数据；Desktop 不自行推导跨部门权限。
- 游客态只消费本地数据；需要远端鉴权时由登录弹窗触发。
- 服务端通过 `menuPermissions` 显式下发菜单权限，前后端使用同一权限源。
- 文件包必须通过服务端授权下载凭证获取；客户端不得从列表字段中直接拿长期有效下载地址。
- 路径可按实现增加统一前缀，例如 `/api/v1`；字段名、枚举值和语义不得漂移。

## 3. 通用响应

### 3.1 分页响应

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "hasMore": false
}
```

### 3.2 错误响应

```json
{
  "error": {
    "code": "permission_denied",
    "message": "当前用户无权安装该 Skill",
    "detail": null,
    "retryable": false
  }
}
```

常用错误码：

| code | 场景 | retryable |
|------|------|-----------|
| unauthenticated | 未登录或会话失效 | false |
| permission_denied | 无权限查看详情、安装、更新 | false |
| skill_not_found | Skill 不存在或不可见 | false |
| resource_not_found | 审核单、部门、用户或其他治理资源不存在 | false |
| validation_failed | 参数非法或当前状态不允许该操作 | false |
| skill_delisted | Skill 已下架 | false |
| scope_restricted | 权限已收缩，禁止新增安装/更新 | false |
| package_unavailable | 包不可下载或下载凭证生成失败 | true |
| package_too_large | Skill 包超过 5MB | false |
| package_file_count_exceeded | Skill 包内文件数超过 100 个 | false |
| hash_mismatch | 客户端校验包 Hash 失败 | true |
| conversion_failed | Tool Adapter 格式转换失败 | true |
| server_unavailable | 服务端不可用 | true |

## 4. 枚举

| 枚举 | 值 |
|------|----|
| `skillStatus` | `published` / `delisted` / `archived` |
| `visibilityLevel` | `private` / `summary_visible` / `detail_visible` / `public_installable` |
| `detailAccess` | `none` / `summary` / `full` |
| `riskLevel` | `low` / `medium` / `high` / `unknown` |
| `installState` | `not_installed` / `installed` / `enabled` / `update_available` / `blocked` |
| `localStatus` | `installed` / `enabled` / `partially_failed` |
| `connectionStatus` | `connected` / `connecting` / `offline` / `failed` |
| `targetType` | `tool` / `project` |
| `adapterStatus` | `detected` / `manual` / `missing` / `invalid` / `disabled` |
| `installMode` | `symlink` / `copy` |
| `requestedMode` | `symlink` / `copy` |
| `resolvedMode` | `symlink` / `copy` |
| `menuPermission` | `home` / `market` / `my_installed` / `review` / `manage` / `tools` / `projects` / `notifications` / `settings` |
| `notificationType` | `skill_update_available` / `skill_scope_restricted` / `local_copy_blocked` / `connection_restored` / `connection_failed` / `target_path_invalid` / `install_result` / `update_result` / `uninstall_result` / `enable_result` / `disable_result` |

## 5. 服务端接口

### 5.1 `GET /desktop/bootstrap`

用于客户端启动后获取 P1 必要上下文。

响应字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| user | 是 | 当前用户 |
| connection | 是 | 服务连接信息 |
| features | 是 | P1/P2/P3 功能开关 |
| counts | 是 | 首页计数 |
| navigation | 是 | 当前应展示的导航 |
| menuPermissions | 是 | 当前账号具备的菜单权限集合 |

示例：

```json
{
  "user": {
    "userID": "u_001",
    "displayName": "张三",
    "role": "normal_user",
    "adminLevel": null,
    "departmentID": "dept_frontend",
    "departmentName": "前端组",
    "locale": "zh-CN"
  },
  "connection": {
    "status": "connected",
    "serverTime": "2026-04-11T02:30:00Z",
    "apiVersion": "p1.0"
  },
  "features": {
    "p1Desktop": true,
    "publishSkill": true,
    "reviewWorkbench": false,
    "adminManage": false,
    "mcpManage": false,
    "pluginManage": false
  },
  "counts": {
    "installedCount": 0,
    "updateAvailableCount": 0,
    "unreadNotificationCount": 0
  },
  "navigation": [
    "home",
    "market",
    "my_installed",
    "tools",
    "projects",
    "notifications",
    "settings"
  ],
  "menuPermissions": [
    "home",
    "market",
    "my_installed",
    "tools",
    "projects",
    "notifications",
    "settings"
  ]
}
```

### 5.1.1 `POST /auth/login`

登录成功后返回：

- `accessToken`
- `tokenType`
- `expiresIn`
- `expiresAt`
- `user`
- `menuPermissions`

说明：

- `accessToken` 为 Bearer session token。
- `user.adminLevel` 仅在管理员账号上返回。
- Desktop 通常在登录成功后继续调用 `/desktop/bootstrap` 获取完整导航、计数和功能开关。

### 5.2 `GET /skills`

用于市场列表、搜索、筛选和排序。

查询参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| q | 否 | 搜索关键字 |
| departmentID | 否 | 部门筛选 |
| compatibleTool | 否 | 工具兼容性筛选 |
| installed | 否 | `true` / `false` |
| enabled | 否 | `true` / `false` |
| accessScope | 否 | `authorized_only` / `include_public` |
| category | 否 | 分类筛选，P1 仅消费服务端已有值 |
| riskLevel | 否 | 风险等级筛选 |
| sort | 否 | `composite` / `latest_published` / `recently_updated` / `download_count` / `star_count` / `relevance` |
| page | 否 | 默认 1 |
| pageSize | 否 | 默认 20 |

响应：分页 `SkillSummary`。

### 5.3 `GET /skills/{skillID}`

用于市场详情和受限详情。

响应字段按 `detailAccess` 控制：

- `summary`：只返回摘要字段，不返回 README、审核摘要、包信息。
- `full`：返回完整详情字段。
- `none`：返回 `permission_denied` 或不出现在搜索结果中。

### 5.4 `POST /skills/{skillID}/download-ticket`

用于安装或更新前获取短期下载凭证。仅在当前用户可安装或可更新时返回。

请求：

```json
{
  "purpose": "install",
  "targetVersion": "1.2.0",
  "localVersion": null
}
```

响应：

```json
{
  "skillID": "example-skill",
  "version": "1.2.0",
  "packageRef": "pkg_example_skill_1_2_0",
  "packageURL": "https://internal.example/download/pkg_example_skill_1_2_0?ticket=...",
  "packageHash": "sha256:...",
  "packageSize": 102400,
  "packageFileCount": 12,
  "expiresAt": "2026-04-11T02:40:00Z"
}
```

规则：

- `packageURL` 必须短期有效。
- `packageHash` 必须使用 SHA-256。
- `packageSize` 不得超过 5MB。
- `packageFileCount` 不得超过 100。
- 客户端 Hash 校验失败时不得写入 Central Store。
- 权限收缩、下架、归档状态下必须拒绝新增安装或更新。

### 5.5 `POST /skills/{skillID}/star` 与 `DELETE /skills/{skillID}/star`

用于 Star / 取消 Star。

响应：

```json
{
  "skillID": "example-skill",
  "starred": true,
  "starCount": 12
}
```

### 5.6 `GET /notifications`

用于应用内通知中心。

查询参数：`unreadOnly`、`page`、`pageSize`。

响应：分页 `Notification`。

### 5.7 `POST /notifications/mark-read`

请求：

```json
{
  "notificationIDs": ["n_001"],
  "all": false
}
```

响应：

```json
{
  "unreadNotificationCount": 0
}
```

### 5.8 `POST /desktop/local-events`

用于恢复网络后同步离线期间发生的本地启用/停用事件。该接口不得修改服务端治理状态。

### 5.9 管理端接口

当前阶段新增以下管理员接口：

- `GET /admin/departments`
- `POST /admin/departments`
- `PATCH /admin/departments/{departmentID}`
- `DELETE /admin/departments/{departmentID}`
- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/{userID}`
- `POST /admin/users/{userID}/freeze`
- `POST /admin/users/{userID}/unfreeze`
- `DELETE /admin/users/{userID}`
- `GET /admin/skills`
- `POST /admin/skills/{skillID}/delist`
- `POST /admin/skills/{skillID}/relist`
- `DELETE /admin/skills/{skillID}`
- `GET /admin/reviews`
- `GET /admin/reviews/{reviewID}`

规则：

- 所有 `/admin/*` 接口都要求登录且具备对应 `menuPermissions`。
- 管理写操作额外受部门路径与 `adminLevel` 约束。
- `publisher/*` 接口要求登录；发布上传统一使用 `multipart/form-data`。
- `reviews` 当前阶段提供锁单、通过初审、同意、拒绝、退回接口，并继续受菜单权限、部门路径和管理员等级约束。

请求：

```json
{
  "deviceID": "desktop_001",
  "events": [
    {
      "eventID": "evt_001",
      "eventType": "enable_result",
      "skillID": "example-skill",
      "version": "1.2.0",
      "targetType": "tool",
      "targetID": "codex",
      "targetPath": "C:\\Users\\me\\.codex\\skills",
      "requestedMode": "symlink",
      "resolvedMode": "copy",
      "fallbackReason": "symlink_permission_denied",
      "occurredAt": "2026-04-11T02:20:00Z",
      "result": "success"
    }
  ]
}
```

响应：

```json
{
  "acceptedEventIDs": ["evt_001"],
  "rejectedEvents": [],
  "serverStateChanged": true,
  "remoteNotices": [
    {
      "skillID": "example-skill",
      "noticeType": "skill_update_available",
      "message": "该 Skill 有新版本可更新"
    }
  ]
}
```

## 6. 数据模型

### 6.1 SkillSummary

| 字段 | 必填 | 说明 |
|------|------|------|
| skillID | 是 | Skill 唯一标识，本地目录名 |
| displayName | 是 | 市场展示名称 |
| description | 是 | 简短描述 |
| version | 是 | 当前版本，SemVer |
| status | 是 | `skillStatus` |
| visibilityLevel | 是 | `visibilityLevel` |
| detailAccess | 是 | `detailAccess` |
| canInstall | 是 | 当前用户是否可安装 |
| cannotInstallReason | 否 | 不可安装原因 |
| installState | 是 | 当前设备安装/启用状态 |
| authorName | 否 | 作者展示名 |
| authorDepartment | 否 | 作者部门 |
| currentVersionUpdatedAt | 是 | 最近更新时间 |
| compatibleTools | 是 | 适用工具列表 |
| compatibleSystems | 是 | 适用系统列表 |
| icon | 否 | 图标资源地址 |
| tags | 否 | 标签 |
| category | 否 | 分类 |
| starCount | 是 | Star 数 |
| downloadCount | 是 | 下载量 |
| riskLevel | 否 | `riskLevel` |

### 6.2 SkillDetail

在 `SkillSummary` 基础上增加：

| 字段 | 必填 | 说明 |
|------|------|------|
| readme | 否 | README 内容或资源地址 |
| usage | 否 | 安装/启用说明 |
| screenshots | 否 | 截图资源地址列表 |
| reviewSummary | 否 | 审核摘要，仅展示 |
| riskDescription | 否 | 风险说明 |
| versions | 否 | 历史版本摘要，仅展示；P1 不支持安装历史版本 |
| enabledTargets | 是 | 当前设备已启用位置 |
| latestVersion | 是 | 市场最新版本 |
| hasUpdate | 是 | 当前设备是否有更新 |
| canUpdate | 是 | 当前设备是否可更新 |

### 6.3 Notification

| 字段 | 必填 | 说明 |
|------|------|------|
| notificationID | 是 | 通知 ID |
| type | 是 | `notificationType` |
| title | 是 | 通知标题 |
| summary | 是 | 通知摘要 |
| objectType | 否 | `skill` / `tool` / `project` / `connection` |
| objectID | 否 | 关联对象 ID |
| createdAt | 是 | 创建时间 |
| read | 是 | 是否已读 |
| action | 否 | 跳转目标 |

## 7. 本地状态模型

### 7.1 LocalSkillInstall

| 字段 | 必填 | 说明 |
|------|------|------|
| skillID | 是 | 对应 Skill |
| displayName | 是 | 冗余展示名，离线可用 |
| localVersion | 是 | 当前本地版本 |
| localHash | 是 | 当前本地包 Hash |
| sourcePackageHash | 是 | 最近一次服务端包 Hash |
| installedAt | 是 | 安装时间 |
| updatedAt | 是 | 最近更新时间 |
| localStatus | 是 | `localStatus` |
| centralStorePath | 是 | 本地唯一真源路径 |
| enabledTargets | 是 | 已启用目标 |
| hasUpdate | 是 | 最近联网时计算出的是否有更新 |
| isScopeRestricted | 是 | 最近联网时计算出的是否权限收缩 |
| canUpdate | 是 | 最近联网时计算出的是否可更新 |

### 7.2 EnabledTarget

| 字段 | 必填 | 说明 |
|------|------|------|
| targetType | 是 | `tool` / `project` |
| targetID | 是 | 工具或项目 ID |
| targetName | 是 | 展示名 |
| targetPath | 是 | skills 落地路径 |
| installMode | 是 | 兼容字段，表示实际落地模式；P1 可为 `symlink` / `copy` |
| requestedMode | 是 | 用户或系统请求模式，默认 `symlink` |
| resolvedMode | 是 | 实际落地模式；symlink 成功为 `symlink`，降级为 `copy` |
| fallbackReason | 否 | symlink 失败并降级 copy 时的结构化原因 |
| enabledAt | 是 | 启用时间 |
| status | 是 | `enabled` / `disabled` / `failed` |
| lastError | 否 | 最近失败原因 |

### 7.3 ToolConfig

| 字段 | 必填 | 说明 |
|------|------|------|
| toolID | 是 | 工具 ID |
| displayName | 是 | 工具名称 |
| adapterStatus | 是 | `adapterStatus` |
| detectedPath | 否 | 自动检测路径 |
| configuredPath | 否 | 用户配置路径 |
| skillsPath | 是 | skills 安装路径 |
| enabled | 是 | 当前工具配置是否启用 |
| detectionMethod | 是 | `registry` / `default_path` / `manual` |
| transformStrategy | 是 | Adapter 格式转换策略；内置工具必须有值，自定义目录为 `generic_directory` |
| lastScannedAt | 否 | 最近扫描时间 |

### 7.4 ProjectConfig

| 字段 | 必填 | 说明 |
|------|------|------|
| projectID | 是 | 项目 ID |
| displayName | 是 | 项目名称 |
| projectPath | 是 | 项目路径 |
| skillsPath | 是 | 项目 skills 安装路径 |
| enabled | 是 | 是否启用项目级配置 |
| createdAt | 是 | 创建时间 |
| updatedAt | 是 | 更新时间 |

## 8. 接口验收

- 所有 P1 市场列表项必须返回 `skillID`、`displayName`、`version`、`status`、`detailAccess`、`canInstall`、`installState`。
- 可安装或可更新时，`download-ticket` 必须返回 `packageURL`、`packageHash`、`packageSize`、`packageFileCount` 和 `expiresAt`。
- 无权限、下架、归档、权限收缩场景必须返回稳定错误码，不允许只返回文案。
- 受限详情不得返回 README、审核摘要、包地址或包标识。
- 客户端离线事件同步不得改变权限、下架、版本或审核状态。
- 本地状态必须能在无网络时支撑"我的已安装"、启用/停用、工具/项目路径展示。
- 本地启用/停用事件必须上报 `requestedMode`、`resolvedMode`；发生 copy 降级时必须包含 `fallbackReason`，服务端只记录事实，不改变治理状态。
