output "ocir_repository" {
  value       = "${var.ocir_registry_host}/${oci_artifacts_container_repository.application.namespace}/${oci_artifacts_container_repository.application.display_name}"
  description = "Set GitHub environment variables from this repository path; deployments add @sha256:digest."
}

output "vault_id" {
  value       = oci_kms_vault.runtime.id
  description = "Vault infrastructure for the separate runtime secret bootstrap process."
}

output "vault_key_id" {
  value       = oci_kms_key.runtime.id
  description = "KMS key for runtime secrets and the backup bucket."
}

output "notification_topic_id" {
  value       = oci_ons_notification_topic.operations.id
  description = "Attach Slack subscriptions manually so webhook tokens never enter Terraform state."
}

output "deployment_pipeline_id" {
  value       = oci_devops_deploy_pipeline.application.id
  description = "Start this pipeline manually with the required IMAGE_DIGEST parameter."
}

output "backup_bucket" {
  value = {
    name      = oci_objectstorage_bucket.postgres_backup.name
    namespace = oci_objectstorage_bucket.postgres_backup.namespace
  }
}
