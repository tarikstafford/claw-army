variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "db_tier" {
  description = "Cloud SQL instance tier. db-f1-micro is cheapest dev option (~$7/mo)."
  type        = string
  default     = "db-f1-micro"
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory in GB. 1 is the minimum (~$16/mo)."
  type        = number
  default     = 1
}

variable "machine_type" {
  description = "GCE machine type. e2-standard-2 (2 vCPU, 8GB) handles ~12 concurrent bots."
  type        = string
  default     = "e2-standard-2"
}

variable "ssh_source_ranges" {
  description = "CIDR ranges allowed to SSH to the VM. Defaults to anywhere — restrict to your IP for production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "llm_api_key_secret_name" {
  description = "Secret Manager secret name containing the LLM API key injected into bot VMs"
  type        = string
  default     = "claw-anthropic-api-key"
}

variable "llm_provider" {
  description = "LLM provider for bot VMs (anthropic or openai)"
  type        = string
  default     = "anthropic"
}
