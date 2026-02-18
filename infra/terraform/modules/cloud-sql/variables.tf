variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "vpc_network_id" {
  description = "VPC network self_link for private IP configuration"
  type        = string
}

variable "vpc_network_name" {
  description = "VPC network name"
  type        = string
}
