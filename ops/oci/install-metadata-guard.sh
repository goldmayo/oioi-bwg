#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" == 0 && "$#" == 1 && "$1" == --apply ]] || {
  printf 'Metadata guard installation requires root and --apply\n' >&2; exit 1;
}
for command in nft python3 curl docker systemctl; do command -v "$command" >/dev/null; done
[[ "$(systemctl show docker.service -p LoadState --value)" == loaded ]]
assets="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -d -m 0750 /srv/oioibawige/scripts
install -m 0755 "$assets/metadata-guard.py" /srv/oioibawige/scripts/metadata-guard.py
install -m 0644 "$assets/metadata-probe.mjs" /srv/oioibawige/scripts/metadata-probe.mjs
python3 -I /srv/oioibawige/scripts/metadata-guard.py apply
install -m 0644 "$assets/metadata/oioi-metadata-guard.service" /etc/systemd/system/oioi-metadata-guard.service
install -d -m 0755 /etc/systemd/system/docker.service.d
install -m 0644 "$assets/metadata/docker.service.conf" /etc/systemd/system/docker.service.d/50-oioi-metadata-guard.conf
systemctl daemon-reload
systemctl start oioi-metadata-guard.service
python3 -I /srv/oioibawige/scripts/metadata-guard.py check
printf 'Metadata guard installed; Docker was not restarted. Real container probes and restart verification remain required.\n'
