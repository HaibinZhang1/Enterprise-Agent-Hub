# 03. 服务端 Docker 一键部署详细设计

## 1. 结论

服务端可以通过 Docker Compose 做到一键部署，范围包括：

- NestJS API
- PostgreSQL
- Redis
- MinIO
- 数据库迁移
- 种子数据初始化
- 健康检查

推荐交付形态：

```bash
./deploy/server-up.sh
```

脚本内部执行环境检查、加载 `.env`、启动 Compose、运行迁移和初始化种子数据，最终输出服务地址、MinIO Console 地址和健康检查结果。

需要明确的边界：

- Docker 一键部署能屏蔽 Node.js、PostgreSQL、Redis、MinIO 的宿主机安装差异，但不能屏蔽宿主机内核、cgroups、iptables、文件系统和 Docker Engine 本身的兼容性。
- 服务器系统版本很低时，不应在服务器上 build 镜像；应使用 CI 产出的镜像或离线镜像包。
- 如果服务器低到无法稳定运行 Docker Engine，则不承诺一键部署，建议升级系统、换新内核、使用新虚拟机，或由运维提供可运行 Docker 的内网基础环境。

## 2. 部署目录结构

```text
EnterpriseAgentHub/
├── deploy/
│   ├── server-up.sh
│   ├── server-down.sh
│   ├── server-check.sh
│   ├── load-offline-images.sh
│   └── README.md
├── infra/
│   ├── docker-compose.prod.yml
│   ├── docker-compose.legacy.yml
│   ├── env/
│   │   ├── server.env.example
│   │   └── server.env
│   ├── postgres/
│   │   └── init/
│   ├── minio/
│   │   └── buckets/
│   └── nginx/
│       └── nginx.conf
└── apps/
    └── api/
```

说明：

- `docker-compose.prod.yml` 面向标准 Docker Compose v2。
- `docker-compose.legacy.yml` 面向低版本 Docker / 旧版 `docker-compose` 的保守降级，避免使用较新的 Compose 特性。
- `server.env.example` 提供可复制模板，真实 `server.env` 不提交。
- `load-offline-images.sh` 用于内网离线部署：先 `docker load` API、PostgreSQL、Redis、MinIO、Nginx 镜像，再执行 `server-up.sh`。

## 3. Compose 服务设计

| 服务 | 镜像来源 | 责任 | 持久化 |
| --- | --- | --- | --- |
| `api` | 企业内网镜像仓库或离线 tar | NestJS 服务端 | 无业务文件持久化；日志 stdout。 |
| `api-migrate` | 同 `api` | 执行数据库迁移 | 一次性任务。 |
| `api-seed` | 同 `api` | 初始化管理员账号和 当前版本 种子数据 | 一次性任务，可幂等。 |
| `postgres` | 固定版本官方镜像或企业镜像 | 主业务数据库 | `postgres_data` volume。 |
| `redis` | 固定版本官方镜像或企业镜像 | BullMQ 队列 | `redis_data` volume，可按运维要求选择持久化策略。 |
| `minio` | 固定版本官方镜像或企业镜像 | Skill 包和资源对象存储 | `minio_data` volume。 |
| `minio-init` | MinIO client 镜像 | 创建 bucket 和基础 policy，至少包含 `skill-packages`、`skill-assets`、`client-updates` | 一次性任务，可幂等。 |
| `nginx` | 可选 | 内网反向代理与 TLS 终止 | 配置挂载。 |

第一阶段可以先不引入 Nginx，由 API 直接暴露内网端口；若企业内网要求统一 TLS、审计或域名，则启用 `nginx` 服务。

## 4. 一键脚本流程

`deploy/server-up.sh` 建议流程：

1. 检查 `docker` 是否存在。
2. 优先检查 `docker compose version`；不存在时检查旧版 `docker-compose --version`。
3. 检查 Docker daemon 是否可用。
4. 读取 `infra/env/server.env`，缺失则从 `server.env.example` 复制并提示填写。
5. 检查宿主机端口占用：API、PostgreSQL、Redis、MinIO、MinIO Console、Nginx。
6. 检查数据目录或 Docker volume 是否可写。
7. 如果配置了离线模式，执行 `load-offline-images.sh`。
8. 使用 `docker compose -f infra/docker-compose.prod.yml up -d postgres redis minio` 启动基础服务。
9. 等待 PostgreSQL、Redis、MinIO 健康检查通过。
10. 执行 `api-migrate`。
11. 执行 `minio-init`。
12. 执行 `api-seed`。
13. 启动 `api` 和可选 `nginx`。
14. 调用 `/health`，输出部署结果。

建议脚本只做编排，不在服务器上执行 `npm install`、`pnpm install` 或 `docker build`。

## 5. 低版本服务器兼容策略

### 5.1 优先策略：升级 Docker 而不是降级应用

如果宿主机系统仍在 Docker 官方支持范围内，优先安装或升级 Docker Engine 和 Compose v2 插件。

