#!/usr/bin/env bash
# 격리 Docker 네트워크와 임시 소켓만 사용한다. 운영 /run·env·DB는 사용하지 않는다.
set -Eeuo pipefail
root="$(mktemp -d)"
project="p08-socket-$$"
export WEB_IMAGE="${WAVEFORM_SOCKET_TEST_IMAGE:-oioi-bwg-console:workspace-check}" CONSOLE_IMAGE="${WAVEFORM_SOCKET_TEST_IMAGE:-oioi-bwg-console:workspace-check}"
export WEB_ENV_FILE="${root}/empty.env" CONSOLE_ENV_FILE="${root}/empty.env"
export POSTGRES_NETWORK="${project}" CONSOLE_WAVEFORM_SOCKET_GID=12345
server="${project}-server"
compose() { docker compose -p "${project}" -f ops/oci/compose.yml -f ops/oci/compose.waveform.yml -f "${root}/fixture.yml" "$@"; }
cleanup() {
  docker rm -f "${server}" >/dev/null 2>&1 || true
  compose down >/dev/null 2>&1 || true
  docker network rm "${project}" >/dev/null 2>&1 || true
  docker run --rm --network none --user 0 --entrypoint node -v "${root}/socket:/fixture" "${CONSOLE_IMAGE}" -e 'require("fs").chmodSync("/fixture", 0o777)' >/dev/null 2>&1 || true
  rm -rf -- "${root}"
}
trap cleanup EXIT
mkdir "${root}/socket"
touch "${root}/empty.env"
# 실제 운영 overlay를 먼저 렌더해 Web 불변과 mount 계약을 확인한다.
docker compose -f ops/oci/compose.yml config --format json >"${root}/base.json"
docker compose -f ops/oci/compose.yml -f ops/oci/compose.waveform.yml config --format json >"${root}/enabled.json"
python3 -I - "${root}" <<'PY'
import json,sys
from pathlib import Path
root=Path(sys.argv[1]); base=json.loads((root/'base.json').read_text()); enabled=json.loads((root/'enabled.json').read_text())
assert base['services']['web']==enabled['services']['web']
assert 'volumes' not in base['services']['console']
console=enabled['services']['console']; assert console['group_add']==['12345']
volume=console['volumes'][0]; assert len(console['volumes'])==1
assert volume['type']=='bind' and volume['source']==volume['target']=='/run/oioi-waveform' and volume['read_only']
assert volume['bind']['propagation']=='rprivate' and not volume['bind'].get('create_host_path',False)
PY
cat >"${root}/fixture.yml" <<YAML
services:
  console:
    user: "1001:1001"
    entrypoint: []
    volumes:
      - type: bind
        source: ${root}/socket
        target: /run/oioi-waveform
        read_only: true
        bind:
          propagation: rprivate
          create_host_path: false
YAML
docker network create --internal "${project}" >/dev/null
docker run -d --name "${server}" --network none --user 0 --entrypoint node \
  --mount "type=bind,src=${root}/socket,dst=/fixture" "${CONSOLE_IMAGE}" -e '
const fs=require("fs"), net=require("net");
fs.chownSync("/fixture",0,12345);fs.chmodSync("/fixture",0o750);
net.createServer(c=>c.end("ok")).listen("/fixture/runner.sock",()=>{
fs.chownSync("/fixture/runner.sock",0,12345);fs.chmodSync("/fixture/runner.sock",0o660);
});' >/dev/null
for attempt in {1..30}; do
  if docker exec "${server}" node -e 'process.exit(require("fs").existsSync("/fixture/runner.sock")?0:1)' >/dev/null 2>&1; then break; fi
  sleep 0.1
done
compose run --rm -T --no-deps console node -e '
const fs=require("fs"),net=require("net");
try {fs.writeFileSync("/run/oioi-waveform/forbidden","x");process.exit(1);}catch(e){if(!["EROFS","EACCES"].includes(e.code))throw e;}
const c=net.connect("/run/oioi-waveform/runner.sock");c.setTimeout(2000,()=>process.exit(1));c.on("error",()=>process.exit(1));let data="";c.on("data",d=>data+=d);c.on("end",()=>{if(data!=="ok")process.exit(1);});' >/dev/null
# 동일 UID라도 전용 추가 그룹이 없으면 연결할 수 없어야 한다.
docker run --rm --network none --user 1001:1001 --entrypoint node \
  --mount "type=bind,src=${root}/socket,dst=/run/oioi-waveform,readonly" "${CONSOLE_IMAGE}" -e '
const c=require("net").connect("/run/oioi-waveform/runner.sock");c.setTimeout(2000,()=>process.exit(1));
c.on("connect",()=>process.exit(1));c.on("error",e=>process.exit(e.code==="EACCES"?0:1));'
printf 'waveform_console_socket_dac_and_readonly_passed\n'
