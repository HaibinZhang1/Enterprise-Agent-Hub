# review 页面设计

## 页面目标
为管理员提供待审核、审核中、已审核工作台与审核详情时间线。

## 页面区域
- Tab：待审核
- Tab：审核中
- Tab：已审核
- 列表区
- 详情区
- 时间线与审核动作区

## 关键数据与动作
- `GET /reviews/todo`
- `GET /reviews/in-progress`
- `GET /reviews/done`
- `POST /reviews/:id/claim`
- `POST /reviews/:id/approve`
- `POST /reviews/:id/reject`
- `POST /reviews/:id/return`

## 状态设计
- 待审核为空时提示当前无任务
- 锁单超时、SLA 预警需高亮
- 审核动作后列表与角标即时更新

## 权限要点
- 仅管理员可见
- 审核链路与可领任务由服务端权威决定
