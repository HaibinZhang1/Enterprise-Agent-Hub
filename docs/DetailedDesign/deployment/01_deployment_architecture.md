# 部署层设计

## 1. 目标部署形态
- Linux 单机优先
- 可扩展到双机主备
- 组件：Nginx + NestJS API + PostgreSQL + File Volume + 桌面客户端安装分发

## 2. Docker Compose 组件
- `nginx`
- `api`
- `worker`（可选，与 API 进程分离处理 cron/outbox）
- `postgres`
- `backup-agent`（可选，执行备份脚本）

## 3. 流量与边界
- Nginx 统一暴露 HTTPS / 内网 HTTP
- REST 与 SSE 统一经 Nginx 反向代理
- 文件上传走 Nginx -> API -> volume，不直接暴露卷目录

## 4. 备份策略
- PostgreSQL：全量 + WAL/定时逻辑备份
- Skill 文件卷：定时增量备份
- 恢复演练需同时校验 DB 与 volume 的版本一致性

## 5. 主备建议
- 主库写、备库热备
- volume 建议 NAS 或对象存储网关方案保证双机可切换
- 触发切换后需重新校验 SSE 会话与定时任务主控归属

## 6. 运维关注项
- WebView2 安装前置条件与客户端发版包管理
- 大文件上传超时配置
- SSE 长连接超时与代理 buffer 设置
- 数据库连接池、慢查询、FTS 索引膨胀监控
