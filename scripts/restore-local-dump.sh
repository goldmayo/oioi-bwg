#!/usr/bin/env sh
set -eu

dump_path=.local/oioibawige_20260829_030417.dump
target_database=oioibawige
if [ "$#" -gt 0 ] && [ "$1" != "--database" ]; then dump_path=$1; shift; fi
if [ "$#" -gt 0 ]; then
  if [ "$#" -ne 2 ] || [ "$1" != "--database" ]; then
    echo "Usage: restore-local-dump.sh [dump] [--database oioi_m7_test_...]" >&2; exit 1
  fi
  target_database=$2
  case "$target_database" in oioi_m7_test_*) ;; *) echo "Isolated database name required" >&2; exit 1 ;; esac
  case "$target_database" in *[!a-z0-9_]*) echo "Invalid isolated database name" >&2; exit 1 ;; esac
fi

if [ ! -f "$dump_path" ]; then
  echo "Local PostgreSQL dump not found: $dump_path" >&2
  exit 1
fi

echo "Restoring data-only dump into local Compose database $target_database: $dump_path"
dump_name=$(basename "$dump_path")
container_dump_path="/tmp/$dump_name"

legacy_columns=$(docker compose -f compose.dev.yml exec -T postgres psql -At \
  -U oioibawige -d "$target_database" \
  -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND column_name='id' AND ((table_name='Album' AND udt_name='int4') OR (table_name='Song' AND udt_name='int8'));" )
if [ "$legacy_columns" != "2" ]; then
  echo "Legacy integer dump requires a fresh target prepared with db:migrate --legacy-schema. UUID databases cannot be downgraded." >&2
  exit 1
fi

existing_rows=$(docker compose -f compose.dev.yml exec -T postgres psql -At \
  -U oioibawige -d "$target_database" \
  -c "SELECT (SELECT count(*) FROM \"Album\") || '|' || (SELECT count(*) FROM \"Song\");")

if [ "$existing_rows" != "0|0" ]; then
  echo "Local Album/Song tables are not empty ($existing_rows). Use a fresh isolated restore target; preserve the existing volume." >&2
  exit 1
fi

docker compose -f compose.dev.yml cp "$dump_path" "postgres:$container_dump_path"
trap 'docker compose -f compose.dev.yml exec -T postgres rm -f "$container_dump_path" >/dev/null 2>&1 || true' EXIT

docker compose -f compose.dev.yml exec -T postgres pg_restore \
  --exit-on-error \
  --single-transaction \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  -U oioibawige \
  -d "$target_database" \
  "$container_dump_path"

echo "Local PostgreSQL dump restore completed"
