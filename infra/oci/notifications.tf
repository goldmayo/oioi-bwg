resource "oci_ons_notification_topic" "alerts" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-alerts"
  description    = "Infrastructure alarms for the operations Slack channel"
  freeform_tags  = var.freeform_tags
}

# Slack subscription endpoints contain tokens and are intentionally configured
# outside Terraform so they never enter Resource Manager state.
