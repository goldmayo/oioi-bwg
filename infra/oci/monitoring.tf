locals {
  alarm_common = {
    compartment_id        = var.compartment_ocid
    destinations          = [oci_ons_notification_topic.alerts.id]
    is_enabled            = true
    metric_compartment_id = var.compute_compartment_ocid
  }
}

resource "oci_monitoring_alarm" "cpu" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-cpu-high"
  namespace             = "oci_computeagent"
  query                 = "CpuUtilization[5m]{resourceId = \"${var.compute_instance_ocid}\"}.mean() > ${var.cpu_alarm_threshold}"
  severity              = "WARNING"
  pending_duration      = "PT15M"
  body                  = "Sustained CPU utilization is above the M9 baseline. Inspect workload and deployment history."
  freeform_tags         = var.freeform_tags
}

resource "oci_monitoring_alarm" "memory" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-memory-high"
  namespace             = "oci_computeagent"
  query                 = "MemoryUtilization[5m]{resourceId = \"${var.compute_instance_ocid}\"}.mean() > ${var.memory_alarm_threshold}"
  severity              = "WARNING"
  pending_duration      = "PT15M"
  body                  = "Sustained memory utilization is above the M9 baseline. Inspect containers and PostgreSQL."
  freeform_tags         = var.freeform_tags
}

resource "oci_monitoring_alarm" "instance_health" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-instance-unhealthy"
  namespace             = "oci_compute_infrastructure_health"
  query                 = "instance_status[1m]{resourceId = \"${var.compute_instance_ocid}\"}.max() > 0"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "OCI reports the application Compute instance as unhealthy. Follow the M9 incident runbook."
  freeform_tags         = var.freeform_tags
}

resource "oci_monitoring_alarm" "filesystem" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-filesystem-warning"
  namespace             = "oioi_operations"
  query                 = "filesystem_usage_percent[5m]{resourceId = \"${var.compute_instance_ocid}\"}.max() >= ${var.filesystem_warning_threshold}"
  severity              = "WARNING"
  pending_duration      = "PT5M"
  body                  = "Filesystem usage is high. Inspect PostgreSQL growth, Docker layers, logs, and backup artifacts; never auto-prune."
  freeform_tags         = var.freeform_tags
}

resource "oci_monitoring_alarm" "filesystem_critical" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-filesystem-critical"
  namespace             = "oioi_operations"
  query                 = "filesystem_usage_percent[5m]{resourceId = \"${var.compute_instance_ocid}\"}.max() >= ${var.filesystem_critical_threshold}"
  severity              = "CRITICAL"
  pending_duration      = "PT5M"
  body                  = "Filesystem usage is critical. Stop nonessential writes and follow the M9 incident runbook; never auto-prune."
  freeform_tags         = var.freeform_tags
}

resource "oci_monitoring_alarm" "backup_failure" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-backup-failed"
  namespace             = "oioi_operations"
  query                 = "backup_failure[5m]{resourceId = \"${var.compute_instance_ocid}\"}.sum() > 0"
  severity              = "CRITICAL"
  pending_duration      = "PT1M"
  body                  = "PostgreSQL backup upload or local validation failed. Inspect the backup systemd unit and Object Storage."
  freeform_tags         = var.freeform_tags
}


resource "oci_monitoring_alarm" "backup_missing" {
  compartment_id        = local.alarm_common.compartment_id
  destinations          = local.alarm_common.destinations
  is_enabled            = local.alarm_common.is_enabled
  metric_compartment_id = local.alarm_common.metric_compartment_id
  display_name          = "${var.resource_prefix}-backup-missing"
  namespace             = "oioi_operations"
  query                 = "backup_success[1h]{resourceId = \"${var.compute_instance_ocid}\"}.absent(26h)"
  severity              = "CRITICAL"
  pending_duration      = "PT1M"
  body                  = "No successful PostgreSQL backup metric was received for 26 hours. Inspect the timer and Object Storage."
  freeform_tags         = var.freeform_tags
}
