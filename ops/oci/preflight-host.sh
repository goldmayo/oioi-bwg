#!/usr/bin/env bash

set -Eeuo pipefail

[[ "${EUID}" == "0" ]] || { printf 'M9 host preflight requires root\n' >&2; exit 1; }
runtime_root="${OIOI_RUNTIME_ROOT:-/srv/oioibawige}"
config_root="${OIOI_CONFIG_ROOT:-/etc/oioibawige}"
# Stop before Docker/Instance Principal calls when a privileged path is replaceable.
python3 -I - "${runtime_root}" "${config_root}" <<'PYTHON'
import stat
import sys
from pathlib import Path
runtime, config = map(Path, sys.argv[1:3])
try:
    for root in (runtime, runtime / 'scripts', runtime / 'deploy', config):
        for path in (*reversed(root.parents), root):
            info = path.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
                raise ValueError()
except (OSError, ValueError):
    print('Host preflight path is not root-protected', file=sys.stderr)
    sys.exit(1)
PYTHON
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

for command in base64 cmp curl docker flock oci python3 sort systemctl tr; do
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

agent_active=0
for unit in oracle-cloud-agent.service snap.oracle-cloud-agent.oracle-cloud-agent.service; do
  if systemctl is-active --quiet "${unit}" 2>/dev/null; then
    pass "oracle-cloud-agent:${unit}"
    agent_active=1
    break
  fi
done
[[ "${agent_active}" == "1" ]] || fail oracle-cloud-agent

agent_snap_version=""
if command -v snap >/dev/null 2>&1; then
  agent_snap_version="$(snap list oracle-cloud-agent 2>/dev/null | awk 'NR == 2 {print $2}')"
fi
if [[ -n "${agent_snap_version}" ]] && [[ "$(printf '%s\n' 1.61.0 "${agent_snap_version}" | sort -V | head -n1)" == "1.61.0" ]]; then
  pass "oracle-cloud-agent-snap:${agent_snap_version}"
else
  fail "oracle-cloud-agent-snap>=1.61.0:${agent_snap_version:-missing}"
fi

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
  "${runtime_root}/scripts/materialize-runtime-env.py" \
  "${runtime_root}/scripts/paired-release.py" \
  "${runtime_root}/scripts/publish-filesystem-metric.sh" \
  "${runtime_root}/scripts/run-command-probe.sh"
)
config_files=(
  "${config_root}/deploy.conf" \
  "${config_root}/runtime-public.env" \
  "${config_root}/runtime-secrets.env" \
  "${config_root}/console-runtime-public.env" \
  "${config_root}/console-runtime-secrets.env"
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
  if [[ -f "${root_file}" && ! -L "${root_file}" ]] && [[ -z "$(find "${root_file}" -maxdepth 0 \( ! -user root -o -perm /022 -o ! -links 1 \) -print -quit)" ]]; then
    pass "root-owned-not-writable:${root_file}"
  else
    fail "root-owned-not-writable:${root_file}"
  fi
done

if grep -q '^CONSOLE_IMAGE_REPOSITORY=' "${config_root}/deploy.conf" &&
  grep -q '^CONSOLE_PORT=' "${config_root}/deploy.conf" &&
  grep -q '^CONSOLE_SMOKE_PATHS=' "${config_root}/deploy.conf" &&
  grep -q '^  web:' "${runtime_root}/compose.oci-development.yml" &&
  grep -q '^  console:' "${runtime_root}/compose.oci-development.yml"; then
  pass paired-host-configuration
else
  fail paired-host-configuration
fi

# Oracle Cloud Agent 1.61.0 added Ubuntu snap support for Compute Run Command.
# Keep a real, secret-free probe as runtime evidence in addition to the version gate.
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
