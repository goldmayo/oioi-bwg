variable "region" {
  description = "OCI service region. M9 production uses ap-osaka-1."
  type        = string

  validation {
    condition     = var.region == "ap-osaka-1"
    error_message = "M9 OCI resources must use the ap-osaka-1 service region."
  }
}

variable "tenancy_ocid" {
  description = "Tenancy OCID. IAM dynamic groups and their policy are tenancy-level resources."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment for newly managed M9 resources."
  type        = string
}

variable "compute_compartment_ocid" {
  description = "Compartment containing the existing application Compute instance."
  type        = string
}

variable "network_compartment_ocid" {
  description = "Compartment containing the existing subnet used by the Shell stage."
  type        = string
}

variable "secret_compartment_ocid" {
  description = "Compartment containing manually bootstrapped runtime secrets."
  type        = string
}

variable "compute_instance_ocid" {
  description = "Existing Ubuntu Compute instance OCID; this stack never creates or imports it."
  type        = string
}

variable "shell_subnet_ocid" {
  description = "Existing subnet OCID for the ephemeral OCI DevOps Shell stage container."
  type        = string
}

variable "shell_availability_domain" {
  description = "Availability domain for the Shell stage container instance."
  type        = string
}

variable "resource_prefix" {
  description = "Stable prefix for resources created by this stack."
  type        = string
  default     = "oioi-bwg"
}

variable "iam_identity_domain_name" {
  description = "Identity domain prefix for IAM policy principals; leave empty for tenancies without domains."
  type        = string
  default     = ""
}

variable "ocir_repository_name" {
  description = "Private immutable OCIR repository name."
  type        = string
  default     = "oioi-bwg"
}

variable "backup_bucket_name" {
  description = "Existing Object Storage bucket used by the host-managed PostgreSQL backup. This stack only looks it up."
  type        = string
}

variable "runtime_secret_ocids" {
  description = "Only runtime secret OCIDs the Compute principal may read; never include admin or migrator credentials."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for secret_ocid in var.runtime_secret_ocids : can(regex("^ocid1\\.vaultsecret\\.", secret_ocid))
    ])
    error_message = "runtime_secret_ocids must contain only OCI Vault secret OCIDs."
  }
}

variable "cpu_alarm_threshold" {
  type    = number
  default = 85
}

variable "memory_alarm_threshold" {
  type    = number
  default = 85
}

variable "filesystem_warning_threshold" {
  type    = number
  default = 80
}

variable "filesystem_critical_threshold" {
  type    = number
  default = 90
}

variable "freeform_tags" {
  description = "Non-sensitive tags applied to M9 resources."
  type        = map(string)
  default = {
    architecture = "m9"
    application  = "oioi-bwg"
    managed-by   = "resource-manager"
  }
}
