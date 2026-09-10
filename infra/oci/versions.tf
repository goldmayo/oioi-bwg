terraform {
  required_version = "= 1.5.7"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 8.0.0, < 9.0.0"
    }
  }
}

provider "oci" {
  region = var.region
}
