#!/usr/bin/env bash
# Runs only on the isolated CI Docker daemon; never uses host deployment state/credentials.
set -Eeuo pipefail
root="$(mktemp -d)"
project="p06-compose-${GITHUB_RUN_ID:-local}"
export POSTGRES_NETWORK="${project}"
export APP_BIND_ADDRESS=127.0.0.1 APP_PORT=3000 CONSOLE_PORT=3001
export WEB_IMAGE=oioi-bwg:workspace-check CONSOLE_IMAGE=oioi-bwg-console:workspace-check
export WEB_ENV_FILE="${root}/web.env" CONSOLE_ENV_FILE="${root}/console.env"
compose() { docker compose -p "${project}" -f compose.oci-development.yml -f "${root}/override.yml" "$@"; }
cleanup() {
  compose rm -sf web console >/dev/null 2>&1 || true
  docker network rm "${POSTGRES_NETWORK}" >/dev/null 2>&1 || true
  rm -rf -- "${root}"
}
trap cleanup EXIT
cat >"${root}/override.yml" <<'YAML'
services:
  web:
    extra_hosts: ["host.docker.internal:host-gateway"]
  console:
    extra_hosts: ["host.docker.internal:host-gateway"]
YAML
printf '%s\n' 'DATABASE_URL=postgresql://postgres@host.docker.internal:5432/image_smoke' >"${WEB_ENV_FILE}"
printf '%s\n' 'DATABASE_URL=postgresql://postgres@host.docker.internal:5432/image_smoke' 'CONSOLE_AUTH_SECRET=console-workspace-smoke-local-only-secret' 'CONSOLE_ORIGIN=http://127.0.0.1:3001' 'CONSOLE_MFA_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' >"${CONSOLE_ENV_FILE}"
cp "${CONSOLE_ENV_FILE}" "${root}/console-good.env"
docker network create "${POSTGRES_NETWORK}" >/dev/null
# Distinct real image IDs without rebuilding app code or pulling another base.
for app in web console; do
  base=oioi-bwg:workspace-check; [[ "${app}" == web ]] || base=oioi-bwg-console:workspace-check
  printf 'FROM %s\nLABEL paired.compose.fixture=changed\n' "${base}" >"${root}/Dockerfile"
  docker build --pull=false --network none --tag "${project}-${app}:changed" "${root}" >/dev/null
done
up() { compose up -d --wait --wait-timeout 45 web console; }
identity() { docker inspect --format '{{.Id}} {{.State.StartedAt}}' "$(compose ps -q "$1")"; }
healthy() {
  node tests/ops/container-readiness-smoke.mjs http://127.0.0.1:3000
  node tests/ops/container-readiness-smoke.mjs http://127.0.0.1:3001
}
up; healthy
web_before="$(identity web)"; console_before="$(identity console)"
export WEB_IMAGE="${project}-web:changed"
up; healthy
[[ "$(identity console)" == "${console_before}" && "$(identity web)" != "${web_before}" ]]
web_before="$(identity web)"
export CONSOLE_IMAGE="${project}-console:changed"
up; healthy
[[ "$(identity web)" == "${web_before}" && "$(identity console)" != "${console_before}" ]]
console_before="$(identity console)"
printf '%s\n' 'R2_BUCKET=compose-env-change' >>"${WEB_ENV_FILE}"
up; healthy
[[ "$(identity console)" == "${console_before}" && "$(identity web)" != "${web_before}" ]]
web_before="$(identity web)"
up; healthy
[[ "$(identity console)" == "${console_before}" && "$(identity web)" == "${web_before}" ]]
# A bad Console runtime fails the pair. Reconcile the previous effective pair.
printf '%s\n' 'CONSOLE_AUTH_SECRET=invalid' >"${CONSOLE_ENV_FILE}"
if up && healthy; then echo 'Expected Console failure' >&2; exit 1; fi
cp "${root}/console-good.env" "${CONSOLE_ENV_FILE}"
up; healthy
[[ "$(identity web)" == "${web_before}" ]]
printf 'paired_compose_identity_and_rollback_passed\n'
