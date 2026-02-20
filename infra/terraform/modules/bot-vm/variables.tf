variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "zone" {
  description = "GCP zone for the bot VM (e.g. us-central1-a)"
  type        = string
}

variable "bot_id" {
  description = "UUID of the bot (used for naming and labelling)"
  type        = string
}

variable "execution_id" {
  description = "UUID of the parent execution"
  type        = string
}

variable "instance_suffix" {
  description = "Unique suffix to append to instance name (e.g. epoch timestamp)"
  type        = string
}

variable "machine_type" {
  description = "GCE machine type — e2-standard-2 gives 2 vCPU + 8 GB for Chromium"
  type        = string
  default     = "e2-standard-2"
}

variable "vpc_network_name" {
  description = "VPC network name (must be in the same project)"
  type        = string
}

variable "subnet_name" {
  description = "Subnetwork name within the VPC"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for the bot VM (needs Secret Manager + Logging access)"
  type        = string
}

variable "llm_provider" {
  description = "LLM provider name passed to OpenClaw config (e.g. 'openai', 'anthropic')"
  type        = string
  default     = "anthropic"
}

variable "llm_api_key_secret_name" {
  description = "Secret Manager secret name containing the LLM API key"
  type        = string
}

variable "tool_gateway_url" {
  description = "Internal URL of the tool-gateway (e.g. 10.0.0.5:3002)"
  type        = string
}

variable "execution_service_url" {
  description = "Internal URL of the execution-service (e.g. http://10.0.0.4:3001)"
  type        = string
}