服务端应用镜像应该由 CI 构建，宿主机只运行镜像。这样低版本服务器不需要本机 Node.js、pnpm、NestJS CLI 或编译工具链。

### 5.2 保守兼容策略：legacy Compose

对无法升级到较新 Compose v2 的服务器，提供 `docker-compose.legacy.yml`：

- 避免 Compose `profiles`、`include`、复杂 `depends_on.condition` 等新特性。
- 使用显式启动顺序和脚本等待健康检查。
- 使用命名 volume，避免依赖宿主机特定目录权限。
- 所有镜像显式固定 tag，不使用 `latest`。
- 只使用 bridge network，不依赖 Swarm、Kubernetes 或 overlay network。

示例调用：

```bash
COMPOSE_IMPL=legacy ./deploy/server-up.sh
```

### 5.3 离线部署策略

低版本服务器常见于隔离内网，可能无法访问公网 registry。交付物需要包含：

```text
release/
├── images/
│   ├── enterprise-agent-hub-api.tar
│   ├── postgres.tar
│   ├── redis.tar
│   ├── minio.tar
│   └── nginx.tar
├── deploy/
├── infra/
└── checksums.txt
```

部署步骤：

1. 在可联网 CI 或构建机上构建并导出镜像。
2. 将 `release/` 拷贝到目标服务器。
3. 执行 `sha256sum -c checksums.txt` 校验镜像包。
4. 执行 `./deploy/load-offline-images.sh`。
5. 执行 `./deploy/server-up.sh`。

### 5.4 明确不兼容场景

以下情况不建议承诺一键部署：

- 服务器无法安装或启动 Docker Engine。
- 内核或 cgroups 能力过旧，容器无法稳定运行。
- 企业安全策略禁止容器创建 bridge network、volume 或监听端口。
- 服务器文件系统或安全软件阻止 Docker volume 正常读写。
- 只能使用极旧 Docker/Compose，且无法通过 legacy Compose 文件稳定运行健康检查和容器网络。

这些场景应作为部署前检查失败处理：脚本输出明确错误，不继续执行半部署。

## 6. 数据持久化与备份

推荐使用 Docker named volumes：

```text
postgres_data
redis_data
minio_data
```

备份建议：

- PostgreSQL：定时 `pg_dump` 或企业数据库备份方案。
- MinIO：按 bucket 增量备份对象数据，至少覆盖 `skill-packages` 和 `skill-assets`。
- Redis：当前版本 主要承载队列，必要时启用 AOF；若企业接受任务可重放，也可降低持久化级别。

一键部署脚本不应自动删除 volume。`server-down.sh` 默认只停止容器；清理数据必须通过显式危险命令，例如：

```bash
./deploy/server-down.sh --remove-data
```

且执行前二次确认。

## 7. 镜像构建建议

API 镜像：

- 使用多阶段构建。
- 在 CI 中完成依赖安装、构建和测试。
- runtime 镜像只包含 `dist`、生产依赖、迁移脚本和必要配置。
- 不在运行容器中写入源码目录。
- `NODE_ENV=production`。

版本策略：

- API 镜像 tag 使用应用版本或提交号，例如 `enterprise-agent-hub-api:1.0.0-p1.3`.
- PostgreSQL、Redis、MinIO 固定明确版本，不使用 `latest`。
- 低版本服务器优先使用 `linux/amd64` 单架构镜像，减少 manifest 解析和平台选择问题。

## 8. 健康检查与验收

部署成功标准：

- `docker ps` 中 `postgres`、`redis`、`minio`、`api` 状态为 healthy 或 running。
- `GET /health` 返回 API、PostgreSQL、Redis、MinIO 均可用。
- `api-migrate` 退出码为 0。
- `api-seed` 退出码为 0，重复执行不会创建重复数据。
- MinIO 中存在 `skill-packages`、`skill-assets` 和 `client-updates` bucket。
- Desktop 能通过内网 API 地址完成登录和 `/desktop/bootstrap`。

低版本服务器专项验收：

- 使用 `server-check.sh` 在部署前输出 Docker Engine、Compose 实现、内核版本、cgroups、端口、volume 写入检查结果。
- 若进入 legacy 模式，脚本输出当前使用的 Compose 文件和降级原因。
- 离线镜像导入后，所有镜像 tag 与 `checksums.txt` 匹配。

## 9. 与 当前版本 任务的关系

- 当前版本-T02 应落地本设计中的 `infra/docker-compose.prod.yml`、`server-up.sh`、`server-check.sh`、`server.env.example`。
- 当前版本-T03 的迁移和 seed 命令必须能以一次性容器方式运行。
- 当前版本-T10 的交付物必须包含在线部署和离线部署两种说明。
- 若目标服务器系统版本过低，当前版本 验收应先运行 `server-check.sh`，检查失败时不进入后续部署。
- 客户端在线升级的 Linux Docker 更新包推送流程见 [客户端在线升级详细设计](06_client_online_upgrade.md)，服务端部署脚本只负责基础服务启动，不在生产服务器构建客户端安装包。
