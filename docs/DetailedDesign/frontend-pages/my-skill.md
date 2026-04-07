# my-skill 页面设计

## 页面目标
统一承载“已安装 / 我发布的 / 发布 Skill / 权限修改”四类场景。

## 页面区域
- Tab：已安装
- Tab：我发布的
- Tab：发布 Skill
- Tab：权限变更记录

## 关键数据与动作
- `GET /installs/me`
- `GET /skills?scope=my-published`
- `POST /packages/upload`
- `POST /skills`
- `PATCH /skills/:id/visibility`
- `POST /installs/:id/activate`
- `POST /installs/:id/deactivate`

## 状态设计
- 已安装列表需体现“可继续使用但不可更新”
- 发布中/审核中/退回修改状态要有状态标签
- 上传与预检过程需要分阶段进度反馈

## 权限要点
- 权限收缩后按钮文案与提示需统一
- 发布者仅能看到自己发布的 Skill 与权限变更历史
