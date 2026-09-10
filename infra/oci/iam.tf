resource "oci_identity_dynamic_group" "compute" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_compute"
  description    = "Exact application Compute instance principal for M9 runtime operations"
  matching_rule  = "ALL {instance.id = '${var.compute_instance_ocid}'}"
}

resource "oci_identity_dynamic_group" "devops" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_devops"
  description    = "Exact OCI DevOps deployment pipeline resource principal"
  matching_rule  = "ALL {resource.type = 'devopsdeploypipeline', resource.id = '${oci_devops_deploy_pipeline.application.id}'}"
}

locals {
  compute_principal = var.iam_identity_domain_name == "" ? oci_identity_dynamic_group.compute.name : "${var.iam_identity_domain_name}/${oci_identity_dynamic_group.compute.name}"
  devops_principal  = var.iam_identity_domain_name == "" ? oci_identity_dynamic_group.devops.name : "${var.iam_identity_domain_name}/${oci_identity_dynamic_group.devops.name}"

  compute_policy_statements = concat(
    [
      "Allow dynamic-group ${local.compute_principal} to read repos in compartment id ${var.compartment_ocid} where target.repo.name='${var.ocir_repository_name}'",
      "Allow dynamic-group ${local.compute_principal} to use metrics in compartment id ${var.compute_compartment_ocid}",
      "Allow dynamic-group ${local.compute_principal} to use log-content in compartment id ${var.compartment_ocid}",
      "Allow dynamic-group ${local.compute_principal} to use instance-agent-command-execution-family in compartment id ${var.compute_compartment_ocid} where request.instance.id=target.instance.id",
    ],
    [
      for secret_ocid in var.runtime_secret_ocids :
      "Allow dynamic-group ${local.compute_principal} to read secret-bundles in compartment id ${var.secret_compartment_ocid} where target.secret.id='${secret_ocid}'"
    ],
  )

  devops_policy_statements = [
    "Allow dynamic-group ${local.devops_principal} to manage compute-container-instances in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to manage compute-containers in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to use vnics in compartment id ${var.network_compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to use subnets in compartment id ${var.network_compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to use dhcp-options in compartment id ${var.network_compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to read instance-family in compartment id ${var.compute_compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to use instance-agent-command-family in compartment id ${var.compute_compartment_ocid}",
    "Allow dynamic-group ${local.devops_principal} to use ons-topics in compartment id ${var.compartment_ocid}",
  ]

}

resource "oci_identity_policy" "runtime_and_deployment" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_runtime_deployment"
  description    = "Least-privilege Compute and OCI DevOps permissions for M9"
  statements = concat(
    local.compute_policy_statements,
    local.devops_policy_statements,
  )
  freeform_tags = var.freeform_tags
}
