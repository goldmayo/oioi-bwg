#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ "$#" -eq 3 ]] || fail paired_digests_and_candidate_required
[[ "${M9_DEPLOY_TEST_MODE:-0}" == 1 || "${EUID}" == 0 ]] || fail root_required
[[ "$1" =~ ^sha256:[0-9a-f]{64}$ && "$2" =~ ^sha256:[0-9a-f]{64}$ ]] || fail invalid_digest
[[ ${#3} -le 16000 && "$3" =~ ^[A-Za-z0-9_-]+$ ]] || fail invalid_candidate_payload
runtime_root="${OIOI_RUNTIME_ROOT:-/srv/oioibawige}"
config_root="${OIOI_CONFIG_ROOT:-/etc/oioibawige}"
state_dir="${OIOI_STATE_DIR:-${runtime_root}/deploy}"
compose_file="${OIOI_COMPOSE_FILE:-${runtime_root}/compose.oci-development.yml}"
helper_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
protected=("${config_root}/deploy.conf" "${compose_file}" "${BASH_SOURCE[0]}"
  "${helper_root}/paired-release.py" "${helper_root}/materialize-runtime-env.py")
for app in runtime console-runtime; do
  protected+=("${config_root}/${app}-public.env" "${config_root}/${app}-secrets.env")
done
for file in "${protected[@]}"; do
  [[ -f "${file}" && ! -L "${file}" ]] || fail required_protected_file_missing
  [[ -z "$(find "${file}" -maxdepth 0 -perm /022 -print -quit)" ]] || fail insecure_configuration_permissions
  if [[ "${M9_DEPLOY_TEST_MODE:-0}" != 1 ]]; then
    [[ -z "$(find "${file}" -maxdepth 0 ! -user root -print -quit)" ]] || fail invalid_configuration_owner
  fi
done
# This root-owned file is host configuration, never candidate input.
set -a
# shellcheck disable=SC1090
source "${config_root}/deploy.conf"
set +a
mkdir -p -- "${state_dir}"
exec 9>"${state_dir}/deployment.lock"
flock -n 9 || fail deployment_already_running
exec python3 -I -B "${helper_root}/paired-release.py" "$@"
