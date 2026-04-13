#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/env/server.env"
EXAMPLE_ENV_FILE="$ROOT_DIR/infra/env/server.env.example"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"

require_command() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Required command not found: $name" >&2
    exit 1
  fi
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local label="$3"
  local attempts="${4:-60}"
  for _ in $(seq 1 "$attempts"); do
    if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
      echo "PASS $label reachable at $host:$port"
      return 0
    fi
    sleep 2
  done
  echo "FAIL $label did not become reachable at $host:$port" >&2
  exit 1
}

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_ENV_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE from template. Review secrets before production use." >&2
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-enterprise-agent-hub}"

"$ROOT_DIR/deploy/server-check.sh"

if [[ "${COMPOSE_IMPL:-v2}" == "legacy" ]]; then
  require_command docker-compose
  COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.legacy.yml"
  COMPOSE=(docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  echo "INFO using legacy Compose file: $COMPOSE_FILE"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  echo "INFO using Docker Compose v2 file: $COMPOSE_FILE"
  echo "INFO compose project: $COMPOSE_PROJECT_NAME"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.legacy.yml"
  COMPOSE=(docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  echo "WARN falling back to legacy Compose file: $COMPOSE_FILE"
else
  echo "No Compose implementation available" >&2
  exit 1
fi

if [[ "${OFFLINE_MODE:-false}" == "true" ]]; then
  "$ROOT_DIR/deploy/load-offline-images.sh"
fi

"${COMPOSE[@]}" up -d postgres redis minio
wait_for_port 127.0.0.1 "${POSTGRES_PORT:-5432}" postgres
wait_for_port 127.0.0.1 "${REDIS_PORT:-6379}" redis
wait_for_port 127.0.0.1 "${MINIO_PORT:-9000}" minio

if [[ "${COMPOSE_IMPL:-v2}" == "legacy" ]]; then
  echo "INFO legacy mode: running one-shot migrate/minio-init/seed tasks explicitly"
  "${COMPOSE[@]}" run --rm api-migrate
  "${COMPOSE[@]}" run --rm minio-init
  "${COMPOSE[@]}" run --rm api-seed
  "${COMPOSE[@]}" up -d api
else
  "${COMPOSE[@]}" up api-migrate minio-init api-seed
  "${COMPOSE[@]}" up -d api
fi

HEALTH_URL="http://127.0.0.1:${API_PORT:-3000}/health"
for _ in {1..30}; do
  health_body="$(curl -fsS "$HEALTH_URL" 2>/dev/null || true)"
  if [[ "$health_body" == *'"status":"ok"'* || "$health_body" == *'"status": "ok"'* ]]; then
    printf '%s\n' "$health_body"
    echo
    echo "PASS API health: $HEALTH_URL"
    echo "INFO MinIO console: http://127.0.0.1:${MINIO_CONSOLE_PORT:-9001}"
    exit 0
  fi
  sleep 2
done

echo "FAIL API health did not become ready: $HEALTH_URL" >&2
exit 1
