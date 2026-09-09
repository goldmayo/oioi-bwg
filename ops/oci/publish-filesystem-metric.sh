#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

config_file="${OIOI_DEPLOY_CONFIG:-/etc/oioibawige/deploy.conf}"
[[ "${EUID}" == "0" ]] || { printf 'Filesystem metric publication requires root\n' >&2; exit 1; }
[[ -f "${config_file}" ]] || { printf 'Metric configuration is missing\n' >&2; exit 1; }
if find "${config_file}" -maxdepth 0 \( ! -user root -o -perm /077 \) -print -quit | grep -q .; then
  printf 'Metric configuration must be root-owned mode 0600\n' >&2
  exit 1
fi
# shellcheck disable=SC1090
source "${config_file}"
: "${OCI_REGION:?OCI_REGION is required}"
: "${OCI_METRIC_COMPARTMENT_OCID:?OCI_METRIC_COMPARTMENT_OCID is required}"
: "${OCI_COMPUTE_INSTANCE_OCID:?OCI_COMPUTE_INSTANCE_OCID is required}"

usage="$(df --output=pcent / | tail -n1 | tr -dc '0-9')"
[[ "${usage}" =~ ^[0-9]{1,3}$ ]] || { printf 'Could not determine filesystem usage\n' >&2; exit 1; }

metric_file="$(mktemp)"
trap 'rm -f -- "${metric_file}"' EXIT
printf '[{"namespace":"oioi_operations","compartmentId":"%s","name":"filesystem_usage_percent","dimensions":{"resourceId":"%s"},"datapoints":[{"timestamp":"%s","value":%s}]}]\n' \
  "${OCI_METRIC_COMPARTMENT_OCID}" "${OCI_COMPUTE_INSTANCE_OCID}" "$(date --utc +%Y-%m-%dT%H:%M:%SZ)" "${usage}" \
  >"${metric_file}"
oci monitoring metric-data post \
  --auth instance_principal \
  --region "${OCI_REGION}" \
  --metric-data "file://${metric_file}" >/dev/null
