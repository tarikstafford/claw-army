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
  description = "Memorystore Redis host (VPC-only, not publicly accessible)"
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
  description = "Artifact Registry Docker repository URL for bot container images"
  value       = module.artifact_registry.repository_url
}
