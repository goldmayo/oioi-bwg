resource "oci_ons_notification_topic" "operations" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-operations"
  description    = "OCI DevOps deployment events and infrastructure alarms"
  freeform_tags  = var.freeform_tags
}

# Slack subscription endpoints contain a token and are intentionally configured
# outside Terraform so they never enter Resource Manager state.
