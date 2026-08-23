#!/usr/bin/env bash

set -Eeuo pipefail

IMAGE_TAG=${1:?Usage: deploy-ec2.sh IMAGE_TAG AWS_REGION ECR_REGISTRY}
AWS_REGION=${2:?Usage: deploy-ec2.sh IMAGE_TAG AWS_REGION ECR_REGISTRY}
ECR_REGISTRY=${3:?Usage: deploy-ec2.sh IMAGE_TAG AWS_REGION ECR_REGISTRY}

if [[ ! "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "IMAGE_TAG must be a full Git commit SHA." >&2
  exit 2
fi

PROJECT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="$PROJECT_DIR/.env.production"
COMPOSE_FILE="$PROJECT_DIR/compose.production.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 2
fi

cd "$PROJECT_DIR"

old_api_tag=$(sed -n 's/^API_IMAGE_TAG=//p' "$ENV_FILE" | tail -n 1)
old_web_tag=$(sed -n 's/^WEB_IMAGE_TAG=//p' "$ENV_FILE" | tail -n 1)

if [[ -z "$old_api_tag" || -z "$old_web_tag" ]]; then
  echo "API_IMAGE_TAG and WEB_IMAGE_TAG must be set in $ENV_FILE" >&2
  exit 2
fi

persist_image_tags() {
  local api_tag=$1
  local web_tag=$2
  local temporary_file

  temporary_file=$(mktemp "$PROJECT_DIR/.env.production.XXXXXX")
  awk -v api_tag="$api_tag" -v web_tag="$web_tag" '
    /^API_IMAGE_TAG=/ { print "API_IMAGE_TAG=" api_tag; next }
    /^WEB_IMAGE_TAG=/ { print "WEB_IMAGE_TAG=" web_tag; next }
    { print }
  ' "$ENV_FILE" > "$temporary_file"
  chmod 600 "$temporary_file"
  mv "$temporary_file" "$ENV_FILE"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

rollback() {
  local exit_code=$?

  trap - ERR
  echo "Deployment failed; restoring images $old_api_tag and $old_web_tag." >&2
  export API_IMAGE_TAG="$old_api_tag"
  export WEB_IMAGE_TAG="$old_web_tag"
  compose pull api web migrate || true
  compose up -d --no-deps api web || true
  exit "$exit_code"
}

trap rollback ERR

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

export API_IMAGE_TAG="$IMAGE_TAG"
export WEB_IMAGE_TAG="$IMAGE_TAG"

compose pull api web migrate
compose up -d postgres
compose run --rm migrate
compose up -d --no-deps api
compose up -d --no-deps web
compose up -d --no-deps --wait api web

curl --fail --silent --show-error --retry 6 --retry-delay 5 \
  http://127.0.0.1:3001/api/v1/health >/dev/null
curl --fail --silent --show-error --retry 6 --retry-delay 5 \
  http://127.0.0.1:3000/ >/dev/null

persist_image_tags "$IMAGE_TAG" "$IMAGE_TAG"
trap - ERR

echo "Successfully deployed $IMAGE_TAG."
