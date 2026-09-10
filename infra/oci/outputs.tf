output "ocir_repository" {
  value       = "${local.ocir_registry_host}/${oci_artifacts_container_repository.application.namespace}/${oci_artifacts_container_repository.application.display_name}"
  description = "Set GitHub environment variables from this repository path; deployments add @sha256:digest."
}

output "vault_id" {
  value       = oci_kms_vault.runtime.id
  description = "Vault infrastructure for the separate runtime secret bootstrap process."
}

output "vault_key_id" {
  value       = oci_kms_key.runtime.id
  description = "KMS key for runtime secrets."
}

output "deployment_notification_topic_id" {
  value       = oci_ons_notification_topic.deployment.id
  description = "Attach the deployment Slack subscription manually so its token never enters Terraform state."
}

output "alert_notification_topic_id" {
  value       = oci_ons_notification_topic.alerts.id
  description = "Attach the infrastructure-alert Slack subscription manually so its token never enters Terraform state."
}

output "deployment_pipeline_id" {
  value       = oci_devops_deploy_pipeline.application.id
  description = "Start this pipeline manually with the required IMAGE_DIGEST parameter."
}

output "backup_bucket" {
  value = {
    name      = data.oci_objectstorage_bucket.postgres_backup.name
    namespace = data.oci_objectstorage_bucket.postgres_backup.namespace
  }
  description = "Existing host-managed PostgreSQL backup bucket referenced without Terraform ownership."
}
