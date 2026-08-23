#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

docker compose --env-file .env.production -f compose.production.yml pull api migrate
docker compose --env-file .env.production -f compose.production.yml up -d postgres
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml up -d --no-deps --wait api

echo "Deployed API latest"
