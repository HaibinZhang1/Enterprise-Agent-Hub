# Auth 模块详细设计

## 1. 文档定位

### 1.1 目标
为 Enterprise Agent Hub 的 `auth` 模块提供准实施级详细设计，支撑：
- 后端 `NestJS` 模块建模
- PostgreSQL 表设计与约束定义
- 桌面端 / Web 前端登录态集成
- 与 `org` / `audit` / `notify` 的跨模块对接

### 1.2 设计原则
1. **服务端权威**：最终认证/授权只信服务端当前状态，不信任客户端缓存声明。
2. **即时失效**：冻结、角色变化、部门变化、密码变更后，下一次请求即收敛。
3. **边界清晰**：`auth` 管账号、凭证、会话；`org` 管部门树、角色层级、数据范围。
4. **桌面优先但非桌面耦合**：兼容 Tauri 客户端，同时保留未来浏览器/API 接入能力。
5. **可审计**：所有高风险认证与管理员动作必须留下安全审计证据。

### 1.3 输入依据
- 需求约束：自建账号体系、初始一级管理员、上级管理员创建用户、冻结/解冻、角色/部门实时生效。
- 已批准方案：`.omx/plans/prd-auth-iam-design.md`
- 已批准验证规格：`.omx/plans/test-spec-auth-iam-design.md`

---

## 2. 模块边界

### 2.1 `auth` 模块职责
`auth` 模块负责：
- 登录、刷新、登出、登出全部
- 本地账号凭证管理
- 账号状态管理：正常 / 冻结 / 临时锁定
- session 生命周期与 refresh rotation
- 初始一级管理员 bootstrap
- 密码策略、首次改密、重置密码
- `AuthProvider` 抽象及 `local` provider 落地
- 认证类安全审计事件产出

### 2.2 `auth` 不负责
以下内容不在 `auth` 内部闭环：
- 部门树结构维护
- 角色层级规则定义
- 数据范围计算
- 用户列表页/部门树聚合查询
- 历史审核单据业务逻辑

### 2.3 与 `org` 的边界
- `auth` 保存 `department_id` / `role_code` 引用，用于用户当前归属与登录态展示。
- `org` 负责：
  - 部门合法性校验
  - 角色层级合法性校验
  - 可管理范围判断
  - 组织变更影响面计算
- `org` 对影响授权结果的变更负责触发 `authz_version` 收敛。

### 2.4 与 `audit` 的边界
- `auth` 只负责产生 auth 域安全事件。
- `audit` 负责统一落表、查询与归档。
- auth 设计需要明确事件 schema，但不展开 audit 中心索引/分区方案。

---

## 3. 总体方案

### 3.1 认证模型
采用：
- **短效 access token（JWT）**
- **数据库权威 refresh session（opaque token + hash 存储）**
- **provider seam（V1 为 local，V2 可扩展 LDAP/AD）**

### 3.2 鉴权权威链
每个受保护请求按以下顺序验证：
1. 校验 access token 签名与过期时间
2. 通过 `sid` 读取 `auth_sessions`
3. 确认 session 未撤销、未轮换失效、未 idle timeout
4. 读取 `users`
5. 校验 `users.status = active`
6. 比较 `token.authz_version == users.authz_version`
7. 需要权限判定时，再读取 `org` 当前投影/聚合结果

> 结论：JWT 仅是 transport envelope，不是最终授权依据。

### 3.3 Token 内容约束
access token 仅包含：
- `sub`
- `sid`
- `authz_version`
- `provider`
- `jti`
- `iat`
- `exp`

可选字段：
- `role_code`
- `department_id`

但仅用于前端 UI hint，不用于服务端最终授权判断。

### 3.4 生命周期参数建议
- access token TTL：`10~15 min`
- refresh session absolute TTL：`30 day`
- refresh session idle TTL：`7 day`
- bootstrap ticket TTL：`10 min`
- 密码重置 ticket TTL：`15 min`
- 登录失败锁定：连续 5 次失败，锁定 15 分钟

---

## 4. 数据模型设计

