#!/usr/bin/env bash
set -Eeuo pipefail

WEB_IMAGE_DIGEST="${1:-}"
CONSOLE_IMAGE_DIGEST="${2:-}"
CANDIDATE_PAYLOAD="${3:-}"
if [[ "$#" -ne 3 ]] ||
  [[ ! "${WEB_IMAGE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] ||
  [[ ! "${CONSOLE_IMAGE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]] ||
  [[ ! "${CANDIDATE_PAYLOAD}" =~ ^[A-Za-z0-9_-]{1,16000}$ ]]; then
  echo "Two immutable digests and one bounded candidate payload are required" >&2
  exit 2
fi
: "${OCI_COMPUTE_COMPARTMENT_OCID:?OCI_COMPUTE_COMPARTMENT_OCID is required}"
: "${OCI_COMPUTE_INSTANCE_OCID:?OCI_COMPUTE_INSTANCE_OCID is required}"

for command in oci jq node; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Required command not found: ${command}" >&2
    exit 2
  }
done

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! node --input-type=module - "${script_root}" "${CANDIDATE_PAYLOAD}" "${WEB_IMAGE_DIGEST}" "${CONSOLE_IMAGE_DIGEST}" >/dev/null 2>&1 <<'JS'
import { pathToFileURL } from 'node:url';
const [root, payload, web, consoleDigest] = process.argv.slice(2);
const { assertCandidate } = await import(pathToFileURL(root + '/promotion.mjs'));
const bytes = Buffer.from(payload, 'base64url');
if (bytes.toString('base64url') !== payload) process.exit(1);
const candidate = JSON.parse(bytes.toString('utf8'));
assertCandidate(candidate, candidate);
if (candidate.images.web.digest !== web || candidate.images.console.digest !== consoleDigest) process.exit(1);
JS
then
  echo "Invalid paired candidate payload" >&2
  exit 2
fi

target="$(jq -cn --arg instance_id "${OCI_COMPUTE_INSTANCE_OCID}" '{instanceId:$instance_id}')"
content="$(
  jq -cn \
    --arg text "sudo /srv/oioibawige/scripts/deploy-release.sh ${WEB_IMAGE_DIGEST} ${CONSOLE_IMAGE_DIGEST} ${CANDIDATE_PAYLOAD}" \
    '{source:{sourceType:"TEXT",text:$text},output:{outputType:"TEXT"}}'
)"

umask 077
execution_file="$(mktemp)"
error_file="$(mktemp)"
trap 'rm -f -- "${execution_file}" "${error_file}"' EXIT

command_id="$(
  oci instance-agent command create \
    --compartment-id "${OCI_COMPUTE_COMPARTMENT_OCID}" \
    --display-name "github-${GITHUB_SHA:-manual}" \
    --timeout-in-seconds 900 \
    --target "${target}" \
    --content "${content}" \
    --query 'data.id' \
    --raw-output 2>"${error_file}"
)" || { echo "Failed to create OCI Run Command" >&2; exit 1; }

if [[ ! "${command_id}" =~ ^ocid1\.instanceagentcommand\.[a-z0-9.-]+$ ]]; then
  echo "Failed to create OCI Run Command" >&2
  exit 1
fi

echo "Created OCI Run Command: ${command_id}"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'command_id=%s\n' "${command_id}" >>"${GITHUB_OUTPUT}"
fi

overall_deadline=$(($(date +%s) + 900))
execution_state=""

while (( $(date +%s) < overall_deadline )); do
  if oci instance-agent command-execution get \
    --command-id "${command_id}" \
    --instance-id "${OCI_COMPUTE_INSTANCE_OCID}" \
    >"${execution_file}" 2>"${error_file}"; then
    execution_state="$(jq -r '.data["lifecycle-state"] // empty' "${execution_file}" 2>/dev/null)" || {
      echo "Invalid Run Command execution response" >&2
      exit 1
    }
    case "${execution_state}" in
      SUCCEEDED|FAILED|TIMED_OUT|CANCELED)
        break
        ;;
    esac
  else
    # The agent polls asynchronously and the execution resource does not exist until
    # the target instance has accepted the command. OCI reports both that race and
    # authorization failures as NotAuthorizedOrNotFound, so keep retrying within the
    # command's overall timeout. IAM grants execution-family inspect separately.
    if grep -q 'NotAuthorizedOrNotFound' "${error_file}"; then
      sleep 10
      continue
    fi

    echo "Failed to read OCI Run Command execution" >&2
    exit 1
  fi

  sleep 10
done

case "${execution_state}" in
  SUCCEEDED|FAILED|TIMED_OUT|CANCELED)
    ;;
  *)
    echo "Run Command did not reach a terminal state before timeout" >&2
    exit 1
    ;;
esac

remote_exit_code="$(jq -er '.data.content["exit-code"] | select(type == "number" and . == floor and . >= 0 and . <= 255)' "${execution_file}" 2>/dev/null)" || {
  echo "Invalid Run Command exit code" >&2
  exit 1
}
# Agent message/text and OCI error streams may contain either app's runtime secrets.
# Only the bounded lifecycle/exit code and fixed diagnostics cross into Actions logs.
echo "Run Command lifecycle: ${execution_state}"
echo "Remote exit code: ${remote_exit_code}"
echo "Remote output: <redacted: inspect protected host logs>"
if [[ "${execution_state}" == "TIMED_OUT" || "${execution_state}" == "CANCELED" ]] ||
  [[ "${execution_state}" != "SUCCEEDED" && "${remote_exit_code}" == "0" ]]; then
  echo "Run Command did not succeed" >&2
  exit 1
fi

case "${remote_exit_code}" in
  0)
    echo "Deployment result: deployment succeeded"
    ;;
  20)
    echo "Deployment result: candidate failed; rollback succeeded" >&2
    ;;
  21)
    echo "Deployment result: candidate failed; rollback failed" >&2
    ;;
  *)
    echo "Deployment result: host deployment failed with exit ${remote_exit_code}" >&2
    ;;
esac

exit "${remote_exit_code}"
