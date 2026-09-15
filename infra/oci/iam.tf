resource "oci_identity_dynamic_group" "compute" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_compute"
  description    = "Exact application Compute instance principal for M9 runtime operations"
  matching_rule  = "ALL {instance.id = '${var.compute_instance_ocid}'}"
}

resource "oci_identity_group" "github_deploy" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_github_deploy"
  description    = "Least-privilege GitHub Actions group for issuing and reading OCI Run Commands"
}

locals {
  compute_principal       = var.iam_identity_domain_name == "" ? oci_identity_dynamic_group.compute.name : "${var.iam_identity_domain_name}/${oci_identity_dynamic_group.compute.name}"
  github_deploy_principal = var.iam_identity_domain_name == "" ? oci_identity_group.github_deploy.name : "${var.iam_identity_domain_name}/${oci_identity_group.github_deploy.name}"

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

  github_deploy_policy_statements = [
    "Allow group ${local.github_deploy_principal} to use instance-agent-command-family in compartment id ${var.compute_compartment_ocid}",
  ]
}

resource "oci_identity_policy" "runtime_and_deployment" {
  compartment_id = var.tenancy_ocid
  name           = "${replace(var.resource_prefix, "-", "_")}_runtime_deployment"
  description    = "Least-privilege Compute runtime and GitHub Run Command permissions for M9"
  statements = concat(
    local.compute_policy_statements,
    local.github_deploy_policy_statements,
  )
  freeform_tags = var.freeform_tags
}
