#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI was not found."
  echo "Install and start Docker Desktop, then make sure 'docker --version' works."
  exit 127
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 was not found."
  echo "Update Docker Desktop or install the Docker Compose plugin."
  exit 127
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

compose_project_name="${COMPOSE_PROJECT_NAME:-gas-detection}"
export COMPOSE_BAKE="${COMPOSE_BAKE:-false}"

for service in api admin-web screen-web simulator; do
  docker compose -p "$compose_project_name" --progress plain build "$service"
done

docker compose -p "$compose_project_name" up -d
docker compose -p "$compose_project_name" ps

cat <<'URLS'

Swagger:    http://localhost:3000/api/docs
API:        http://localhost:3000/api/v1
Admin Web:  http://localhost:8080
Screen Web: http://localhost:8081
URLS