## 4.1 `users`
用于保存用户主档与当前权威认证态。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `username` | varchar(64) unique | 登录名，企业内唯一 |
| `display_name` | varchar(128) | 展示名 |
| `department_id` | uuid | 当前所属部门 |
| `role_code` | varchar(32) | 当前角色编码 |
| `status` | varchar(16) | `active` / `frozen` |
| `provider` | varchar(16) | `local` / `ldap` / `ad` |
| `provider_subject` | varchar(128) nullable | 外部目录唯一标识 |
| `must_change_password` | boolean | 首次登录或重置后强制改密 |
| `authz_version` | bigint | 当前权限版本 |
| `authz_recalc_pending` | boolean | 批量组织变更收敛中 |
| `authz_target_version` | bigint nullable | 收敛目标版本 |
| `authz_pending_reason` | varchar(64) nullable | pending 原因枚举 |
| `last_login_at` | timestamptz nullable | 最近登录时间 |
| `created_by` | uuid nullable | 创建人 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束：
- `username` 全局唯一。
- `status='frozen'` 时不可签发新 session。
- `authz_target_version >= authz_version`。
- `authz_recalc_pending=false` 时允许 `authz_target_version` 为空。

## 4.2 `user_local_credentials`

| 字段 | 类型 | 说明 |
|---|---|---|
| `user_id` | uuid pk/fk | 对应用户 |
| `password_hash` | text | Argon2id 哈希 |
| `password_algo` | varchar(32) | 版本化算法标识 |
| `password_policy_version` | integer | 密码策略版本 |
| `failed_attempt_count` | integer | 连续失败次数 |
| `locked_until` | timestamptz nullable | 临时锁定截止时间 |
| `password_changed_at` | timestamptz | 最近改密时间 |

## 4.3 `auth_sessions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | session 主键，也是 token `sid` |
| `user_id` | uuid | 用户 |
| `session_family_id` | uuid | refresh 轮换血缘根 |
| `parent_session_id` | uuid nullable | 上一个 session |
| `client_type` | varchar(16) | `desktop` / `web` / `api` |
| `device_label` | varchar(128) | 设备标识 |
| `refresh_token_hash` | text | refresh token hash |
| `issued_at` | timestamptz | 签发时间 |
| `last_seen_at` | timestamptz | 最近使用时间 |
| `expires_at` | timestamptz | 绝对过期 |
| `idle_expires_at` | timestamptz | 空闲过期 |
| `revoked_at` | timestamptz nullable | 撤销时间 |
| `revoke_reason` | varchar(32) nullable | 撤销原因 |
| `issued_authz_version` | bigint | 签发时版本 |

索引建议：
- `(user_id, revoked_at)`
- `(session_family_id, revoked_at)`
- `(expires_at)`
- `(idle_expires_at)`

## 4.4 `password_reset_tickets`
用于管理员重置密码、首次密码找回（如后续支持）。

## 4.5 `password_history`
用于禁止历史密码复用。

## 4.6 `auth_actor_snapshots`
用于保留操作时的身份快照，避免组织变更改写历史。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键 |
| `actor_user_id` | uuid | 操作者用户 ID |
| `actor_username` | varchar(64) | 操作者用户名 |
| `actor_role_code` | varchar(32) | 操作者当时角色 |
| `actor_department_id` | uuid | 操作者当时部门 |
| `actor_department_path` | text | 当时部门路径快照 |
| `captured_at` | timestamptz | 快照时间 |
| `capture_reason` | varchar(32) | 来源动作 |

---

## 5. 关键状态机

### 5.1 用户状态机
```text
active --freeze--> frozen
frozen --unfreeze--> active
```

规则：
- `freeze` 后立即撤销所有 session。
- `unfreeze` 不恢复旧 session，用户必须重新登录。

### 5.2 session 状态机
```text
issued -> active -> rotated -> revoked -> expired
```

说明：
- `rotated` 表示 refresh 成功后旧 session 失效。
- 并发 refresh 时，只有首个成功事务可产生活跃 leaf session。
- 复用旧 refresh token 会触发 `session_family_id` 级联撤销。

### 5.3 authz 收敛状态机
```text
normal -> pending_recalc -> converged
normal -> pending_recalc -> manual_repair
```

