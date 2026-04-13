#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${P1_ENV_FILE:-$ROOT_DIR/infra/env/server.env}"
EXAMPLE_ENV_FILE="$ROOT_DIR/infra/env/server.env.example"
API_LOG_FILE="${P1_API_LOG_FILE:-$ROOT_DIR/.omx/logs/p1-live-smoke-api.log}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f "$EXAMPLE_ENV_FILE" ]]; then
  echo "WARN: $ENV_FILE missing; using example defaults" >&2
  set -a
  # shellcheck disable=SC1090
  source "$EXAMPLE_ENV_FILE"
  set +a
else
  echo "ERROR: no server env file found" >&2
  exit 1
fi

mkdir -p "$(dirname "$API_LOG_FILE")"

check_cmd() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $name" >&2
    exit 1
  }
}

retry_cmd() {
  local attempts="$1"
  shift
  local try=1
  until "$@"; do
    if (( try >= attempts )); then
      return 1
    fi
    echo "WARN: attempt $try failed for: $*" >&2
    sleep 2
    try=$((try + 1))
  done
}

check_cmd docker
check_cmd npm
check_cmd node

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose -f "$ROOT_DIR/infra/docker-compose.prod.yml")
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose -f "$ROOT_DIR/infra/docker-compose.prod.yml")
else
  echo "ERROR: neither docker compose nor docker-compose is available" >&2
  exit 1
fi

"${COMPOSE[@]}" up -d postgres redis minio
"${COMPOSE[@]}" up minio-init

export API_PORT="${API_PORT:-3000}"
export DATABASE_URL="${P1_HOST_DATABASE_URL:-postgresql://${POSTGRES_USER:-eah}:${POSTGRES_PASSWORD:-change-me}@127.0.0.1:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-enterprise_agent_hub}}"
export REDIS_URL="${P1_HOST_REDIS_URL:-redis://127.0.0.1:${REDIS_PORT:-6379}/0}"
export MINIO_ENDPOINT="${P1_HOST_MINIO_ENDPOINT:-127.0.0.1}"
export MINIO_PORT="${P1_HOST_MINIO_PORT:-${MINIO_PORT:-9000}}"
export MINIO_USE_SSL="${P1_HOST_MINIO_USE_SSL:-false}"
export MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
export MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-change-me-minio-secret}"
export MINIO_SKILL_PACKAGE_BUCKET="${MINIO_SKILL_PACKAGE_BUCKET:-skill-packages}"
export MINIO_SKILL_ASSET_BUCKET="${MINIO_SKILL_ASSET_BUCKET:-skill-assets}"
export P1_LIVE_BASE_URL="${P1_LIVE_BASE_URL:-http://127.0.0.1:${API_PORT}}"

retry_cmd 15 npm run migrate:dev --workspace @enterprise-agent-hub/api
retry_cmd 15 npm run seed:dev --workspace @enterprise-agent-hub/api

npm run start:dev --workspace @enterprise-agent-hub/api >"$API_LOG_FILE" 2>&1 &
API_PID=$!

cleanup() {
  if kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
    wait "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

retry_cmd 20 node -e "fetch(process.env.P1_LIVE_BASE_URL + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
node "$ROOT_DIR/scripts/verification/p1-live-smoke.mjs"

echo "P1 source-start live smoke completed. API log: $API_LOG_FILE"
