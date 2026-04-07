# department management 页面设计

## 页面目标
管理部门树、下级部门增删改与部门统计信息。

## 页面区域
- 左侧部门树
- 右侧详情面板
- 新增/编辑/删除弹窗

## 关键数据与动作
- `GET /org/departments/tree`
- `POST /org/departments`
- `PATCH /org/departments/:id`
- `DELETE /org/departments/:id`

## 状态设计
- 禁止操作本部门与上级部门时需显式说明原因
- 删除前展示下级部门/用户/skill 影响摘要

## 权限要点
- 只能操作本部门所有后代部门
- 一级管理员支持全局治理视角
