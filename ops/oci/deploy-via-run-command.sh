#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE_DIGEST="${1:-}"
: "${OCI_COMPUTE_COMPARTMENT_OCID:?OCI_COMPUTE_COMPARTMENT_OCID is required}"
: "${OCI_COMPUTE_INSTANCE_OCID:?OCI_COMPUTE_INSTANCE_OCID is required}"

if [[ ! "${IMAGE_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "IMAGE_DIGEST must be an immutable sha256 manifest digest" >&2
  exit 2
fi

for command in oci jq; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Required command not found: ${command}" >&2
    exit 2
  }
done

target="$(jq -cn --arg instance_id "${OCI_COMPUTE_INSTANCE_OCID}" '{instanceId:$instance_id}')"
content="$(
  jq -cn \
    --arg text "sudo /srv/oioibawige/scripts/deploy-release.sh ${IMAGE_DIGEST}" \
    '{source:{sourceType:"TEXT",text:$text},output:{outputType:"TEXT"}}'
)"

command_id="$(
  oci instance-agent command create \
    --compartment-id "${OCI_COMPUTE_COMPARTMENT_OCID}" \
    --display-name "github-${GITHUB_SHA:-manual}" \
    --timeout-in-seconds 900 \
    --target "${target}" \
    --content "${content}" \
    --query 'data.id' \
    --raw-output
)"

if [[ ! "${command_id}" =~ ^ocid1\.instanceagentcommand\. ]]; then
  echo "Failed to create OCI Run Command" >&2
  exit 1
fi

echo "Created OCI Run Command: ${command_id}"

execution_file="$(mktemp)"
error_file="$(mktemp)"
trap 'rm -f -- "${execution_file}" "${error_file}"' EXIT

start_epoch="$(date +%s)"
lookup_grace_deadline=$((start_epoch + 120))
overall_deadline=$((start_epoch + 900))
execution_state=""

while (( $(date +%s) < overall_deadline )); do
  if oci instance-agent command-execution get \
    --command-id "${command_id}" \
    --instance-id "${OCI_COMPUTE_INSTANCE_OCID}" \
    >"${execution_file}" 2>"${error_file}"; then
    execution_state="$(jq -r '.data["lifecycle-state"] // empty' "${execution_file}")"
    case "${execution_state}" in
      SUCCEEDED|FAILED|TIMED_OUT|CANCELED)
        break
        ;;
    esac
  else
    now_epoch="$(date +%s)"
    if grep -q 'NotAuthorizedOrNotFound' "${error_file}" && (( now_epoch < lookup_grace_deadline )); then
      sleep 10
      continue
    fi

    echo "Failed to read OCI Run Command execution" >&2
    sed -E 's/(DATABASE_URL|DB_APP_PASSWORD|AUTH_SECRET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)=([^[:space:]]+)/\1=<redacted>/g' "${error_file}" >&2
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

remote_exit_code="$(jq -r '.data.content["exit-code"] // empty' "${execution_file}")"
agent_message="$(jq -r '.data.content.message // "none"' "${execution_file}")"
remote_output="$(jq -r '.data.content.text // "<empty>"' "${execution_file}")"

sensitive_markers=(
  'DATABASE_URL='
  'DB_APP_PASSWORD='
  'AUTH_SECRET='
  'R2_ACCESS_KEY_ID='
  'R2_SECRET_ACCESS_KEY='
  'postgresql://'
  'postgres://'
)

for marker in "${sensitive_markers[@]}"; do
  if [[ "${remote_output}" == *"${marker}"* ]]; then
    remote_output='<redacted: remote output contained a sensitive marker>'
    break
  fi
done

echo "Run Command lifecycle: ${execution_state}"
echo "Remote exit code: ${remote_exit_code:-UNKNOWN}"
echo "Agent message: ${agent_message}"
echo "Remote output:"
printf '%s\n' "${remote_output}"

if [[ ! "${remote_exit_code}" =~ ^[0-9]+$ ]]; then
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
