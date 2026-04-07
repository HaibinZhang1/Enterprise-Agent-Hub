# 数据层设计

## 1. 目标
支撑 Skill 市场、审核、权限、安装、搜索、通知、审计的统一持久化，并为桌面端本地状态留出同步边界。

## 2. PostgreSQL 逻辑分域
- `auth_*`：账号、凭证、会话、密码历史
- `org_*`：部门、角色、用户组织投影、数据范围
- `skill_*`：Skill 主档、版本、公开级别、标签、归档
- `package_*`：上传包、哈希、解压记录、结构校验结果
- `review_*`：审核单、审核节点、锁单、SLA、意见
- `install_*`：安装记录、启用记录、引用关系、卸载记录
- `notify_*`：站内通知、未读状态、订阅偏好
- `audit_*`：操作日志、审计日志、actor snapshot

## 3. 关键索引策略
- 用户/角色/部门类：按 `department_id`、`role_code`、`status`
- Skill 检索类：按 `status`、`visibility_level`、`published_at`、`tsvector`
- 审核类：按 `assignee_id`、`ticket_status`、`sla_deadline`
- 安装类：按 `user_id`、`skill_id`、`tool_id`、`project_id`
- 通知类：按 `recipient_id`、`read_at`、`created_at`

## 4. 全文检索
- PostgreSQL FTS 索引对象：skill 名称、描述、标签、README 摘要、发布部门
- 排序权重：精确名称 > 标签 > 描述 > README 摘要
- 搜索结果需先过权限过滤，再做排序与分页

## 5. pgvector 预留
- 仅预留扩展安装与 embedding 字段位置
- 一期不要求向量召回上线
- 未来可用于“相似 Skill 推荐”和 README 语义检索

## 6. 文件卷策略
- 原始 zip、解压工作区、结构校验中间产物、已发布制品分目录存放
- 元数据落 PostgreSQL，制品落 volume，二者用 package_id / version_id 关联

## 7. SQLite 本地状态
- 只承载桌面本机状态：工具发现、项目路径、安装/启用缓存、冲突决议、同步队列
- 不存 refresh token、不存服务端权威权限状态
