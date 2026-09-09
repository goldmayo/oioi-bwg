#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

[[ "${EUID}" == "0" ]] || { printf 'PostgreSQL backup requires root\n' >&2; exit 1; }
runtime_root="${OIOI_RUNTIME_ROOT:-/srv/oioibawige}"
config_file="${OIOI_DEPLOY_CONFIG:-/etc/oioibawige/deploy.conf}"
application_env="${OIOI_APPLICATION_ENV:-${runtime_root}/app.env}"
work_dir=""

[[ -f "${config_file}" ]] || { printf 'Backup configuration is missing\n' >&2; exit 1; }
if find "${config_file}" -maxdepth 0 \( ! -user root -o -perm /077 \) -print -quit | grep -q .; then
  printf 'Backup configuration must be root-owned mode 0600\n' >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${config_file}"

required_config=(
  OCI_REGION OCI_METRIC_COMPARTMENT_OCID OCI_COMPUTE_INSTANCE_OCID
  OBJECT_STORAGE_NAMESPACE BACKUP_BUCKET DATABASE_NAME
)
for name in "${required_config[@]}"; do
  [[ -n "${!name:-}" ]] || { printf 'Missing backup configuration: %s\n' "${name}" >&2; exit 1; }
done
[[ -f "${application_env}" ]] || { printf 'Runtime environment is missing\n' >&2; exit 1; }
[[ "${DATABASE_NAME}" =~ ^[a-zA-Z0-9_-]+$ ]] || { printf 'Invalid database name\n' >&2; exit 1; }
if find "${application_env}" -maxdepth 0 \( ! -user root -o -perm /077 \) -print -quit | grep -q .; then
  printf 'Runtime environment must be root-owned mode 0600\n' >&2
  exit 1
fi

emit_metric() {
  local metric_name="$1"
  local metric_file
  metric_file="$(mktemp)"
  printf '[{"namespace":"oioi_operations","compartmentId":"%s","name":"%s","dimensions":{"resourceId":"%s"},"datapoints":[{"timestamp":"%s","value":1}]}]\n' \
    "${OCI_METRIC_COMPARTMENT_OCID}" "${metric_name}" "${OCI_COMPUTE_INSTANCE_OCID}" "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" \
    >"${metric_file}"
  if ! oci monitoring metric-data post \
    --auth instance_principal \
    --region "${OCI_REGION}" \
    --metric-data "file://${metric_file}" >/dev/null; then
    rm -f -- "${metric_file}"
    return 1
  fi
  rm -f -- "${metric_file}"
}

on_exit() {
  local status="$?"
  trap - EXIT
  [[ -z "${work_dir}" ]] || rm -rf -- "${work_dir}"
  if [[ "${status}" -ne 0 ]]; then
    emit_metric backup_failure || true
    printf '{"severity":"CRITICAL","event":"postgres_backup_failed"}\n' >&2
  fi
  exit "${status}"
}
trap on_exit EXIT

mkdir -p -- "${runtime_root}/deploy"
exec 9>"${runtime_root}/deploy/backup.lock"
flock -n 9

mapfile -t database_urls < <(sed -n 's/^DATABASE_URL=//p' "${application_env}")
[[ "${#database_urls[@]}" -eq 1 && "${database_urls[0]}" =~ ^postgres(ql)?:// ]] || {
  printf 'DATABASE_URL is missing, duplicated, or invalid\n' >&2
  exit 1
}
database_url="${database_urls[0]}"
mapfile -d '' -t postgres_connection < <(
  printf '%s' "${database_url}" | python3 -c '
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
[[ "${#postgres_connection[@]}" -eq 6 ]] || { printf 'DATABASE_URL could not be parsed safely\n' >&2; exit 1; }

work_dir="$(mktemp -d)"
dump_file="${work_dir}/oioibawige.dump"

PGHOST="${postgres_connection[0]}" \
  PGPORT="${postgres_connection[1]}" \
  PGDATABASE="${postgres_connection[2]}" \
  PGUSER="${postgres_connection[3]}" \
  PGPASSWORD="${postgres_connection[4]}" \
  PGSSLMODE="${postgres_connection[5]}" \
  pg_dump \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="${dump_file}"
pg_restore --list "${dump_file}" >/dev/null

object_name="postgres/$(date --utc +%Y/%m/%d)/${DATABASE_NAME}-$(date --utc +%Y%m%dT%H%M%SZ).dump"
oci os object put \
  --auth instance_principal \
  --region "${OCI_REGION}" \
  --namespace-name "${OBJECT_STORAGE_NAMESPACE}" \
  --bucket-name "${BACKUP_BUCKET}" \
  --name "${object_name}" \
  --file "${dump_file}" \
  --verify-checksum \
  --force >/dev/null

emit_metric backup_success
printf '{"severity":"INFO","event":"postgres_backup_succeeded","object":"%s"}\n' "${object_name}"
