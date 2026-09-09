resource "oci_ons_notification_topic" "deployment" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-deploy"
  description    = "OCI DevOps deployment events for the deployment Slack channel"
  freeform_tags  = var.freeform_tags
}

resource "oci_ons_notification_topic" "alerts" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-alerts"
  description    = "Infrastructure and backup alarms for the operations Slack channel"
  freeform_tags  = var.freeform_tags
}

# Slack subscription endpoints contain tokens and are intentionally configured
# outside Terraform so they never enter Resource Manager state.
