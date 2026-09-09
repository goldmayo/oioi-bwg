#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

object_name="${1:-}"
config_file="${OIOI_DEPLOY_CONFIG:-/etc/oioibawige/deploy.conf}"
target_url="${M9_RESTORE_TARGET_URL:-}"
production_ack="I_UNDERSTAND_RESTORE_IS_DESTRUCTIVE"

[[ "${EUID}" == "0" ]] || { printf 'PostgreSQL restore requires root\n' >&2; exit 1; }
[[ "${object_name}" =~ ^postgres/[0-9]{4}/[0-9]{2}/[0-9]{2}/[A-Za-z0-9._-]+\.dump$ ]] || {
  printf 'A canonical postgres/YYYY/MM/DD/name.dump object name is required\n' >&2
  exit 1
}
[[ -n "${target_url}" ]] || { printf 'M9_RESTORE_TARGET_URL is required\n' >&2; exit 1; }
[[ "${target_url}" =~ ^postgres(ql)?:// ]] || { printf 'Restore URL must use PostgreSQL\n' >&2; exit 1; }

mapfile -d '' -t postgres_connection < <(
  printf '%s' "${target_url}" | python3 -c '
import sys
import urllib.parse

url = urllib.parse.urlparse(sys.stdin.read())
query = urllib.parse.parse_qs(url.query, keep_blank_values=True, strict_parsing=True)
if (
    url.scheme not in {"postgres", "postgresql"}
    or not url.hostname
    or url.username is None
    or not url.path.startswith("/")
    or len(url.path) == 1
    or set(query) - {"sslmode"}
    or len(query.get("sslmode", [""])) != 1
):
    raise SystemExit(1)
sslmode = query.get("sslmode", ["prefer"])[0] or "prefer"
if sslmode not in {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}:
    raise SystemExit(1)
values = (
    url.hostname,
    str(url.port or 5432),
    urllib.parse.unquote(url.path[1:]),
    urllib.parse.unquote(url.username),
    urllib.parse.unquote(url.password or ""),
    sslmode,
)
for value in values:
    sys.stdout.buffer.write(value.encode() + b"\0")
'
)
[[ "${#postgres_connection[@]}" -eq 6 ]] || { printf 'Restore URL could not be parsed safely\n' >&2; exit 1; }
parsed_host="${postgres_connection[0]}"
if [[ "${parsed_host}" != "localhost" && "${parsed_host}" != "127.0.0.1" && "${parsed_host}" != "::1" ]]; then
  if [[ "${2:-}" != "--allow-production-restore" || "${M9_PRODUCTION_RESTORE_ACK:-}" != "${production_ack}" ]]; then
    printf 'Remote restore requires --allow-production-restore and M9_PRODUCTION_RESTORE_ACK=%s\n' "${production_ack}" >&2
    exit 1
  fi
fi

# shellcheck disable=SC1090
[[ -f "${config_file}" ]] || { printf 'Restore configuration is missing\n' >&2; exit 1; }
if find "${config_file}" -maxdepth 0 \( ! -user root -o -perm /077 \) -print -quit | grep -q .; then
  printf 'Restore configuration must be root-owned mode 0600\n' >&2
  exit 1
fi
source "${config_file}"
: "${OCI_REGION:?OCI_REGION is required}"
: "${OBJECT_STORAGE_NAMESPACE:?OBJECT_STORAGE_NAMESPACE is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"

work_dir="$(mktemp -d)"
trap 'rm -rf -- "${work_dir}"' EXIT
dump_file="${work_dir}/restore.dump"

oci os object get \
  --auth instance_principal \
  --region "${OCI_REGION}" \
  --namespace-name "${OBJECT_STORAGE_NAMESPACE}" \
  --bucket-name "${BACKUP_BUCKET}" \
  --name "${object_name}" \
  --file "${dump_file}"
pg_restore --list "${dump_file}" >/dev/null

existing_objects="$(
  PGHOST="${postgres_connection[0]}" \
    PGPORT="${postgres_connection[1]}" \
    PGDATABASE="${postgres_connection[2]}" \
    PGUSER="${postgres_connection[3]}" \
    PGPASSWORD="${postgres_connection[4]}" \
    PGSSLMODE="${postgres_connection[5]}" \
    psql --tuples-only --no-align --command \
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');"
)"
[[ "${existing_objects}" == "0" ]] || { printf 'Restore target must be an empty database\n' >&2; exit 1; }

PGHOST="${postgres_connection[0]}" \
  PGPORT="${postgres_connection[1]}" \
  PGDATABASE="${postgres_connection[2]}" \
  PGUSER="${postgres_connection[3]}" \
  PGPASSWORD="${postgres_connection[4]}" \
  PGSSLMODE="${postgres_connection[5]}" \
  pg_restore \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-privileges \
  "${dump_file}"

restored_objects="$(
  PGHOST="${postgres_connection[0]}" \
    PGPORT="${postgres_connection[1]}" \
    PGDATABASE="${postgres_connection[2]}" \
    PGUSER="${postgres_connection[3]}" \
    PGPASSWORD="${postgres_connection[4]}" \
    PGSSLMODE="${postgres_connection[5]}" \
    psql --tuples-only --no-align --command \
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p');"
)"
[[ "${restored_objects}" -gt 0 ]] || { printf 'Restore completed without application tables\n' >&2; exit 1; }
printf '{"severity":"INFO","event":"postgres_restore_verified","object":"%s","tables":%s}\n' \
  "${object_name}" "${restored_objects}"
