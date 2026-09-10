resource "oci_devops_project" "application" {
  compartment_id = var.compartment_ocid
  name           = "${var.resource_prefix}-deployment"
  description    = "Digest-pinned deployment to the existing Ubuntu Compute instance"
  freeform_tags  = var.freeform_tags

  notification_config {
    topic_id = oci_ons_notification_topic.deployment.id
  }
}

resource "oci_devops_deploy_pipeline" "application" {
  project_id    = oci_devops_project.application.id
  display_name  = "${var.resource_prefix}-release"
  description   = "Manual release gate; IMAGE_DIGEST is the sole release identity"
  freeform_tags = var.freeform_tags

  deploy_pipeline_parameters {
    items {
      name        = "IMAGE_DIGEST"
      description = "Required sha256 OCIR manifest digest without repository prefix"
    }
  }
}

resource "oci_devops_deploy_artifact" "command_spec" {
  project_id                 = oci_devops_project.application.id
  display_name               = "${var.resource_prefix}-run-command"
  description                = "Secret-free Shell stage command specification"
  deploy_artifact_type       = "COMMAND_SPEC"
  argument_substitution_mode = "NONE"
  freeform_tags              = var.freeform_tags

  deploy_artifact_source {
    deploy_artifact_source_type = "INLINE"
    base64encoded_content = base64encode(templatefile("${path.module}/command-spec.yaml.tftpl", {
      compute_compartment_ocid = var.compute_compartment_ocid
      compute_instance_ocid    = var.compute_instance_ocid
      alert_topic_id           = oci_ons_notification_topic.alerts.id
    }))
  }
}

resource "oci_devops_deploy_stage" "run_command" {
  deploy_pipeline_id              = oci_devops_deploy_pipeline.application.id
  deploy_stage_type               = "SHELL"
  display_name                    = "${var.resource_prefix}-compute-run-command"
  description                     = "Issue a secret-free Run Command and wait for host deployment"
  command_spec_deploy_artifact_id = oci_devops_deploy_artifact.command_spec.id
  timeout_in_seconds              = 2100
  freeform_tags                   = var.freeform_tags

  deploy_stage_predecessor_collection {
    items {
      id = oci_devops_deploy_pipeline.application.id
    }
  }

  container_config {
    container_config_type = "CONTAINER_INSTANCE_CONFIG"
    shape_name            = "CI.Standard.E4.Flex"
    compartment_id        = var.compartment_ocid
    availability_domain   = var.shell_availability_domain

    shape_config {
      ocpus         = 1
      memory_in_gbs = 2
    }

    network_channel {
      network_channel_type = "SERVICE_VNIC_CHANNEL"
      subnet_id            = var.shell_subnet_ocid
      nsg_ids              = []
    }
  }

  depends_on = [oci_identity_policy.runtime_and_deployment]
}
