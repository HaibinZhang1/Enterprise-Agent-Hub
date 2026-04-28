#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/infra/env/server.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

IMAGE_DIR="$ROOT_DIR/${OFFLINE_IMAGE_DIR:-release/images}"
if [[ ! -d "$IMAGE_DIR" ]]; then
  echo "Offline image directory not found: $IMAGE_DIR" >&2
  exit 1
fi

for image in "$IMAGE_DIR"/*.tar; do
  [[ -e "$image" ]] || { echo "No .tar images found in $IMAGE_DIR" >&2; exit 1; }
  echo "Loading $image"
  docker load -i "$image"
done
