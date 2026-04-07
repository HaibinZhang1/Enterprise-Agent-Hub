# org 模块设计

## 模块目标
管理部门树、角色层级、可管理范围与组织变更影响面，作为权限计算的组织权威源。

## 主要职责
- 部门树 CRUD 与层级约束
- 角色层级枚举与合法性校验
- 用户归属部门、角色分配合法性校验
- 管辖范围计算：本部门及所有后代部门
- 组织变更影响集计算并触发 `authz_version` 收敛

## 关键实体
- `org_departments`
- `org_department_closure`（或 path 枚举）
- `org_roles`
- `org_user_assignments`
- `org_scope_change_jobs`

## 主要 API
- `GET /org/departments/tree`
- `POST /org/departments`
- `PATCH /org/departments/:id`
- `DELETE /org/departments/:id`
- `GET /org/roles`
- `PATCH /org/users/:id/assignment`
- `POST /org/scope/recalculate`

## 事件
- `org.user.assignment.changed`
- `org.department.moved`
- `org.department.deleted`
- `org.scope.recalc.requested`
- `org.scope.recalc.completed`

## 跨模块依赖
- 调用 `auth` 完成授权收敛
- 向 `review` 提供审核链路计算
- 向 `manage` 页面提供组织聚合数据

## 主要权衡
- 闭包表 vs 路径枚举：闭包表更利于后代查询，路径枚举更易读
- 批量组织变更必须 fail-closed，牺牲部分体验换授权正确性
