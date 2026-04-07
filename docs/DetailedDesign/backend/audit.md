# audit 模块设计

## 模块目标
沉淀操作日志与安全审计日志，支持问题追溯、合规留痕与异常定位。

## 主要职责
- 接收各业务域操作事件
- 区分操作日志与审计日志
- 保存 actor snapshot、目标对象、请求链路、结果与原因
- 提供按时间、对象、操作者的查询入口

## 关键实体
- `audit_operation_logs`
- `audit_security_logs`
- `audit_actor_snapshots`

## 主要 API
- `GET /audit/operations`
- `GET /audit/security`
- `GET /audit/:logId`

## 关键字段
- `request_id`
- `actor_snapshot_id`
- `target_type` / `target_id`
- `action`
- `result`
- `reason`
- `occurred_at`

## 跨模块依赖
- 接收 auth/review/package/install/skill/org 的 outbox 事件
- 向管理页和问题排查页提供只读查询

## 主要权衡
- 操作日志与安全审计分表，避免查询模型混淆
- 一期优先保留必要追溯字段，不把 audit 扩展成通用 BI 平台
