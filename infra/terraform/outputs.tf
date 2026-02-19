output "db_connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Auth Proxy"
  value       = module.cloud_sql.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP address within the VPC"
  value       = module.cloud_sql.private_ip
}

output "db_database_name" {
  description = "PostgreSQL database name"
  value       = module.cloud_sql.database_name
}

output "db_user_name" {
  description = "PostgreSQL application user name"
  value       = module.cloud_sql.user_name
}

output "db_password" {
  description = "PostgreSQL application user password (sensitive)"
  value       = module.cloud_sql.user_password
  sensitive   = true
}

output "redis_host" {
  description = "Memorystore Redis host (VPC-only)"
  value       = module.memorystore.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = module.memorystore.port
}

output "pubsub_topic_names" {
  description = "Map of Pub/Sub topic logical names to full GCP topic names"
  value       = module.pubsub.topic_names
}

output "pubsub_subscription_names" {
  description = "Map of Pub/Sub subscription logical names to full GCP subscription names"
  value       = module.pubsub.subscription_names
}

output "artifact_registry_url" {
  description = "Artifact Registry Docker repository URL"
  value       = module.artifact_registry.repository_url
}

output "vm_external_ip" {
  description = "GCE VM external IP — use this for VITE_API_URL when building the UI"
  value       = module.compute.external_ip
}

output "vm_ssh_command" {
  description = "gcloud SSH command to connect to the VM"
  value       = module.compute.ssh_command
}

output "secret_names" {
  description = "Secret Manager secret names to populate with API keys after apply"
  value = {
    db_password    = module.secrets.db_password_secret_name
    openai_api_key = module.secrets.openai_secret_name
    anthropic_key  = module.secrets.anthropic_secret_name
  }
}
