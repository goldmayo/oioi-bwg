locals {
  ocir_registry_host = "${var.region}.ocir.io"
}

resource "oci_artifacts_container_repository" "application" {
  compartment_id = var.compartment_ocid
  display_name   = var.ocir_repository_name
  is_immutable   = true
  is_public      = false
  freeform_tags  = var.freeform_tags
}
