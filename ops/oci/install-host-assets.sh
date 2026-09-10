#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

[[ "${EUID}" == "0" ]] || { printf 'Host asset installation requires root\n' >&2; exit 1; }
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
runtime_root="/srv/oioibawige"
config_root="/etc/oioibawige"

install -d -m 0750 "${runtime_root}" "${runtime_root}/deploy" "${runtime_root}/scripts" "${config_root}"
install -m 0644 "${repository_root}/compose.oci-development.yml" "${runtime_root}/compose.oci-development.yml"
for script in deploy-release.sh publish-filesystem-metric.sh run-command-probe.sh preflight-host.sh; do
  install -m 0755 "${repository_root}/ops/oci/${script}" "${runtime_root}/scripts/${script}"
done

if [[ ! -e "${config_root}/deploy.conf" ]]; then
  install -m 0600 "${repository_root}/ops/oci/deploy.conf.example" "${config_root}/deploy.conf"
fi
if [[ ! -e "${config_root}/runtime-public.env" ]]; then
  install -m 0600 "${repository_root}/app.env.oci-development.example" "${config_root}/runtime-public.env"
fi
if [[ ! -e "${config_root}/runtime-secrets.env" ]]; then
  install -m 0600 "${repository_root}/.env.oci-secrets.example" "${config_root}/runtime-secrets.env"
fi

install -m 0440 "${repository_root}/ops/oci/ocarun.sudoers" /etc/sudoers.d/oioi-bwg-ocarun
visudo -cf /etc/sudoers.d/oioi-bwg-ocarun
for unit in "${repository_root}"/ops/oci/systemd/*.{service,timer}; do
  install -m 0644 "${unit}" "/etc/systemd/system/$(basename "${unit}")"
done
systemctl daemon-reload

printf 'Host assets installed. Populate protected configuration, run preflight, then explicitly enable timers.\n'
