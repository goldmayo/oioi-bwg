locals {
  ocir_registry_host = "${var.region}.ocir.io"
}

resource "oci_artifacts_container_repository" "application" {
  compartment_id = var.compartment_ocid
  display_name   = var.ocir_repository_name
  is_public      = false
  freeform_tags  = var.freeform_tags
}

resource "oci_artifacts_container_repository" "console" {
  compartment_id = var.compartment_ocid
  display_name   = var.console_ocir_repository_name
  is_public      = false
  freeform_tags  = var.freeform_tags

  lifecycle {
    precondition {
      condition     = var.console_ocir_repository_name != var.ocir_repository_name
      error_message = "Web and Console repositories must differ."
    }
  }
}
