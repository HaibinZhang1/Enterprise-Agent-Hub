# notifications 页面设计

## 页面目标
统一展示通知列表、未读状态、筛选与批量已读。

## 页面区域
- 筛选栏
- 通知列表
- 批量已读操作

## 关键数据与动作
- `GET /notifications`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`
- `GET /notifications/stream`

## 状态设计
- 红点与未读数要与侧栏一致
- 通知为空时展示空状态
- SSE 断开时提示“实时连接中断，已切换轮询”

## 权限要点
- 只显示当前用户通知
