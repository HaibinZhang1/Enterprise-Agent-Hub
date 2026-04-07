# user management 页面设计

## 页面目标
管理用户创建、角色分配、冻结解冻、查看最近登录与发布信息。

## 页面区域
- 筛选栏（部门/角色/状态）
- 用户表格
- 创建/编辑弹窗
- 冻结/解冻/重置密码动作栏

## 关键数据与动作
- `GET /manage/users`
- `POST /auth/admin/users`
- `PATCH /auth/admin/users/:id/freeze`
- `PATCH /auth/admin/users/:id/unfreeze`
- `POST /auth/admin/users/:id/reset-password`

## 状态设计
- 冻结状态要显著
- 最近登录时间预留为空时显示“未登录”
- 重置密码成功后给出一次性结果反馈

## 权限要点
- 只能设置低于自身级别的角色
- 仅能操作本管辖范围内用户
