#!/usr/bin/env bash

set -Eeuo pipefail

[[ "${EUID}" == "0" ]] || { printf 'M9 host preflight requires root\n' >&2; exit 1; }
runtime_root="${OIOI_RUNTIME_ROOT:-/srv/oioibawige}"
config_root="${OIOI_CONFIG_ROOT:-/etc/oioibawige}"
failures=0

pass() {
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_command() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "command:$1"
  else
    fail "command:$1"
  fi
}

for command in base64 cmp curl docker flock oci pg_dump pg_restore psql python3 sort systemctl tr; do
  require_command "${command}"
done

if docker info >/dev/null 2>&1; then
  pass docker-daemon
else
  fail docker-daemon
fi

compose_version="$(docker compose version --short 2>/dev/null || true)"
if [[ -n "${compose_version}" ]] && [[ "$(printf '%s\n' 2.30.0 "${compose_version#v}" | sort -V | head -n1)" == "2.30.0" ]]; then
  pass "docker-compose:${compose_version}"
else
  fail "docker-compose>=2.30.0:${compose_version:-missing}"
fi

postgres_version="$(pg_dump --version 2>/dev/null || true)"
if [[ "${postgres_version}" =~ PostgreSQL\)[[:space:]]17\. ]]; then
  pass postgresql-client-17
else
  fail "postgresql-client-17:${postgres_version:-missing}"
fi

agent_active=0
for unit in oracle-cloud-agent.service snap.oracle-cloud-agent.oracle-cloud-agent.service; do
  if systemctl is-active --quiet "${unit}" 2>/dev/null; then
    pass "oracle-cloud-agent:${unit}"
    agent_active=1
    break
  fi
done
[[ "${agent_active}" == "1" ]] || fail oracle-cloud-agent

if command -v docker-credential-ocir >/dev/null 2>&1; then
  pass docker-credential-ocir
else
  fail docker-credential-ocir
fi

if oci os ns get --auth instance_principal --query data --raw-output >/dev/null 2>&1; then
  pass instance-principal
else
  fail instance-principal
fi

runtime_files=(
  "${runtime_root}/compose.oci-development.yml" \
  "${runtime_root}/scripts/deploy-release.sh" \
  "${runtime_root}/scripts/backup-postgres.sh" \
  "${runtime_root}/scripts/restore-postgres.sh" \
  "${runtime_root}/scripts/publish-filesystem-metric.sh" \
  "${runtime_root}/scripts/run-command-probe.sh"
)
config_files=(
  "${config_root}/deploy.conf" \
  "${config_root}/runtime-public.env" \
  "${config_root}/runtime-secrets.env"
)
for required_file in "${runtime_files[@]}" "${config_files[@]}"; do
  [[ -f "${required_file}" ]] && pass "file:${required_file}" || fail "file:${required_file}"
done

for protected_file in "${config_files[@]}"; do
  if [[ -f "${protected_file}" ]] && [[ -z "$(find "${protected_file}" -maxdepth 0 -perm /077 -print -quit)" ]]; then
    pass "mode-0600:${protected_file}"
  else
    fail "mode-0600:${protected_file}"
  fi
done

for root_file in "${runtime_files[@]}" "${config_files[@]}"; do
  if [[ -f "${root_file}" ]] && [[ -z "$(find "${root_file}" -maxdepth 0 \( ! -user root -o -perm /022 \) -print -quit)" ]]; then
    pass "root-owned-not-writable:${root_file}"
  else
    fail "root-owned-not-writable:${root_file}"
  fi
done

# Oracle's documented Run Command platform-image list does not include Ubuntu.
# Only a real, secret-free command delivered through the target instance can create this marker.
if [[ -f "${config_root}/run-command-probe.passed" ]]; then
  pass ubuntu-run-command-probe
else
  fail ubuntu-run-command-probe
fi

if [[ "${failures}" -ne 0 ]]; then
  printf 'M9 host preflight failed: %d check(s)\n' "${failures}" >&2
  exit 1
fi

printf 'M9 host preflight passed\n'
