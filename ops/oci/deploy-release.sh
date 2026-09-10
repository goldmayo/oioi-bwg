#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

target_digest="${1:-}"
runtime_root="${OIOI_RUNTIME_ROOT:-/srv/oioibawige}"
config_root="${OIOI_CONFIG_ROOT:-/etc/oioibawige}"
compose_file="${OIOI_COMPOSE_FILE:-${runtime_root}/compose.oci-development.yml}"
config_file="${OIOI_DEPLOY_CONFIG:-${config_root}/deploy.conf}"
public_env_file="${OIOI_PUBLIC_ENV_FILE:-${config_root}/runtime-public.env}"
secret_map_file="${OIOI_SECRET_MAP_FILE:-${config_root}/runtime-secrets.env}"
application_env="${OIOI_APPLICATION_ENV:-${runtime_root}/app.env}"
state_dir="${OIOI_STATE_DIR:-${runtime_root}/deploy}"
deployment_id="${OCI_DEPLOYMENT_ID:-manual}"

candidate_env=""
rollback_env=""

cleanup() {
  [[ -z "${candidate_env}" ]] || rm -f -- "${candidate_env}"
  [[ -z "${rollback_env}" ]] || rm -f -- "${rollback_env}"
}
trap cleanup EXIT

log_event() {
  local severity="$1"
  local event="$2"
  local digest="${3:-none}"
  printf '{"severity":"%s","event":"%s","digest":"%s","deployment":"%s"}\n' \
    "${severity}" "${event}" "${digest}" "${deployment_id}"
}

fail() {
  log_event CRITICAL "$1" "${target_digest:-none}" >&2
  exit 1
}

