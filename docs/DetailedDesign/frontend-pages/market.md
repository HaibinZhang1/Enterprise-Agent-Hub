# market 页面设计

## 页面目标
提供 Skill 搜索、筛选、排序、详情查看与安装入口。

## 页面区域
- 搜索框
- 筛选区
- 排序区
- 列表区
- 排行榜侧栏/入口
- Skill 详情抽屉或详情页入口

## 关键数据与动作
- `GET /search/skills`
- `GET /search/leaderboard`
- `GET /skills/:id`
- `POST /installs`
- `POST /skills/:id/star`

## 状态设计
- 区分完整可见、摘要可见、完全不可见
- 无结果、网络异常、权限不足要有独立文案

## 权限要点
- 摘要公开：可见摘要，不可安装
- 详情公开：可见详情，安装按钮置灰
- 全员可安装：正常安装
