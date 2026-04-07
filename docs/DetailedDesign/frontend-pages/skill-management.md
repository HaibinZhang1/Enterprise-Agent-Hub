# skill management 页面设计

## 页面目标
提供管理员视角下的 Skill 管理、状态筛选、紧急下架与归档操作。

## 页面区域
- 筛选区
- Skill 列表
- 详情抽屉
- 状态批量操作区

## 关键数据与动作
- `GET /manage/skills`
- `PATCH /skills/:id/status`
- `GET /skills/:id/history`

## 状态设计
- 显示当前状态、发布部门、最近版本、公开级别
- 紧急下架需二次确认和原因输入

## 权限要点
- 跨部门紧急下架仅一级管理员可见
- 普通管理员仅能管理本管辖范围 Skill
