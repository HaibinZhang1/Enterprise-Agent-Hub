#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/env/server.env"
EXAMPLE_ENV_FILE="$ROOT_DIR/infra/env/server.env.example"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f "$EXAMPLE_ENV_FILE" ]]; then
  echo "WARN: $ENV_FILE missing; using example defaults for checks" >&2
  set -a
  # shellcheck disable=SC1090
  source "$EXAMPLE_ENV_FILE"
  set +a
fi

check_cmd() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "PASS command:$name $(command -v "$name")"
  else
    echo "FAIL command:$name not found"
    return 1
  fi
}

check_cmd docker
if docker compose version >/dev/null 2>&1; then
  echo "PASS compose: docker compose $(docker compose version --short 2>/dev/null || true)"
elif command -v docker-compose >/dev/null 2>&1; then
  echo "WARN compose: legacy docker-compose $(docker-compose --version)"
else
  echo "FAIL compose: neither docker compose nor docker-compose is available"
  exit 1
fi

docker info >/dev/null 2>&1 && echo "PASS docker: daemon reachable" || { echo "FAIL docker: daemon unreachable"; exit 1; }

echo "INFO kernel: $(uname -a)"
if [[ -f /proc/self/cgroup ]]; then
  echo "INFO cgroup: $(head -n 1 /proc/self/cgroup)"
else
  echo "INFO cgroup: /proc/self/cgroup unavailable on this host"
fi

check_port() {
  local port="$1"
  local label="$2"
  if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "WARN port:$label:$port already in use"
  else
    echo "PASS port:$label:$port appears free"
  fi
}

check_port "${API_PORT:-3000}" api
check_port "${POSTGRES_PORT:-5432}" postgres
check_port "${REDIS_PORT:-6379}" redis
check_port "${MINIO_PORT:-9000}" minio
check_port "${MINIO_CONSOLE_PORT:-9001}" minio-console

TMP_VOLUME="eah_check_$(date +%s)"
docker volume create "$TMP_VOLUME" >/dev/null
docker volume rm "$TMP_VOLUME" >/dev/null
echo "PASS docker: named volume create/remove works"
