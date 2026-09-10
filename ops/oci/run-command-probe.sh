#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

[[ "${EUID}" == "0" ]] || { printf 'Run Command probe requires root through the restricted sudo rule\n' >&2; exit 1; }
config_root="${OIOI_CONFIG_ROOT:-/etc/oioibawige}"
mkdir -p -- "${config_root}"
temporary="$(mktemp "${config_root}/.run-command-probe.XXXXXX")"
printf 'deployment=%s\ntime=%s\n' "${OCI_DEPLOYMENT_ID:-manual-probe}" "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" >"${temporary}"
chmod 0600 "${temporary}"
mv -f -- "${temporary}" "${config_root}/run-command-probe.passed"
printf '{"severity":"INFO","event":"ubuntu_run_command_probe_succeeded"}\n'
