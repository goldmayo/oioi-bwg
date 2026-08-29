#!/usr/bin/env sh
set -eu

dump_path=${1:-.local/oioibawige_20260829_030417.dump}

if [ ! -f "$dump_path" ]; then
  echo "Local PostgreSQL dump not found: $dump_path" >&2
  exit 1
fi

echo "Restoring data-only dump into the local Compose PostgreSQL service: $dump_path"
dump_name=$(basename "$dump_path")
container_dump_path="/tmp/$dump_name"

existing_rows=$(docker compose -f compose.dev.yml exec -T postgres psql -At \
  -U oioibawige -d oioibawige \
  -c "SELECT (SELECT count(*) FROM \"Album\") || '|' || (SELECT count(*) FROM \"Song\");")

if [ "$existing_rows" != "0|0" ]; then
  echo "Local Album/Song tables are not empty ($existing_rows). Reset the local volume before restoring a dump." >&2
  exit 1
fi

docker compose -f compose.dev.yml cp "$dump_path" "postgres:$container_dump_path"
trap 'docker compose -f compose.dev.yml exec -T postgres rm -f "$container_dump_path" >/dev/null 2>&1 || true' EXIT

docker compose -f compose.dev.yml exec -T postgres pg_restore \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  -U oioibawige \
  -d oioibawige \
  "$container_dump_path"

echo "Local PostgreSQL dump restore completed"
