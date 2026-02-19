variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "db_password" {
  description = "Cloud SQL database password (from cloud-sql module output)"
  type        = string
  sensitive   = true
}
