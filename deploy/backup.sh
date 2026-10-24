#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
test -f .env || { echo 'Missing .env' >&2; exit 1; }
set -a
. ./.env
set +a
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker run --rm -e DATABASE_URL="${DATABASE_URL}" postgres:18-alpine sh -c 'pg_dump --format=custom "$DATABASE_URL"' > "backups/cvrde-${stamp}.dump"
docker compose --env-file .env -f deploy/docker-compose.yml run --rm --no-deps -v "$(pwd)/backups:/backup" --entrypoint sh api -c "tar -czf /backup/uploads-${stamp}.tar.gz -C /data/uploads ."
echo "Wrote backups/cvrde-${stamp}.dump and backups/uploads-${stamp}.tar.gz"
