# home 页面设计

## 页面目标
作为登录后的统一工作台，展示待办、我的安装、我的发布、推荐与通知摘要。

## 页面区域
- 顶部欢迎区
- 我的待办卡片
- 我的安装情况
- 我的发布情况
- 热门/推荐 Skill
- 最近更新
- 通知摘要

## 关键数据
- `/notifications/badges`
- `/reviews/todo` 摘要
- `/installs/me` 摘要
- `/skills?scope=mine-published`
- `/search/leaderboard`

## 状态设计
- loading：骨架屏
- empty：无待办/无安装/无发布分别展示空状态
- error：局部卡片级错误，不阻断整页

## 权限要点
- 普通用户无审核卡片时隐藏审核入口
- 管理员看到待审核数角标与快捷入口
