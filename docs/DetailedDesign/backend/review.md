# review 模块设计

## 模块目标
承载首次发布、更新发布、权限变更的审核单流转，支持锁单、SLA、审核意见和历史时间线。

## 主要职责
- 审核单创建与状态流转
- 审核链路计算与分配
- 锁单领取、转派、超时提醒
- 审核意见记录
- 审核结论回写到 skill/permission 主域

## 关键实体
- `review_tickets`
- `review_assignments`
- `review_actions`
- `review_sla_rules`
- `review_snapshots`

## 主要 API
- `GET /reviews/todo`
- `GET /reviews/in-progress`
- `GET /reviews/done`
- `POST /reviews/:ticketId/claim`
- `POST /reviews/:ticketId/approve`
- `POST /reviews/:ticketId/reject`
- `POST /reviews/:ticketId/return`

## 事件
- `review.ticket.created`
- `review.ticket.claimed`
- `review.ticket.sla.warning`
- `review.ticket.approved`
- `review.ticket.rejected`

## 跨模块依赖
- 从 `org` 获取审核链路
- 向 `skill` / `install` 回写发布/权限变更结果
- 向 `notify` 推送待审核与结论通知

## 主要权衡
- 审核单与业务主档解耦，便于保留独立时间线
- 锁单不应成为永久占用，需 SLA 与自动回收策略
