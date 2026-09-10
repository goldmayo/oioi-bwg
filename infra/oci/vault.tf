resource "oci_kms_vault" "runtime" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.resource_prefix}-runtime"
  vault_type     = "DEFAULT"
  freeform_tags  = var.freeform_tags
}

resource "oci_kms_key" "runtime" {
  compartment_id      = var.compartment_ocid
  display_name        = "${var.resource_prefix}-runtime"
  management_endpoint = oci_kms_vault.runtime.management_endpoint
  protection_mode     = "SOFTWARE"
  freeform_tags       = var.freeform_tags

  key_shape {
    algorithm = "AES"
    length    = 32
  }
}

# Secret values are intentionally absent. Create and rotate them through a separate
# secure bootstrap process, then pass only their OCIDs in runtime_secret_ocids.
