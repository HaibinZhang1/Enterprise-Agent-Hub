# 本地测试环境启动说明

本文档用于在 **macOS 开发机** 上启动当前仓库的测试环境，目标是：

- 用 Docker 启动后端依赖与 API
- 在本机启动 Tauri Desktop 客户端
- 不构建安装包，只做实际运行与功能测试

当前文档基于已经验证过的一套可运行链路整理。

> 说明：这份文档描述的是**快速本地调试路径**，适合排查市场/安装/本地状态问题；它不是发布审核到下载安装的完整闭环证明路径。完整闭环请使用仓库根目录的 `npm run p1:full-closure`、`npm run p1:ui-closure` 或 `npm run p1:native-closure`。

## 1. 适用范围

适用于：

- macOS 本机测试 `apps/desktop`
- 通过 Docker 提供 PostgreSQL / Redis / MinIO / API
- 通过 `npm run tauri:dev` 启动 Tauri 客户端

不适用于：

- Windows NSIS 安装包构建
- macOS 安装包构建
- 生产环境部署

## 2. 前置条件

需要本机具备：

- Docker Desktop 已启动
- Node.js / npm 可用
- 仓库依赖已安装
- Tauri/Rust 开发环境已安装

建议先在项目根目录确认：

```sh
docker info
npm -v
cargo -V
```

## 3. 当前已验证的启动方式

### 3.1 启动 Docker 基础服务

在项目根目录执行：

```sh
docker rm -f api postgres redis minio >/dev/null 2>&1 || true
docker network create eah-testnet >/dev/null 2>&1 || true

docker run -d --name postgres \
  --network eah-testnet \
  -e POSTGRES_DB=enterprise_agent_hub \
  -e POSTGRES_USER=eah \
  -e POSTGRES_PASSWORD=change-me \
  -p 5432:5432 \
  pgvector/pgvector:pg16

docker run -d --name redis \
  --network eah-testnet \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes

docker run -d --name minio \
  --network eah-testnet \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=change-me-minio-secret \
  -p 9000:9000 \
  -p 9001:9001 \
  minio/minio:latest \
  server /data --console-address :9001
```

等待服务 ready：

```sh
until docker exec postgres pg_isready -U eah -d enterprise_agent_hub >/dev/null 2>&1; do sleep 1; done
until docker exec redis redis-cli ping >/dev/null 2>&1; do sleep 1; done
until curl -fsS http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1; do sleep 1; done
```

### 3.2 跑数据库迁移与种子

当前已验证方式使用本机已有的 `docker-backend:latest` 作为 Node 运行时容器，直接挂载当前仓库源码执行 `apps/api` 的 dev 脚本。

在项目根目录执行：

```sh
docker run --rm \
  --network eah-testnet \
  -v "$PWD:/app" \
  -w /app/apps/api \
  -e DATABASE_URL=postgresql://eah:change-me@postgres:5432/enterprise_agent_hub \
  docker-backend:latest \
  npm run migrate:dev

docker run --rm \
  --network eah-testnet \
  -v "$PWD:/app" \
  -w /app/apps/api \
  -e DATABASE_URL=postgresql://eah:change-me@postgres:5432/enterprise_agent_hub \
  docker-backend:latest \
  npm run seed:dev
```

### 3.3 启动 API 容器

在项目根目录执行：

```sh
docker run -d --name api \
  --network eah-testnet \
  -p 3000:3000 \
  -v "$PWD:/app" \
  -w /app/apps/api \
  -e API_PORT=3000 \
  -e DATABASE_URL=postgresql://eah:change-me@postgres:5432/enterprise_agent_hub \
  -e REDIS_URL=redis://redis:6379/0 \
  -e JWT_SECRET=change-me-before-deploy \
  docker-backend:latest \
  npm run start:dev
```

健康检查：

```sh
curl http://127.0.0.1:3000/health
```

当前已验证结果类似：

```json
{"status":"degraded","api":"ok","postgres":"ok","redis":"ok","minio":"not_configured"}
```

