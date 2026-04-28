#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPDATE_DATE="${UPDATE_DATE:-20260427}"
API_IMAGE="${API_IMAGE:-enterprise-agent-hub-api:${UPDATE_DATE}}"
PACKAGE_NAME="kylin-v10-x86_64-server-update-${UPDATE_DATE}"
PACKAGE_DIR="$ROOT_DIR/release/$PACKAGE_NAME"
SOURCE_BUNDLE_DIR="$ROOT_DIR/release/kylin-v10-x86_64-offline-bundle"
BASE_API_IMAGE="${BASE_API_IMAGE:-enterprise-agent-hub-api:0.1.0-p1}"
BASE_API_IMAGE_TAR="${BASE_API_IMAGE_TAR:-$SOURCE_BUNDLE_DIR/artifacts/images/enterprise-agent-hub-api_0.1.0-p1_linux-amd64.tar}"

require_command() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || {
    echo "[ERROR] Missing command: $name" >&2
    exit 1
  }
}

sanitize_image_name() {
  echo "$1" | sed 's#[/:]#_#g'
}

replace_token() {
  local input_file="$1"
  local output_file="$2"
  sed \
    -e "s|__UPDATE_DATE__|$UPDATE_DATE|g" \
    -e "s|__API_IMAGE__|$API_IMAGE|g" \
    "$input_file" >"$output_file"
}

assert_file() {
  local file="$1"
  [[ -f "$file" ]] || {
    echo "[ERROR] Required file not found: $file" >&2
    exit 1
  }
}

require_command docker
require_command git
require_command npm
require_command sed
require_command shasum

assert_file "$BASE_API_IMAGE_TAR"
assert_file "$SOURCE_BUNDLE_DIR/infra/docker-compose.yml"
assert_file "$SOURCE_BUNDLE_DIR/infra/env/server.env.example"
assert_file "$SOURCE_BUNDLE_DIR/infra/nginx/nginx.conf"
assert_file "$SOURCE_BUNDLE_DIR/deploy/lib/common.sh"

echo "[INFO] Building API workspace..."
npm run build --workspace @enterprise-agent-hub/api

assert_file "$ROOT_DIR/apps/api/dist/main.js"
assert_file "$ROOT_DIR/apps/api/dist/scripts/migrate.js"
assert_file "$ROOT_DIR/apps/api/dist/scripts/seed.js"
assert_file "$ROOT_DIR/apps/api/src/database/seeds/p1_seed.sql"
assert_file "$ROOT_DIR/apps/api/src/database/seeds/packages/codex-review-helper/1.2.0/package.zip"

migration_count="$(find "$ROOT_DIR/apps/api/src/database/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "$migration_count" -lt 1 ]]; then
  echo "[ERROR] No migration SQL files found" >&2
  exit 1
fi

echo "[INFO] Resetting update package directory: $PACKAGE_DIR"
rm -rf "$PACKAGE_DIR"
mkdir -p \
  "$PACKAGE_DIR/artifacts/images" \
  "$PACKAGE_DIR/deploy/lib" \
  "$PACKAGE_DIR/docs" \
  "$PACKAGE_DIR/infra/env" \
  "$PACKAGE_DIR/infra/nginx"

echo "[INFO] Loading previous API image as the offline build base: $BASE_API_IMAGE_TAR"
docker load -i "$BASE_API_IMAGE_TAR"

tmp_dockerfile="$(mktemp)"
cat >"$tmp_dockerfile" <<DOCKERFILE
FROM $BASE_API_IMAGE

ENV NODE_ENV=production

RUN if ! command -v curl >/dev/null 2>&1 || ! command -v zip >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then \
      apt-get update \
      && apt-get install -y --no-install-recommends curl zip unzip \
      && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app

COPY node_modules ./node_modules
COPY apps/api ./apps/api
COPY packages/shared-contracts ./packages/shared-contracts

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
DOCKERFILE

echo "[INFO] Building API image for linux/amd64: $API_IMAGE"
docker buildx build \
  --platform linux/amd64 \
  --tag "$API_IMAGE" \
  --load \
  -f "$tmp_dockerfile" \
  "$ROOT_DIR"
rm -f "$tmp_dockerfile"

api_tar="$PACKAGE_DIR/artifacts/images/$(sanitize_image_name "$API_IMAGE")_linux-amd64.tar"
echo "[INFO] Saving API image: $api_tar"
docker image save --platform linux/amd64 -o "$api_tar" "$API_IMAGE"
chmod 644 "$api_tar"

