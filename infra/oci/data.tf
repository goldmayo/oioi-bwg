data "oci_objectstorage_namespace" "tenancy" {
  compartment_id = var.tenancy_ocid
}

data "oci_core_instance" "application" {
  instance_id = var.compute_instance_ocid
}

data "oci_core_subnet" "shell" {
  subnet_id = var.shell_subnet_ocid
}

check "existing_resource_compartments" {
  assert {
    condition     = data.oci_core_instance.application.compartment_id == var.compute_compartment_ocid
    error_message = "compute_instance_ocid is not in compute_compartment_ocid."
  }

  assert {
    condition     = data.oci_core_subnet.shell.compartment_id == var.network_compartment_ocid
    error_message = "shell_subnet_ocid is not in network_compartment_ocid."
  }
}