规则：
- 批量组织变更命中用户后进入 `pending_recalc`。
- pending 期间所有 refresh 失败，所有受保护请求 fail-closed。
- fresh login 允许，但需原子完成版本推进与旧 family 撤销。

---

## 6. 核心流程设计

### 6.1 登录流程
1. 用户提交用户名/密码。
2. 校验 `users.status`；若冻结直接拒绝。
3. 校验 `user_local_credentials.locked_until`。
4. 进行密码校验。
5. 成功后创建 root session。
6. 生成 access token + refresh token。
7. 返回登录态；若 `must_change_password=true`，前端跳转强制改密流程。
8. 记录审计事件 `AUTH_LOGIN_SUCCEEDED`。

### 6.2 refresh 流程
1. 客户端提交 refresh token。
2. 根据 hash 匹配当前 leaf session。
3. 若 session 已 revoked / rotated / expired -> 拒绝。
4. 若用户 `authz_recalc_pending=true` -> 返回 `AUTHZ_RECALC_PENDING`。
5. 若 `users.status='frozen'` -> 返回 `AUTH_ACCOUNT_FROZEN`。
6. rotation：创建新 session，撤销旧 session。
7. 返回新 access token + 新 refresh token。

### 6.3 logout / logout-all
- `logout`：仅撤销当前 `sid`。
- `logout-all`：按 `user_id` 或 family 范围批量撤销所有未失效 session。

### 6.4 冻结用户流程
1. 管理员发起冻结。
2. `org` 校验操作者是否有权管理目标用户。
3. `auth` 在同事务内：
   - 更新 `users.status='frozen'`
   - bump `authz_version`
   - 撤销全部 session
   - 写审计事件
4. 目标用户下一次任意受保护请求立即失败。

### 6.5 解冻用户流程
1. 管理员发起解冻。
2. 更新 `users.status='active'`。
3. bump `authz_version`。
4. 不恢复旧 session。
5. 用户需重新登录。

### 6.6 管理员创建用户流程
1. 管理员提交用户名、部门、角色。
2. `org` 校验部门/角色合法性与层级约束。
3. `auth` 创建 `users` + `user_local_credentials`。
4. 生成临时密码或一次性 ticket。
5. `must_change_password=true`。
6. 记录 `AUTH_USER_CREATED` 审计事件。

### 6.7 密码修改/重置流程
- 用户主动改密：校验旧密码 + 新密码策略 + 历史密码。
- 管理员重置：生成重置 ticket 或临时密码。
- 两者都必须：
  - bump `authz_version`
  - 撤销旧 session family
  - 记录审计事件

### 6.8 批量组织变更收敛流程
1. `org` 完成组织变更并识别受影响用户集合。
2. 事务内写入 affected users 的 `authz_recalc_pending=true` 和更大的 `authz_target_version`。
3. outbox/job 逐用户推进新版本。
4. 完成后清理 pending 标志。
5. 若重试耗尽则进入人工修复队列。

---

## 7. API 设计

## 7.1 公开认证接口

### `POST /auth/login`
**请求**
```json
{
  "username": "zhangsan",
  "password": "******",
  "clientType": "desktop",
  "deviceLabel": "ZH-PC-01"
}
```

**成功响应**
```json
{
  "accessToken": "jwt",
  "expiresIn": 900,
  "refreshToken": "opaque-token",
  "mustChangePassword": true,
  "user": {
    "id": "uuid",
    "username": "zhangsan",
    "displayName": "张三",
    "roleCode": "dept_admin_lv4",
    "departmentId": "uuid"
  }
}
```

### `POST /auth/refresh`
返回新 token 对。若处于 pending/frozen/revoked，返回对应错误码。

### `POST /auth/logout`
撤销当前 session。

### `POST /auth/logout-all`
撤销当前用户所有 session family。

### `GET /auth/me`
返回当前登录用户的：
- 基础信息
- 当前角色
- 当前部门
- `mustChangePassword`
- 头像菜单展示所需身份信息

### `POST /auth/change-password`
主动修改密码。

