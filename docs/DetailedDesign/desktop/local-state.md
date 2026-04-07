# local-state 模块设计

## 模块目标
为桌面端提供 SQLite 状态仓，缓存工具、项目、安装、通知、同步作业与冲突决议。

## 主要职责
- SQLite schema 迁移
- 本地查询仓库
- 同步状态与错误恢复标记
- 离线场景下的只读回显

## 核心表
- `desktop_tools`
- `desktop_projects`
- `desktop_local_skills`
- `desktop_sync_jobs`
- `desktop_conflicts`
- `desktop_notifications`

## 约束
- 不存 refresh token
- 不作为服务端权限权威源
- 支持 schema version 与幂等迁移

## 风险/权衡
- 本地状态要快，但不能把服务端实时权限长时间缓存成事实
