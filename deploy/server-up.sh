#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/env/server.env"
EXAMPLE_ENV_FILE="$ROOT_DIR/infra/env/server.env.example"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_ENV_FILE" "$ENV_FILE"
  echo "Created $ENV_FILE from template. Review secrets before production use." >&2
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

"$ROOT_DIR/deploy/server-check.sh"

if [[ "${COMPOSE_IMPL:-v2}" == "legacy" ]]; then
  COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.legacy.yml"
  COMPOSE=(docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  echo "INFO using legacy Compose file: $COMPOSE_FILE"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
  echo "INFO using Docker Compose v2 file: $COMPOSE_FILE"
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
if [[ "${COMPOSE_IMPL:-v2}" == "legacy" ]]; then
  echo "INFO legacy mode: start api after infrastructure; run migrations/seeds manually if your image does not do it on boot."
  "${COMPOSE[@]}" up -d api
else
  "${COMPOSE[@]}" up api-migrate minio-init api-seed
  "${COMPOSE[@]}" up -d api
fi

HEALTH_URL="http://127.0.0.1:${API_PORT:-3000}/health"
for _ in {1..30}; do
  if curl -fsS "$HEALTH_URL"; then
    echo
    echo "PASS API health: $HEALTH_URL"
    echo "INFO MinIO console: http://127.0.0.1:${MINIO_CONSOLE_PORT:-9001}"
    exit 0
  fi
  sleep 2
done

echo "FAIL API health did not become ready: $HEALTH_URL" >&2
exit 1
