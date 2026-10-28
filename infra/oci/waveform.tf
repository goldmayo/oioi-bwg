# P08 provisioning only. This does not enable Console routes or install the Runner.
variable "waveform_queue_enabled" {
  description = "별도 승인 뒤 Queue/IAM을 생성합니다. 기본 비활성이며 runtime 활성화 flag가 아닙니다."
  type        = bool
  default     = false
}

variable "waveform_runner_secret_ocid" {
  description = "별도 bootstrap한 Runner 전용 Vault Secret OCID만 입력합니다. 토큰 원문은 금지합니다."
  type        = string
  default     = null

  validation {
    condition     = var.waveform_runner_secret_ocid == null || can(regex("^ocid1\\.vaultsecret\\.[a-z0-9.-]+$", var.waveform_runner_secret_ocid))
    error_message = "Provide only the dedicated Runner Vault Secret OCID, or null while disabled."
  }
}

resource "oci_queue_queue" "waveform" {
  count          = var.waveform_queue_enabled ? 1 : 0
  compartment_id = var.compartment_ocid
  display_name   = "${var.resource_prefix}-waveform"
  freeform_tags  = var.freeform_tags

  # DESIGN §6.3 staging candidates; retention is immutable after creation.
  retention_in_seconds             = 86400
  dead_letter_queue_delivery_count = 5
  visibility_in_seconds            = 180
  timeout_in_seconds               = 30

  lifecycle {
    prevent_destroy = true
  }
}

# Separate policy keeps existing runtime/deployment grants unchanged.
resource "oci_identity_policy" "waveform" {
  count          = var.waveform_queue_enabled ? 1 : 0
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_waveform_runtime"
  description    = "Exact waveform Queue push/pull and dedicated Runner Secret read for Compute"
  freeform_tags  = var.freeform_tags
  statements = [
    "Allow dynamic-group ${local.compute_principal} to use queue-push in compartment id ${var.compartment_ocid} where target.queue.id='${oci_queue_queue.waveform[0].id}'",
    "Allow dynamic-group ${local.compute_principal} to use queue-pull in compartment id ${var.compartment_ocid} where target.queue.id='${oci_queue_queue.waveform[0].id}'",
    "Allow dynamic-group ${local.compute_principal} to read secret-bundles in compartment id ${var.secret_compartment_ocid} where target.secret.id='${coalesce(var.waveform_runner_secret_ocid, "unconfigured")}'",
  ]

  lifecycle {
    precondition {
      condition     = var.waveform_runner_secret_ocid != null
      error_message = "Create the dedicated Runner Secret outside Terraform before enabling Queue provisioning."
    }
    precondition {
      condition     = !contains(concat(var.runtime_secret_ocids, local.console_secret_ocids), var.waveform_runner_secret_ocid)
      error_message = "Runner must not reuse an existing Web/Auth/MFA runtime Secret OCID."
    }
  }
}

output "waveform_queue" {
  description = "Approved provisioning yields fixed Runner settings; null while disabled. No credential values."
  value = var.waveform_queue_enabled ? {
    id                    = oci_queue_queue.waveform[0].id
    messages_endpoint     = oci_queue_queue.waveform[0].messages_endpoint
    retention_in_seconds  = oci_queue_queue.waveform[0].retention_in_seconds
    visibility_in_seconds = oci_queue_queue.waveform[0].visibility_in_seconds
    timeout_in_seconds    = oci_queue_queue.waveform[0].timeout_in_seconds
    max_delivery_attempts = oci_queue_queue.waveform[0].dead_letter_queue_delivery_count
  } : null
}
