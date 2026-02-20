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

variable "machine_type" {
  description = "GCE machine type. e2-standard-2 handles ~12 concurrent bots. Scale up for more."
  type        = string
  default     = "e2-standard-2"
}

variable "vpc_network_name" {
  description = "VPC network name (from vpc module output)"
  type        = string
}

variable "subnet_name" {
  description = "Subnet name (from vpc module output)"
  type        = string
}

variable "db_host" {
  description = "Cloud SQL private IP (from cloud-sql module output)"
  type        = string
}

variable "db_name" {
  description = "Database name (from cloud-sql module output)"
  type        = string
}

variable "db_user" {
  description = "Database user (from cloud-sql module output)"
  type        = string
}

variable "redis_host" {
  description = "Memorystore Redis host (from memorystore module output)"
  type        = string
}

variable "redis_port" {
  description = "Memorystore Redis port (from memorystore module output)"
  type        = number
}

variable "registry_url" {
  description = "Artifact Registry Docker repository URL (from artifact-registry module output)"
  type        = string
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH to the VM. Restrict to your IP in production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "gcp_zone" {
  description = "Zone where bot VMs are provisioned (e.g. us-central1-a)"
  type        = string
}

variable "gcp_network" {
  description = "VPC network name for bot VMs"
  type        = string
}

variable "gcp_subnet" {
  description = "Subnet name for bot VMs"
  type        = string
}

variable "llm_api_key_secret_name" {
  description = "Secret Manager secret name containing the LLM API key for bot VMs"
  type        = string
  default     = "claw-anthropic-api-key"
}

variable "llm_provider" {
  description = "LLM provider for bot VMs (anthropic or openai)"
  type        = string
  default     = "anthropic"
}
