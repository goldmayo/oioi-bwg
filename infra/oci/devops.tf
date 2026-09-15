resource "oci_devops_project" "application" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-deployment"
  description    = "Retained OCI DevOps project; GitHub Actions now owns deployment execution"
  freeform_tags  = var.freeform_tags

  notification_config {
    topic_id = oci_ons_notification_topic.deployment.id
  }
}

resource "oci_devops_deploy_pipeline" "application" {
  project_id    = oci_devops_project.application.id
  display_name  = "${var.resource_prefix}-release"
  description   = "Retained for deployment history only; no billable Shell stage is attached"
  freeform_tags = var.freeform_tags

  deploy_pipeline_parameters {
    items {
      name        = "IMAGE_DIGEST"
      description = "Historical release parameter; active CD is owned by GitHub Actions"
    }
  }
}
