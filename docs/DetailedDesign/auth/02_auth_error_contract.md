# Auth 错误契约与前端反馈

## 1. 目标
统一 auth 域错误码、HTTP 语义、前端跳转与提示，避免桌面端/Web 端表现漂移。

## 2. 设计原则
1. **错误码稳定，文案可本地化**。
2. **同一错误码对应固定前端动作**。
3. **鉴权失败优先给机器可处理语义，而非仅返回自然语言**。

## 3. 错误码清单

| 错误码 | HTTP | 场景 | 前端动作 |
|---|---:|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 | 停留登录页，提示“账号或密码错误” |
| `AUTH_ACCOUNT_FROZEN` | 403 | 用户已被冻结 | 清理本地 access token，跳转登录页，提示“账号已冻结，请联系管理员” |
| `AUTH_ACCOUNT_LOCKED` | 423 | 连续登录失败触发临时锁定 | 停留登录页，展示剩余等待时间 |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 409 | 首次登录/重置后必须改密 | 跳转改密页，不进入业务首页 |
| `AUTH_SESSION_REVOKED` | 401 | 当前 session 已被撤销 | 清理登录态，跳转登录页 |
| `AUTH_SESSION_EXPIRED` | 401 | access token 过期且 refresh 失败 | 清理登录态，跳转登录页 |
| `AUTH_REFRESH_REUSE_DETECTED` | 401 | refresh token 复用/疑似被盗 | 清理登录态，提示重新登录并上报安全事件 |
| `AUTHZ_VERSION_MISMATCH` | 401 | token 版本落后于当前用户授权版本 | 触发一次 `/auth/refresh`；失败则跳登录页 |
| `AUTHZ_RECALC_PENDING` | 409 | 批量组织变更收敛中 | 展示“权限信息更新中，请稍后重试”，禁止继续业务请求 |
| `AUTH_FORBIDDEN_SCOPE` | 403 | 当前用户无管理范围或无权操作目标对象 | 保持当前页，提示“无权执行该操作” |
| `AUTH_BOOTSTRAP_DISABLED` | 403 | 系统已初始化，bootstrap 不再开放 | 管理端/初始化页隐藏入口 |
| `AUTH_BOOTSTRAP_TICKET_INVALID` | 401 | bootstrap ticket 无效/过期/已使用 | 初始化页提示 ticket 失效 |

## 4. 关键区分规则

### 4.1 `AUTH_ACCOUNT_FROZEN` vs `AUTHZ_VERSION_MISMATCH`
- `AUTH_ACCOUNT_FROZEN`：账号不可用，前端必须直接退出到登录页。
- `AUTHZ_VERSION_MISMATCH`：账号仍有效，但登录态声明已过期；允许先尝试 refresh。

### 4.2 `AUTHZ_VERSION_MISMATCH` vs `AUTHZ_RECALC_PENDING`
- `AUTHZ_VERSION_MISMATCH`：已有新权威版本，refresh 或重登可恢复。
- `AUTHZ_RECALC_PENDING`：系统尚处于收敛窗口，refresh 也应 fail-closed。

### 4.3 `AUTH_SESSION_REVOKED` vs `AUTH_REFRESH_REUSE_DETECTED`
- `AUTH_SESSION_REVOKED`：正常撤销（logout、管理员强制下线、冻结等）。
- `AUTH_REFRESH_REUSE_DETECTED`：风险事件，前端除退出外还应提示安全告警。

## 5. 统一响应体
```json
{
  "errorCode": "AUTHZ_VERSION_MISMATCH",
  "message": "当前登录态已过期，请重新获取权限信息",
  "requestId": "trace-id",
  "retryable": true,
  "metadata": {
    "pendingReason": null,
    "lockedUntil": null
  }
}
```

字段约束：
- `errorCode`：稳定机器码
- `message`：默认中文文案，可被前端 i18n 覆盖
- `requestId`：便于日志追踪
- `retryable`：前端是否允许自动重试
- `metadata`：仅承载有限上下文，禁止泄漏敏感信息

## 6. 前端处理矩阵

### 6.1 登录页
- `AUTH_INVALID_CREDENTIALS`：显示表单错误
- `AUTH_ACCOUNT_LOCKED`：禁用提交按钮并倒计时
- `AUTH_ACCOUNT_FROZEN`：显示联系管理员提示
- `AUTH_PASSWORD_CHANGE_REQUIRED`：跳转强制改密页

### 6.2 全局请求拦截器
- `AUTH_SESSION_EXPIRED` / `AUTHZ_VERSION_MISMATCH`：尝试一次 refresh
- refresh 失败后：清理登录态并跳登录页
- `AUTHZ_RECALC_PENDING`：停止自动重试，进入“权限收敛中”提示态
- `AUTH_REFRESH_REUSE_DETECTED`：清理登录态 + 弹出高风险提示

### 6.3 用户管理页
- 冻结/解冻/重置密码若返回 `AUTH_FORBIDDEN_SCOPE`，页面保留当前上下文，只提示权限不足。

## 7. 可观测性映射
- `AUTH_ACCOUNT_FROZEN` -> `auth.denied_by_status`
- `AUTHZ_VERSION_MISMATCH` -> `auth.denied_by_authz_version`
- `AUTH_REFRESH_REUSE_DETECTED` -> `auth.refresh_reuse_detected`
- `AUTH_BOOTSTRAP_DISABLED` -> `auth.bootstrap_after_initialized_attempt`

## 8. 验收要求
- [ ] 同一错误码在桌面端和 Web 端动作一致
- [ ] `AUTHZ_RECALC_PENDING` 不会被错误当成普通 401 自动刷掉
- [ ] 高风险错误会携带 `requestId`
- [ ] 默认文案可国际化替换