## 7.2 管理员接口
- `POST /auth/admin/users`
- `PATCH /auth/admin/users/:id/freeze`
- `PATCH /auth/admin/users/:id/unfreeze`
- `POST /auth/admin/users/:id/reset-password`
- `POST /auth/admin/users/:id/revoke-sessions`

## 7.3 bootstrap 接口/命令
优先级：
1. CLI `bootstrap-admin`
2. 初始化窗口下的一次性 HTTP ticket

> 生产基线不依赖固定默认管理员密码。

---

## 8. 错误码与反馈语义

auth 模块必须输出稳定错误码，详见：
- [02_auth_error_contract.md](./02_auth_error_contract.md)

最关键区分：
- `AUTH_ACCOUNT_FROZEN`
- `AUTHZ_VERSION_MISMATCH`
- `AUTHZ_RECALC_PENDING`
- `AUTH_SESSION_REVOKED`
- `AUTH_REFRESH_REUSE_DETECTED`
- `AUTH_PASSWORD_CHANGE_REQUIRED`

---

## 9. 与前端/桌面端交互约定

### 9.1 Tauri 客户端存储要求
- refresh token：仅可存放在 **OS 安全存储**。
- access token：仅驻留内存。
- SQLite 仅存本地状态，不得存 refresh token 明文。

### 9.2 前端状态管理建议
- `authStore`：当前用户、token 生命周期、mustChangePassword 状态
- `query/me`：拉取当前用户身份
- 全局 401/403/419 风险处理器：按错误码执行跳转与提示

### 9.3 页面映射
- 登录页：用户名/密码登录、首次改密、错误提示
- 顶栏用户头像：展示个人信息、角色信息、退出登录
- 用户管理页：创建用户、冻结/解冻、重置密码

---

## 10. 模块内部结构建议（NestJS）

```text
src/modules/auth/
├── controllers/
│   ├── auth.controller.ts
│   ├── auth-admin.controller.ts
│   └── bootstrap.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── session.service.ts
│   ├── password.service.ts
│   ├── bootstrap.service.ts
│   ├── authz-version.service.ts
│   └── provider/
│       ├── auth-provider.interface.ts
│       └── local-auth.provider.ts
├── guards/
│   ├── access-token.guard.ts
│   └── role-scope.guard.ts
├── strategies/
│   └── jwt.strategy.ts
├── repositories/
│   ├── user.repository.ts
│   ├── session.repository.ts
│   └── credential.repository.ts
├── dto/
├── events/
└── auth.module.ts
```

设计说明：
- `authz-version.service` 专门处理版本 bump、pending 状态与收敛规则。
- provider 目录隔离 `local` 与未来 LDAP/AD provider。

---

## 11. 安全与审计要求

### 11.1 强制审计事件
- 登录成功/失败
- 登出 / 登出全部
- 创建用户
- 冻结 / 解冻
- 重置密码
- bootstrap-admin
- refresh token reuse detected

### 11.2 风控/告警指标
- `auth.denied_by_status`
- `auth.denied_by_authz_version`
- `auth.refresh_reuse_detected`
- `auth.bootstrap_after_initialized_attempt`
- `auth.login_failures`

### 11.3 安全基线
- Argon2id
- refresh token hash 存储
- 不输出明文密码/明文 token 到日志
- bootstrap ticket 一次性消费

---

## 12. 验收清单
- [ ] 冻结后下一次请求立即失败
- [ ] 解冻后必须重新登录
- [ ] 角色/部门变化后下一次请求按新授权收敛
- [ ] 批量 org 变更 fail-closed 生效
- [ ] refresh token 不落 SQLite/localStorage
- [ ] 历史记录保留 actor snapshot
- [ ] bootstrap 不依赖默认管理员密码
- [ ] 错误码与前端反馈一致

---

## 13. 实施前待确认项
1. `department_id` / `role_code` 是否在 `/auth/me` 之外额外返回组织路径摘要。
2. refresh session absolute TTL 是否按 30 天基线，或需要更短内网策略。
3. Windows Credential Manager 的封装方式由桌面端统一基础设施提供还是 auth 模块配套 SDK 提供。
