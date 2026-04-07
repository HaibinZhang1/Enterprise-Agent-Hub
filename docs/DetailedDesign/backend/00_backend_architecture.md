# 服务端分域架构设计

## 1. 架构形态
- NestJS 模块化单体优先
- REST-first
- SSE 用于通知、待办、红点、更新提示
- PostgreSQL 为系统权威主库
- File Volume 存 Skill 制品

## 2. 领域拆分
- `auth`：认证、会话、密码、bootstrap
- `org`：部门树、角色层级、用户归属、数据范围
- `skill`：Skill 主档、版本、公开级别、生命周期
- `package`：上传、解压、校验、manifest 补全、风险预检
- `review`：审核单、锁单、SLA、审核意见
- `install`：安装/启用/卸载/设备同步/权限收缩影响
- `search`：全文检索、排序、榜单、过滤
- `notify`：站内通知、未读、SSE 推送
- `audit`：操作日志、安全审计、actor snapshot

## 3. 关键边界
- `skill` 不直接处理 zip/文件系统细节，制品问题交给 `package`
- `review` 不持有 Skill 主档，只驱动业务流转
- `install` 记录治理视角事实；桌面端记录本机执行结果
- `audit` 是记录者，不反向控制业务主流程

## 4. 统一异步策略
一期建议：数据库 outbox + worker/cron。
适用场景：
- 发布后搜索索引更新
- 审核结果通知
- 权限收缩提醒
- 审计/操作日志异步落表

## 5. 主要设计张力
1. `skill` vs `package`：主档治理与制品治理必须拆开
2. `skill` vs `review`：状态结果与审核过程必须拆开
3. `install` 真相来源：服务端治理事实 vs 桌面执行事实
4. `audit` 范围：一期打底，不扩展成通用 BI 平台