[[ "$#" -eq 1 ]] || fail exactly_one_digest_required
[[ "${M9_DEPLOY_TEST_MODE:-0}" == "1" || "${EUID}" == "0" ]] || fail root_required
[[ "${target_digest}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail invalid_image_digest
if [[ ! "${deployment_id}" =~ ^[A-Za-z0-9._:-]{1,200}$ ]]; then
  deployment_id="invalid"
  fail invalid_deployment_id
fi

for required_file in "${config_file}" "${public_env_file}" "${secret_map_file}" "${compose_file}"; do
  [[ -f "${required_file}" ]] || fail required_file_missing
done

if find \
  "${config_file}" \
  "${public_env_file}" \
  "${secret_map_file}" \
  "${compose_file}" \
  -maxdepth 0 -perm /022 -print -quit | grep -q .; then
  fail insecure_configuration_permissions
fi
if [[ "${M9_DEPLOY_TEST_MODE:-0}" != "1" ]] && find \
  "${config_file}" \
  "${public_env_file}" \
  "${secret_map_file}" \
  "${compose_file}" \
  -maxdepth 0 ! -user root -print -quit | grep -q .; then
  fail invalid_configuration_owner
fi

# The file is root-owned operational configuration, never application input.
# shellcheck disable=SC1090
source "${config_file}"

required_config=(
  IMAGE_REPOSITORY POSTGRES_NETWORK DATABASE_HOST DATABASE_PORT DATABASE_NAME DATABASE_USER
  APP_BIND_ADDRESS APP_PORT SMOKE_PATHS REQUIRED_RUNTIME_KEYS
)
for name in "${required_config[@]}"; do
  [[ -n "${!name:-}" ]] || fail "missing_config_${name}"
done
[[ "${IMAGE_REPOSITORY}" =~ ^[a-z0-9.-]+/[a-z0-9._/-]+$ ]] || fail invalid_image_repository
[[ "${DATABASE_HOST}" =~ ^[a-zA-Z0-9.-]+$ ]] || fail invalid_database_host
[[ "${DATABASE_PORT}" =~ ^[0-9]{1,5}$ ]] || fail invalid_database_port
[[ "${DATABASE_NAME}" =~ ^[a-zA-Z0-9_-]+$ ]] || fail invalid_database_name
[[ "${DATABASE_USER}" == "oioi_app" ]] || fail invalid_database_user

mkdir -p -- "${state_dir}" "$(dirname "${application_env}")"
exec 9>"${state_dir}/deployment.lock"
flock -n 9 || fail deployment_already_running

image_reference="${IMAGE_REPOSITORY}@${target_digest}"
current_digest=""
if [[ -f "${state_dir}/current" ]]; then
  current_digest="$(<"${state_dir}/current")"
  [[ "${current_digest}" =~ ^sha256:[0-9a-f]{64}$ ]] || fail invalid_current_release_state
fi

append_public_environment() {
  local line
  local name
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    [[ "${line}" =~ ^[A-Z][A-Z0-9_]*=.*$ ]] || return 1
    name="${line%%=*}"
    [[ "${name}" != "DATABASE_URL" && "${name}" != "DB_APP_PASSWORD" ]] || return 1
    ! grep -q "^${name}=" "${candidate_env}" || return 1
    printf '%s\n' "${line}" >>"${candidate_env}"
  done <"${public_env_file}"
}

fetch_runtime_secrets() {
  local encoded_content
  local name
  local secret_file
  local secret_id
  local value
  local db_app_password=""

  append_public_environment || return 1
  while IFS='=' read -r name secret_id || [[ -n "${name}${secret_id}" ]]; do
    [[ -z "${name}" || "${name}" == \#* ]] && continue
    [[ "${name}" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
    [[ "${secret_id}" =~ ^ocid1\.vaultsecret\.[a-z0-9.-]+$ ]] || return 1
    ! grep -q "^${name}=" "${candidate_env}" || return 1

    encoded_content="$(
      oci secrets secret-bundle get \
        --auth instance_principal \
        --secret-id "${secret_id}" \
        --stage CURRENT \
        --query 'data."secret-bundle-content".content' \
        --raw-output
    )" || return 1
    secret_file="$(mktemp "${state_dir}/secret.XXXXXX")" || return 1
    printf '%s' "${encoded_content}" | base64 --decode >"${secret_file}" || return 1
    if ! cmp -s "${secret_file}" <(tr -d '\r\n' <"${secret_file}"); then
      rm -f -- "${secret_file}"
      return 1
    fi
    value="$(<"${secret_file}")"
    rm -f -- "${secret_file}"
    [[ -n "${value}" ]] || return 1

    if [[ "${name}" == "DB_APP_PASSWORD" ]]; then
      db_app_password="${value}"
    else
      printf '%s=%s\n' "${name}" "${value}" >>"${candidate_env}"
    fi
  done <"${secret_map_file}"

  [[ -n "${db_app_password}" ]] || return 1
  local encoded_password
  encoded_password="$(printf '%s' "${db_app_password}" | python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=""))')"
  printf 'DATABASE_URL=postgresql://%s:%s@%s:%s/%s\n' \
    "${DATABASE_USER}" "${encoded_password}" "${DATABASE_HOST}" "${DATABASE_PORT}" "${DATABASE_NAME}" \
    >>"${candidate_env}"

  local required_key
  for required_key in ${REQUIRED_RUNTIME_KEYS}; do
    [[ "${required_key}" =~ ^[A-Z][A-Z0-9_]*$ ]] || return 1
    grep -Eq "^${required_key}=.+" "${candidate_env}" || return 1
  done
  chmod 0600 "${candidate_env}"
}

compose_apply() {
  local digest="$1"
  APP_IMAGE="${IMAGE_REPOSITORY}@${digest}" \
    POSTGRES_NETWORK="${POSTGRES_NETWORK}" \
    APP_ENV_FILE="${application_env}" \
    APP_BIND_ADDRESS="${APP_BIND_ADDRESS}" \
    APP_PORT="${APP_PORT}" \
    docker compose -f "${compose_file}" up -d --wait app
}

verify_release() {
  local path
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null
  curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:${APP_PORT}/readyz" >/dev/null
  for path in ${SMOKE_PATHS}; do
    [[ "${path}" == /* ]] || return 1
    curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${APP_PORT}${path}" >/dev/null
  done
}

atomic_state_write() {
  local path="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp "${path}.XXXXXX")"
  printf '%s\n' "${value}" >"${temporary}"
  chmod 0600 "${temporary}"
  mv -f -- "${temporary}" "${path}"
}

candidate_env="$(mktemp "$(dirname "${application_env}")/.app.env.XXXXXX")"
if ! fetch_runtime_secrets; then
  fail vault_secret_materialization_failed
fi

if ! docker pull "${image_reference}"; then
  fail ocir_pull_failed
fi

APP_IMAGE="${image_reference}" \
  POSTGRES_NETWORK="${POSTGRES_NETWORK}" \
  APP_ENV_FILE="${candidate_env}" \
  APP_BIND_ADDRESS="${APP_BIND_ADDRESS}" \
  APP_PORT="${APP_PORT}" \
  docker compose -f "${compose_file}" config --quiet || fail compose_validation_failed

if [[ -f "${application_env}" ]]; then
  rollback_env="$(mktemp "${state_dir}/app.env.rollback.XXXXXX")"
  cp -- "${application_env}" "${rollback_env}"
  chmod 0600 "${rollback_env}"
fi
mv -f -- "${candidate_env}" "${application_env}"
candidate_env=""

if compose_apply "${target_digest}" && verify_release; then
  if [[ -n "${current_digest}" && "${current_digest}" != "${target_digest}" ]]; then
    atomic_state_write "${state_dir}/previous" "${current_digest}"
  fi
  atomic_state_write "${state_dir}/current" "${target_digest}"
  log_event INFO deployment_succeeded "${target_digest}"
  exit 0
fi

log_event WARNING candidate_failed "${target_digest}" >&2
if [[ -z "${current_digest}" || -z "${rollback_env}" ]]; then
  fail rollback_unavailable
fi

env_restore="$(mktemp "$(dirname "${application_env}")/.app.env.restore.XXXXXX")"
cp -- "${rollback_env}" "${env_restore}"
chmod 0600 "${env_restore}"
mv -f -- "${env_restore}" "${application_env}"

if compose_apply "${current_digest}" && verify_release; then
  log_event WARNING rollback_succeeded "${current_digest}" >&2
  exit 20
fi

log_event CRITICAL rollback_failed "${current_digest}" >&2
exit 21
