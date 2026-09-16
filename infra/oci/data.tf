data "oci_objectstorage_namespace" "tenancy" {
  compartment_id = var.tenancy_ocid
}

data "oci_objectstorage_bucket" "postgres_backup" {
  name      = var.backup_bucket_name
  namespace = data.oci_objectstorage_namespace.tenancy.namespace
}

data "oci_core_instance" "application" {
  instance_id = var.compute_instance_ocid
}

check "existing_resource_compartments" {
  assert {
    condition     = data.oci_core_instance.application.compartment_id == var.compute_compartment_ocid
    error_message = "compute_instance_ocid is not in compute_compartment_ocid."
  }
}
