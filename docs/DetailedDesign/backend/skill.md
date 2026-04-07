# skill 模块设计

## 模块目标
作为 Skill 主档与版本治理中心，管理元数据、版本、公开级别、上下架、归档与详情展示基础信息。

## 主要职责
- Skill 主档创建、版本登记、状态流转
- 公开级别/授权范围元数据维护
- 详情摘要、标签、README 摘要索引维护
- 归档、下架、重新上架
- 版本与权限变更历史展示基础数据

## 关键实体
- `skill_catalog`
- `skill_versions`
- `skill_visibility_rules`
- `skill_tags`
- `skill_changelogs`

## 主要 API
- `GET /skills`
- `GET /skills/:skillId`
- `POST /skills`
- `POST /skills/:skillId/versions`
- `PATCH /skills/:skillId/visibility`
- `PATCH /skills/:skillId/status`
- `GET /skills/:skillId/history`

## 事件
- `skill.created`
- `skill.version.submitted`
- `skill.published`
- `skill.delisted`
- `skill.archived`
- `skill.visibility.changed`

## 跨模块依赖
- 依赖 `package` 提供包校验结果
- 依赖 `review` 提供审核结论
- 向 `search` 投递索引更新
- 向 `notify` 投递发布/下架/更新通知

## 主要权衡
- Skill 主档与版本分表，避免权限变更与代码版本耦合
- 权限变更记录独立于版本号，符合需求“修改权限不变更代码版本”