echo "[INFO] Copying minimal deployment assets..."
cp "$SOURCE_BUNDLE_DIR/deploy/lib/common.sh" "$PACKAGE_DIR/deploy/lib/common.sh"
cp "$SOURCE_BUNDLE_DIR/infra/nginx/nginx.conf" "$PACKAGE_DIR/infra/nginx/nginx.conf"
sed "s|enterprise-agent-hub-api:0.1.0-p1|$API_IMAGE|g" \
  "$SOURCE_BUNDLE_DIR/infra/docker-compose.yml" >"$PACKAGE_DIR/infra/docker-compose.yml"
sed "s|enterprise-agent-hub-api:0.1.0-p1|$API_IMAGE|g" \
  "$SOURCE_BUNDLE_DIR/infra/env/server.env.example" >"$PACKAGE_DIR/infra/env/server.env.example"

tmp_update="$(mktemp)"
cat >"$tmp_update" <<'UPDATE_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

API_IMAGE_TARGET="__API_IMAGE__"
EXPECTED_UPDATE_DATE="__UPDATE_DATE__"
CURRENT_LINK="${EAH_CURRENT_LINK:-/opt/enterprise-agent-hub/current}"

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

verify_checksums() {
  if [[ ! -f "$CHECKSUM_FILE" ]]; then
    warn "未找到 checksums.txt，跳过包完整性校验"
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && sha256sum -c checksums.txt)
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    (cd "$ROOT_DIR" && shasum -a 256 -c checksums.txt)
    return 0
  fi

  warn "未找到 sha256sum 或 shasum，跳过包完整性校验"
}

discover_previous_env_file() {
  local candidate
  local candidates=(
    "${EAH_PREVIOUS_ENV_FILE:-}"
    "$CURRENT_LINK/infra/env/server.env"
    "/opt/enterprise-agent-hub/kylin-v10-x86_64-offline-bundle/infra/env/server.env"
    "/opt/enterprise-agent-hub/infra/env/server.env"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -f "$candidate" && "$candidate" != "$ENV_FILE" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if command -v find >/dev/null 2>&1 && [[ -d /opt/enterprise-agent-hub ]]; then
    while IFS= read -r candidate; do
      [[ "$candidate" == "$ROOT_DIR/"* ]] && continue
      [[ "$candidate" == "$ENV_FILE" ]] && continue
      printf '%s\n' "$candidate"
      return 0
    done < <(find /opt/enterprise-agent-hub -maxdepth 5 -type f -path '*/infra/env/server.env' 2>/dev/null | sort)
  fi

  return 1
}

prepare_env_from_current() {
  local previous_env_file

  mkdir -p "$(dirname "$ENV_FILE")"

  if [[ -f "$ENV_FILE" ]]; then
    info "使用当前更新包内已有环境文件：$ENV_FILE"
  elif previous_env_file="$(discover_previous_env_file)"; then
    cp "$previous_env_file" "$ENV_FILE"
    info "已从上一版部署复制环境文件：$previous_env_file"
  else
    fail "未找到上一版环境文件。已检查 current 软链接、上次一键安装默认目录和 /opt/enterprise-agent-hub 下的离线包；如目录不同，请设置 EAH_PREVIOUS_ENV_FILE=/path/to/server.env 后重试"
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* || "$line" != *=* ]] && continue
    key="${line%%=*}"
    if ! grep -q "^${key}=" "$ENV_FILE"; then
      printf '%s\n' "$line" >>"$ENV_FILE"
      info "已补齐新增环境变量：$key"
    fi
  done <"$ENV_TEMPLATE"

  update_env_key API_IMAGE "$API_IMAGE_TARGET" "$ENV_FILE"
  info "已锁定 API_IMAGE=$API_IMAGE_TARGET"
}

load_api_image() {
  local image_tar="$ROOT_DIR/artifacts/images/enterprise-agent-hub-api_${EXPECTED_UPDATE_DATE}_linux-amd64.tar"
  [[ -f "$image_tar" ]] || fail "未找到 API 镜像 tar：$image_tar"
  info "导入 API 镜像：$(basename "$image_tar")"
  docker load -i "$image_tar"
}

backup_postgres() {
  local timestamp
  local backup_dir

  timestamp="$(date +%Y%m%d-%H%M%S)"
  backup_dir="$ROOT_DIR/backups/$timestamp"
  mkdir -p "$backup_dir"

  info "迁移前备份 PostgreSQL：$backup_dir/postgres.sql"
  if compose exec -T postgres pg_dump -U "${POSTGRES_USER:-eah}" "${POSTGRES_DB:-enterprise_agent_hub}" >"$backup_dir/postgres.sql"; then
    info "PostgreSQL 备份完成：$backup_dir/postgres.sql"
  else
    rm -f "$backup_dir/postgres.sql"
    fail "PostgreSQL 备份失败，已停止更新"
  fi
}

