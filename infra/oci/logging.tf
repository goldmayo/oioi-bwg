resource "oci_logging_log_group" "application" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.resource_prefix}-application"
  description    = "Centralized application container logs"
  freeform_tags  = var.freeform_tags
}

resource "oci_logging_log" "application" {
  display_name       = "${var.resource_prefix}-container-stdout"
  log_group_id       = oci_logging_log_group.application.id
  log_type           = "CUSTOM"
  is_enabled         = true
  retention_duration = 30
  freeform_tags      = var.freeform_tags
}

resource "oci_logging_unified_agent_configuration" "application" {
  compartment_id = var.compartment_ocid
  display_name   = "${var.resource_prefix}-docker-json"
  description    = "Tail Docker JSON logs from the exact application Compute instance"
  is_enabled     = true
  freeform_tags  = var.freeform_tags

  group_association {
    group_list = [oci_identity_dynamic_group.compute.id]
  }

  service_configuration {
    configuration_type = "LOGGING"

    destination {
      log_object_id = oci_logging_log.application.id
    }

    sources {
      source_type = "LOG_TAIL"
      name        = "docker-json"
      paths       = ["/var/lib/docker/containers/*/*-json.log"]

      parser {
        parser_type      = "JSON"
        field_time_key   = "time"
        time_type        = "string"
        time_format      = "%Y-%m-%dT%H:%M:%S.%NZ"
        is_keep_time_key = true
        parse_nested     = false
      }
    }
  }

  depends_on = [oci_identity_policy.runtime_and_deployment]
}
