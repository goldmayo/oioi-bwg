#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID}" == 0 && "$#" == 1 && "$1" == --apply ]] || {
  printf 'Metadata guard installation requires root and --apply\n' >&2; exit 1;
}
for command in nft python3 curl docker systemctl; do command -v "$command" >/dev/null; done
[[ "$(systemctl show docker.service -p LoadState --value)" == loaded ]]
guard_root="/usr/local/lib/oioi-metadata-guard"
# Reject replaceable ancestors and existing symlink/file destinations before any mutation.
python3 -I - "$guard_root" <<'PYTHON'
import stat
import sys
from pathlib import Path
root = Path(sys.argv[1])
try:
    for path in [*reversed(root.parents), root]:
        if path == root and not path.exists() and not path.is_symlink():
            continue
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError()
    for name in ('metadata-guard.py', 'metadata-probe.mjs'):
        path = root / name
        if not path.exists() and not path.is_symlink():
            continue
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022 or info.st_nlink != 1:
            raise ValueError()
except (OSError, ValueError):
    print('Metadata guard installation path is not root-protected', file=sys.stderr)
    sys.exit(1)
PYTHON
assets="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -d -o root -g root -m 0755 "$guard_root"
install -o root -g root -m 0755 "$assets/metadata-guard.py" "$guard_root/metadata-guard.py"
install -o root -g root -m 0644 "$assets/metadata-probe.mjs" "$guard_root/metadata-probe.mjs"
python3 -I "$guard_root/metadata-guard.py" apply
install -m 0644 "$assets/metadata/oioi-metadata-guard.service" /etc/systemd/system/oioi-metadata-guard.service
install -d -m 0755 /etc/systemd/system/docker.service.d
install -m 0644 "$assets/metadata/docker.service.conf" /etc/systemd/system/docker.service.d/50-oioi-metadata-guard.conf
systemctl daemon-reload
systemctl start oioi-metadata-guard.service
python3 -I "$guard_root/metadata-guard.py" check
printf 'Metadata guard installed; Docker was not restarted. Real container probes and restart verification remain required.\n'