verify_database_schema() {
  info "验证数据库结构..."
  compose exec -T postgres psql -U "${POSTGRES_USER:-eah}" -d "${POSTGRES_DB:-enterprise_agent_hub}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.client_releases') IS NULL THEN
    RAISE EXCEPTION 'missing table: client_releases';
  END IF;
  IF to_regclass('public.client_release_artifacts') IS NULL THEN
    RAISE EXCEPTION 'missing table: client_release_artifacts';
  END IF;
  IF to_regclass('public.client_update_events') IS NULL THEN
    RAISE EXCEPTION 'missing table: client_update_events';
  END IF;
  IF to_regclass('public.client_update_download_tickets') IS NULL THEN
    RAISE EXCEPTION 'missing table: client_update_download_tickets';
  END IF;
  IF to_regclass('public.auth_password_change_challenges') IS NULL THEN
    RAISE EXCEPTION 'missing table: auth_password_change_challenges';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'review_items'
      AND column_name = 'claimed_from_workflow_state'
  ) THEN
    RAISE EXCEPTION 'missing column: review_items.claimed_from_workflow_state';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'action'
  ) THEN
    RAISE EXCEPTION 'missing column: notifications.action';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_must_change'
  ) THEN
    RAISE EXCEPTION 'missing column: users.password_must_change';
  END IF;
END $$;
SQL
  info "数据库结构验证通过"
}

verify_api_container_image() {
  local container_id
  local image_name

  container_id="$(service_container_id api)"
  [[ -n "$container_id" ]] || fail "未找到 api 容器"

  image_name="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
  [[ "$image_name" == "$API_IMAGE_TARGET" ]] || fail "api 容器镜像不符合预期：$image_name，期望：$API_IMAGE_TARGET"
  info "api 容器镜像验证通过：$image_name"
}

switch_current_link() {
  if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
    warn "$CURRENT_LINK 已存在且不是软链接，已跳过 current 切换"
    return 0
  fi

  mkdir -p "$(dirname "$CURRENT_LINK")"
  ln -sfn "$ROOT_DIR" "$CURRENT_LINK"
  info "已切换 current 软链接：$CURRENT_LINK -> $ROOT_DIR"
}

require_command docker
require_command curl

verify_checksums
prepare_env_from_current
load_env

docker info >/dev/null 2>&1 || fail "Docker daemon 不可用"

load_api_image

compose up -d postgres redis minio
wait_for_service_health postgres 60 2
wait_for_service_health redis 60 2
wait_for_service_health minio 60 2

backup_postgres

compose run --rm api-migrate
compose run --rm minio-init
compose run --rm api-seed
verify_database_schema

compose up -d --force-recreate api nginx
wait_for_service_health api 60 2
wait_for_http "http://127.0.0.1:${NGINX_PORT:-8081}/health" "nginx health" 60 2
verify_api_container_image

switch_current_link

compose ps
info "服务端更新完成：$API_IMAGE_TARGET"
info "访问地址：${SERVER_PUBLIC_BASE_URL:-http://<server>:${NGINX_PORT:-8081}}"
UPDATE_SCRIPT
replace_token "$tmp_update" "$PACKAGE_DIR/deploy/update.sh"
rm -f "$tmp_update"
chmod +x "$PACKAGE_DIR/deploy/update.sh"

cat >"$PACKAGE_DIR/deploy/server-status.sh" <<'STATUS_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"

ensure_env_file
load_env

require_command docker
compose ps
echo
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${NGINX_PORT:-8081}/health" || true
else
  echo "curl 未安装，已跳过 HTTP 健康检查；如需查看端口可执行：echo >/dev/tcp/127.0.0.1/${NGINX_PORT:-8081}"
fi
echo
STATUS_SCRIPT
chmod +x "$PACKAGE_DIR/deploy/server-status.sh"

tmp_doc="$(mktemp)"
cat >"$tmp_doc" <<'DOC'
# EnterpriseAgentHub 服务端一键更新说明（__UPDATE_DATE__）

本目录是面向已完成上次完整离线部署环境的增量更新包，只包含服务端本次需要更新的内容。

## 更新内容

