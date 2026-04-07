# notify 模块设计

## 模块目标
负责站内通知、待办提醒、未读计数和 SSE 推送，服务首页摘要、侧栏红点和通知页。

## 主要职责
- 通知消息创建、分发、已读状态维护
- SSE 连接管理与事件推送
- 待审核数、未读数、更新提示数聚合
- 用户通知偏好与静默配置

## 关键实体
- `notify_messages`
- `notify_recipients`
- `notify_preferences`
- `notify_delivery_attempts`

## 主要 API
- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`
- `GET /notifications/stream`（SSE）
- `GET /notifications/badges`
- `PATCH /notification-preferences`

## SSE 事件建议
- `todo.review.count.changed`
- `notify.unread.count.changed`
- `skill.update.available`
- `review.ticket.assigned`
- `review.ticket.resolved`

## 跨模块依赖
- 从 `review/install/skill/auth` 接收通知源事件
- 与桌面端 `desktop-notify` 协作展示本地提醒

## 主要权衡
- 一期优先 SSE，避免 WebSocket 状态机复杂度
- 通知中心与红点聚合拆分，便于后续扩容
