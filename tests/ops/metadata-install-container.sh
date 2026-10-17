#!/usr/bin/env bash
# Run only in a disposable, network-isolated root container; never on an operating host.
set -Eeuo pipefail
[[ "$#" == 1 && "$1" == --isolated-container && -f /.dockerenv && "$EUID" == 0 ]]
[[ ! -e /usr/local/lib/oioi-metadata-guard ]]
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
for name in nft curl docker; do
  printf '#!/bin/sh\nexit 0\n' > "$work/bin/$name"
done
cat > "$work/bin/systemctl" <<'STUB'
#!/bin/sh
if [ "$1" = show ]; then printf 'loaded\n'; fi
STUB
chmod 0755 "$work"/bin/*
export PATH="$work/bin:$PATH"
guard=/usr/local/lib/oioi-metadata-guard
reject() {
  if bash ops/oci/install-metadata-guard.sh --apply > "$work/output" 2>&1; then
    printf 'Unsafe installation unexpectedly succeeded\n' >&2; exit 1
  fi
  test ! -e /etc/systemd/system/oioi-metadata-guard.service
  test ! -e /etc/systemd/system/docker.service.d/50-oioi-metadata-guard.conf
  printf 'rejected:%s\n' "$1"
}
mkdir "$guard"
chown 1002:1002 "$guard"
reject user-owned-directory
chown 0:0 "$guard"
chmod 0775 "$guard"
reject writable-directory
rmdir "$guard"
ln -s "$work" "$guard"
reject symlink-directory
rm "$guard"
mkdir -m 0755 "$guard"
ln -s "$work/output" "$guard/metadata-guard.py"
reject symlink-file
rm "$guard/metadata-guard.py"
printf 'unchanged\n' > "$guard/metadata-guard.py"
ln "$guard/metadata-guard.py" "$work/hardlink"
reject hardlinked-file
rm "$guard/metadata-guard.py" "$work/hardlink"
chmod 0775 /usr/local/lib
reject writable-ancestor
chmod 0755 /usr/local/lib
# Replace only the nft JSON response; ownership and install operations remain real.
cat > "$work/bin/nft" <<'NFT'
#!/bin/sh
if [ "$1" = -j ]; then
cat <<'JSON'
{"nftables":[{"table":{"family":"inet","name":"oioi_metadata_guard"}},{"chain":{"family":"inet","table":"oioi_metadata_guard","name":"forward","type":"filter","hook":"forward","prio":-10,"policy":"accept"}},{"rule":{"family":"inet","table":"oioi_metadata_guard","chain":"forward","expr":[{"match":{"op":"==","left":{"payload":{"protocol":"ip","field":"daddr"}},"right":"169.254.169.254"}},{"counter":{"packets":0,"bytes":0}},{"drop":null}]}}]}
JSON
else cat >/dev/null; fi
NFT
mkdir -p /srv/oioibawige/scripts
chown 1002:1002 /srv/oioibawige /srv/oioibawige/scripts
bash ops/oci/install-metadata-guard.sh --apply
bash ops/oci/install-metadata-guard.sh --apply
for path in "$guard" "$guard/metadata-guard.py" "$guard/metadata-probe.mjs"; do
  test "$(stat -c %u "$path")" = 0
  test -z "$(find "$path" -maxdepth 0 -perm /022 -print)"
done
test "$(stat -c %u /srv/oioibawige/scripts)" = 1002
printf 'passed:root-protected-install-and-repeat\n'
