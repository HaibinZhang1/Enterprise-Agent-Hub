# 系统总体架构设计

## 1. 目标
构建企业内网可部署的 Agent Skill 管理与分发平台，形成“服务端治理 + 桌面端执行 + 前端管理 + 数据层留痕 + 部署层保障”的闭环。

## 2. 分层架构
```text
Tauri Desktop / React Web UI
        |
    REST + SSE
        |
NestJS Domain Services
        |
PostgreSQL + File Volume + Local SQLite
```

### 2.1 客户端层
- Tauri 2 桌面端：承担本地工具扫描、Skill 分发、项目级启停、桌面通知、升级
- React 前端：承担市场、审核、管理、通知、设置等业务页面

### 2.2 服务端层
- 以 NestJS 模块化业务域组织：`auth/org/skill/package/review/install/search/notify/audit`
- REST 为主，SSE 用于待办角标、通知红点、版本更新提示

### 2.3 数据层
- PostgreSQL：业务主库、审计日志、全文检索索引
- File Volume：服务端 Skill 制品归档、已解压包、校验结果
- SQLite：桌面端本地状态、安装记录缓存、冲突决议结果

### 2.4 关键设计原则
1. 服务端是市场、审核、权限与版本的唯一权威源
2. 桌面端是工具落地与本机启用状态的执行者
3. 发布、可见、可安装三者分离
4. 批量组织变更与权限收缩默认 fail-closed
5. 历史记录使用 snapshot，避免组织/角色变化改写历史

## 3. 模块协作总览
- `skill` 持有 Skill 主档、版本、公开级别、归档/上架状态
- `package` 处理 zip 上传、解压、哈希、结构校验、manifest 补全
- `review` 负责任务流、审核单、锁单、SLA、审核意见
- `install` 维护用户安装、启用、卸载、引用关系
- `search` 维护全文检索、排序指标与排行榜口径
- `notify` 负责站内通知、SSE 推送、未读计数
- `audit` 负责操作追踪和审计留痕
- `desktop` 各模块消费服务端能力并执行本地同步

## 4. 关键跨域流程
1. 发布：上传包 -> 包校验 -> 审核 -> 发布 -> 搜索可见 -> 桌面端可安装
2. 更新：新版本上传 -> 审核 -> 原版本保持可用 -> 已安装用户收到更新提示
3. 权限收缩：权限单 -> 审核 -> 存量用户保留使用 -> 新安装/更新受限
4. 桌面启用：用户安装 -> 桌面端同步 -> Tool Adapter 分发 -> 项目/工具启用

## 5. 技术约束映射
- Windows 内网优先：安装器与 WebView2 前置条件要可控
- PostgreSQL FTS：搜索不依赖外部 ES
- Docker Compose 单机/双机主备：优先可运维、少依赖
- pgvector 仅预留 schema 与扩展位，不进一期主路径