- API 镜像：`__API_IMAGE__`
- 复用上次部署的 PostgreSQL、Redis、MinIO、Nginx 基础镜像和 Docker/Compose 运行环境。
- 复用 `COMPOSE_PROJECT_NAME=enterprise-agent-hub` 对应的数据卷，不清空业务数据。
- 迁移脚本会执行镜像内全部 SQL 迁移，当前覆盖 `001` 到 `009`。

## 上传位置建议

```bash
scp -r ./kylin-v10-x86_64-server-update-__UPDATE_DATE__ \
  <user>@<server>:/opt/enterprise-agent-hub/releases/__UPDATE_DATE__/
```

## 一键更新

```bash
cd /opt/enterprise-agent-hub/releases/__UPDATE_DATE__/kylin-v10-x86_64-server-update-__UPDATE_DATE__
sudo ./deploy/update.sh
```

脚本会自动完成：

1. 校验更新包完整性。
2. 自动查找并复制旧环境配置：优先使用 `EAH_PREVIOUS_ENV_FILE`，其次使用 `/opt/enterprise-agent-hub/current/infra/env/server.env`，再兼容上次一键安装默认目录 `/opt/enterprise-agent-hub/kylin-v10-x86_64-offline-bundle/infra/env/server.env` 和 `/opt/enterprise-agent-hub/infra/env/server.env`。
3. 补齐新增环境变量，并将 `API_IMAGE` 锁定为 `__API_IMAGE__`。
4. 导入本次 API 镜像。
5. 启动依赖服务。
6. 迁移前备份 PostgreSQL 到 `backups/<timestamp>/postgres.sql`。
7. 执行数据库迁移、MinIO bucket 初始化和 seed 修复。
8. 验证新增表和新增列。
9. 重建 API 和 nginx，健康检查通过后切换 `/opt/enterprise-agent-hub/current` 软链接。

## 更新后检查

```bash
./deploy/server-status.sh
curl -fsS http://127.0.0.1:8081/health
docker compose --env-file infra/env/server.env -f infra/docker-compose.yml ps
```

确认 API 容器镜像：

```bash
docker inspect --format '{{.Config.Image}}' \
  "$(docker compose --env-file infra/env/server.env -f infra/docker-compose.yml ps -q api)"
```

预期输出：

```text
__API_IMAGE__
```

## 回滚

如果更新失败且迁移尚未成功，脚本会在切换 `current` 之前停止，可继续排查后重跑。

如果迁移已经执行并需要回滚，不能只切回旧镜像。请按以下顺序处理：

1. 停止当前服务。
2. 使用本次更新前自动生成的 `backups/<timestamp>/postgres.sql` 恢复 PostgreSQL。
3. 切回上一版离线包目录。
4. 执行上一版 `deploy/update.sh` 或 `deploy/server-up.sh`。

## 注意事项

- 不要在内网服务器上执行 `npm install` 或 `docker build`。
- 不要手动修改容器内文件。
- 如果上次部署目录不在默认位置，可执行 `sudo EAH_PREVIOUS_ENV_FILE=/path/to/server.env ./deploy/update.sh`。
- 如果服务器的 `/opt/enterprise-agent-hub/current` 不是软链接，脚本会跳过 current 切换并输出警告。
DOC
replace_token "$tmp_doc" "$PACKAGE_DIR/docs/更新说明.md"
rm -f "$tmp_doc"

git_commit="$(git -C "$ROOT_DIR" rev-parse HEAD)"
generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  printf '{\n'
  printf '  "versionDate": "%s",\n' "$UPDATE_DATE"
  printf '  "packageName": "%s",\n' "$PACKAGE_NAME"
  printf '  "apiImage": "%s",\n' "$API_IMAGE"
  printf '  "gitCommit": "%s",\n' "$git_commit"
  printf '  "generatedAt": "%s",\n' "$generated_at"
  printf '  "migrations": [\n'
  index=0
  total="$migration_count"
  while IFS= read -r migration; do
    index=$((index + 1))
    comma=","
    [[ "$index" -eq "$total" ]] && comma=""
    printf '    "%s"%s\n' "$(basename "$migration")" "$comma"
  done < <(find "$ROOT_DIR/apps/api/src/database/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
  printf '  ]\n'
  printf '}\n'
} >"$PACKAGE_DIR/VERSION.json"

echo "[INFO] Refreshing checksums..."
(
  cd "$PACKAGE_DIR"
  {
    find artifacts deploy infra docs -type f
    printf '%s\n' VERSION.json
  } | sort | xargs shasum -a 256 > checksums.txt
)

echo "[INFO] Update package ready: $PACKAGE_DIR"
