# 服务端模块设计

## 模块索引
- [分域架构](./00_backend_architecture.md)
- [auth（索引）](../auth/README.md)
- [org](./org.md)
- [skill](./skill.md)
- [package](./package.md)
- [review](./review.md)
- [install](./install.md)
- [search](./search.md)
- [notify](./notify.md)
- [audit](./audit.md)

## 统一约束
- REST 为主，SSE 提供红点/待办/通知推送
- 所有写操作输出操作日志；安全关键动作输出审计日志
- 所有模块都要遵守 auth/org 当前权威态
- 跨模块异步协作用 outbox/event 语义描述，落地时可先用数据库 outbox + cron worker
