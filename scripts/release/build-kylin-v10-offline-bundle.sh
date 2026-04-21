#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE_DIR="$ROOT_DIR/release/kylin-v10-x86_64-offline-bundle"
DOCKER_VERSION="29.4.1"
COMPOSE_PLUGIN_VERSION="5.1.2"
API_IMAGE="enterprise-agent-hub-api:0.1.0-p1"
API_DOCKERFILE="$ROOT_DIR/scripts/release/Dockerfile.api-offline-bundle"

DOCKER_ARCHIVE_URL="https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz"
COMPOSE_PLUGIN_RPM="docker-compose-plugin-${COMPOSE_PLUGIN_VERSION}-1.el9.x86_64.rpm"
COMPOSE_PLUGIN_URL="https://download.docker.com/linux/rhel/9/x86_64/stable/Packages/${COMPOSE_PLUGIN_RPM}"

BASE_IMAGES=(
  "postgres:16.6-bookworm"
  "redis:7.4.1-bookworm"
  "minio/minio:RELEASE.2024-12-18T13-15-44Z"
  "minio/mc:RELEASE.2024-11-21T17-21-54Z"
  "nginx:1.27.3-bookworm"
)

require_command() {
  local name="$1"
  command -v "$name" >/dev/null 2>&1 || {
    echo "Missing command: $name" >&2
    exit 1
  }
}

sanitize_image_name() {
  echo "$1" | sed 's#[/:]#_#g'
}

require_command curl
require_command docker
require_command shasum
require_command bsdtar

mkdir -p "$BUNDLE_DIR/artifacts/docker" "$BUNDLE_DIR/artifacts/images"

docker_pull_retry() {
  local image="$1"
  for attempt in 1 2 3; do
    echo "[INFO] Pulling $image for linux/amd64 (attempt $attempt)..."
    if docker pull --platform linux/amd64 "$image"; then
      return 0
    fi
    sleep 3
  done
  echo "[ERROR] Failed to pull $image" >&2
  exit 1
}

if [[ ! -s "$BUNDLE_DIR/artifacts/docker/docker-${DOCKER_VERSION}.tgz" ]]; then
  echo "[INFO] Downloading Docker static binaries..."
  curl --http1.1 --retry 10 --retry-delay 2 --retry-all-errors -fL "$DOCKER_ARCHIVE_URL" -o "$BUNDLE_DIR/artifacts/docker/docker-${DOCKER_VERSION}.tgz"
else
  echo "[INFO] Reusing existing Docker static binaries..."
fi

if [[ ! -s "$BUNDLE_DIR/artifacts/docker/docker-compose-linux-x86_64" ]]; then
  echo "[INFO] Downloading Docker Compose plugin..."
  tmp_compose_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_compose_dir"' EXIT
  curl --http1.1 --retry 10 --retry-delay 2 --retry-all-errors -fL "$COMPOSE_PLUGIN_URL" -o "$tmp_compose_dir/$COMPOSE_PLUGIN_RPM"
  (
    cd "$tmp_compose_dir"
    bsdtar -xf "$tmp_compose_dir/$COMPOSE_PLUGIN_RPM"
  )
  cp "$tmp_compose_dir/usr/libexec/docker/cli-plugins/docker-compose" "$BUNDLE_DIR/artifacts/docker/docker-compose-linux-x86_64"
  chmod +x "$BUNDLE_DIR/artifacts/docker/docker-compose-linux-x86_64"
else
  echo "[INFO] Reusing existing Docker Compose plugin..."
fi

echo "[INFO] Building API image for linux/amd64..."
docker buildx build \
  --platform linux/amd64 \
  --tag "$API_IMAGE" \
  --load \
  -f "$API_DOCKERFILE" \
  "$ROOT_DIR"

echo "[INFO] Saving API image..."
docker image save --platform linux/amd64 -o "$BUNDLE_DIR/artifacts/images/$(sanitize_image_name "$API_IMAGE")_linux-amd64.tar" "$API_IMAGE"

for image in "${BASE_IMAGES[@]}"; do
  docker_pull_retry "$image"
  echo "[INFO] Saving $image..."
  docker image save --platform linux/amd64 -o "$BUNDLE_DIR/artifacts/images/$(sanitize_image_name "$image")_linux-amd64.tar" "$image"
done

echo "[INFO] Refreshing checksums..."
(
  cd "$BUNDLE_DIR"
  find artifacts -type f | sort | xargs shasum -a 256 > checksums.txt
)

echo "[INFO] Offline bundle ready: $BUNDLE_DIR"
