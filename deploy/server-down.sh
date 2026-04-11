#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/env/server.env"
COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.prod.yml"

if [[ "${COMPOSE_IMPL:-v2}" == "legacy" ]] || ! docker compose version >/dev/null 2>&1; then
  COMPOSE_FILE="$ROOT_DIR/infra/docker-compose.legacy.yml"
  COMPOSE=(docker-compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
else
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
fi

if [[ "${1:-}" == "--remove-data" ]]; then
  read -r -p "This removes PostgreSQL/Redis/MinIO named volumes. Type remove-data to continue: " confirmation
  if [[ "$confirmation" != "remove-data" ]]; then
    echo "Aborted."
    exit 1
  fi
  "${COMPOSE[@]}" down -v
else
  "${COMPOSE[@]}" down
fi
