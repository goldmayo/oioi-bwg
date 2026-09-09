resource "oci_objectstorage_bucket" "postgres_backup" {
  compartment_id        = var.compartment_ocid
  namespace             = data.oci_objectstorage_namespace.tenancy.namespace
  name                  = var.backup_bucket_name
  access_type           = "NoPublicAccess"
  auto_tiering          = "InfrequentAccess"
  storage_tier          = "Standard"
  versioning            = "Enabled"
  kms_key_id            = oci_kms_key.runtime.id
  is_bucket_key_enabled = true
  object_events_enabled = true
  freeform_tags         = var.freeform_tags

  depends_on = [oci_identity_policy.runtime_and_deployment]
}
