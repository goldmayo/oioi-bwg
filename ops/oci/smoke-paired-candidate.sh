#!/usr/bin/env bash
set -Eeuo pipefail
: "${PAIR_SMOKE_FILE:?PAIR_SMOKE_FILE is required}"
rm -f -- "${PAIR_SMOKE_FILE}"
cleanup() { docker rm --force promotion-smoke console-promotion-smoke >/dev/null 2>&1 || true; }
trap cleanup EXIT
for app in web console; do
  if [[ "${app}" == web ]]; then
    repository="${IMAGE_REPOSITORY}"; digest="${IMAGE_DIGEST}"; revision="${WEB_BUILD_SOURCE_SHA}"
  else
    repository="${CONSOLE_IMAGE_REPOSITORY}"; digest="${CONSOLE_IMAGE_DIGEST}"; revision="${CONSOLE_BUILD_SOURCE_SHA}"
  fi
  [[ "${digest}" =~ ^sha256:[0-9a-f]{64}$ && "${revision}" =~ ^[0-9a-f]{40}$ ]]
  image="${repository}@${digest}"
  docker pull --platform linux/arm64 "${image}"
  [[ "$(docker image inspect "${image}" --format '{{.Architecture}}')" == arm64 ]]
  [[ "$(docker image inspect "${image}" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" == "${revision}" ]]
  node tests/ops/container-native-smoke.mjs "${image}" "${app}"
done

docker run --detach --name promotion-smoke --network host \
  --env DATABASE_URL=postgresql://postgres@127.0.0.1:5432/promotion_smoke \
  --env AUTH_SECRET=promotion-smoke-local-only-secret --env AUTH_TRUST_HOST=true \
  "${IMAGE_REPOSITORY}@${IMAGE_DIGEST}"
docker run --detach --name console-promotion-smoke \
  --add-host host.docker.internal:host-gateway --publish 127.0.0.1:3001:3000 \
  --env DATABASE_URL=postgresql://postgres@host.docker.internal:5432/promotion_smoke \
  --env CONSOLE_AUTH_SECRET=console-promotion-smoke-local-only-secret \
  --env CONSOLE_ORIGIN=http://127.0.0.1:3001 \
  --env CONSOLE_MFA_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
  "${CONSOLE_IMAGE_REPOSITORY}@${CONSOLE_IMAGE_DIGEST}"
for port in 3000 3001; do
  for attempt in $(seq 1 60); do
    if curl --fail --silent --output /dev/null "http://127.0.0.1:${port}/readyz"; then break; fi
    sleep 1
  done
  node tests/ops/container-readiness-smoke.mjs "http://127.0.0.1:${port}"
done
curl --fail --silent --output /dev/null http://127.0.0.1:3000/
node tests/ops/web-standalone-smoke.mjs http://127.0.0.1:3000
node tests/ops/console-standalone-smoke.mjs http://127.0.0.1:3001
# This proof is created only after both immutable images pass together in this run.
python3 -I - <<'PY'
import json,os
proof={'runId': int(os.environ['GITHUB_RUN_ID']), 'runAttempt': int(os.environ['GITHUB_RUN_ATTEMPT']),
       'images': {app: {'digest':os.environ['IMAGE_DIGEST' if app=='web' else 'CONSOLE_IMAGE_DIGEST'],
                        'buildSourceSha':os.environ[app.upper()+'_BUILD_SOURCE_SHA']} for app in ('web','console')}}
with open(os.environ['PAIR_SMOKE_FILE'],'w') as f: json.dump(proof,f)
PY