说明：

- 这里的 `minio=not_configured` 是因为 API 容器没有注入 `MINIO_*` 环境变量
- 这不会阻塞当前桌面端核心功能测试，因为下载会回退到仓库里的本地 seed package
- 如果后续要验证对象存储链路，再给 API 容器补上 `MINIO_*` 环境变量并初始化 bucket

### 3.4 启动 mac 桌面客户端

推荐直接在一个真实 Terminal 会话里启动：

```sh
cd apps/desktop
npm run tauri:dev
```

如果希望由脚本直接拉起一个 Terminal tab，可以在项目根目录执行：

```sh
osascript <<'APPLESCRIPT'
tell application "Terminal"
  activate
  do script "cd /Users/zhb/Documents/MyProjects/EnterpriseAgentHub/apps/desktop && npm run tauri:dev"
end tell
APPLESCRIPT
```

启动后会同时拉起：

- Vite dev server: `http://127.0.0.1:1420`
- Tauri 桌面原生窗口

## 4. 默认测试账号

已验证可登录账号：

- 普通用户
  - 用户名：`demo`
  - 密码：`demo123`
- 超级管理员
  - 用户名：`superadmin`
  - 密码：`demo123`

如需管理员页测试，直接用 `superadmin / demo123`。

## 5. 当前可测试范围

当前这套环境可以直接测试：

- 登录 / 游客模式切换
- 市场列表、详情、搜索
- 下载 ticket -> 本地安装
- Tool / Project 路径配置
- enable / disable / uninstall
- SQLite 本地状态恢复
- 通知 / 设置 / 管理页基本连通性

不建议把这一套环境当成“完整闭环已验证”的依据，因为：

- 发布审核闭环现在由隔离的 full-closure harness 负责验证
- full-closure harness 会启用 MinIO、隔离端口和真实 UI + native smoke
- 本文档这条路径优先保证快速开发调试，而不是 release gate 一致性

## 6. 当前限制

### 6.1 Docker 镜像限制

本地如果无法访问 Docker Hub，`deploy/server-up.sh` 或 `docker compose -f infra/docker-compose.prod.yml up` 可能会卡在拉取这些镜像：

- `postgres:16.6-bookworm`
- `redis:7.4.1-bookworm`
- `minio/minio:RELEASE.2024-12-18T13-15-44Z`
- `enterprise-agent-hub-api:0.1.0-p1`

因此当前文档优先记录的是 **已实测可跑** 的启动方式，而不是完整生产 compose 路径。

### 6.2 尚未覆盖的验证

仍需要额外实机验证的内容：

- macOS 上 Codex / Windsurf / OpenCode 的真实路径约定
- macOS 上 `tauri dev` 长时运行与完整交互
- Windows 注册表探测
- Windows symlink 权限 / copy fallback
- Windows NSIS 打包

## 7. 停止环境

### 7.1 停客户端

直接关闭运行 `npm run tauri:dev` 的 Terminal 窗口，或执行：

```sh
pkill -f 'npm run tauri:dev|vite --host 127.0.0.1|enterprise-agent-hub-desktop'
```

### 7.2 停 Docker 后端

```sh
docker rm -f api postgres redis minio
```

如果还想清掉测试网络：

```sh
docker network rm eah-testnet
```

## 8. 快速检查命令

### 看容器状态

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

### 看 API 日志

```sh
docker logs --tail 200 api
```

### 看客户端健康状态

```sh
curl http://127.0.0.1:3000/health
```

### 看桌面相关进程

```sh
pgrep -af 'npm run tauri:dev|vite --host 127.0.0.1|enterprise-agent-hub-desktop'
```

## 9. 后续可选优化

如果后面要把这份文档进一步固化成脚本化入口，建议新增：

- 根目录 `scripts/start-local-test-env.sh`
- 根目录 `scripts/stop-local-test-env.sh`
- 一个支持 `MINIO_*` 注入的 API 启动脚本
- 一个 mac 专用的 `scripts/start-desktop-mac.sh`
