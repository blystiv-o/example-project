#!/usr/bin/env bash

set -euo pipefail

AWS_REGION=${1:?Pass AWS region}
ECR_REGISTRY=${2:?Pass ECR registry}

cd "$(dirname "$0")/.."

aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose --env-file .env.production -f compose.production.yml pull api migrate
docker compose --env-file .env.production -f compose.production.yml up -d postgres
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d --no-deps --wait api

echo "Deployed API latest"
