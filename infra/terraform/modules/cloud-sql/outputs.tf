output "connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip" {
  description = "Private IP address of the Cloud SQL instance within the VPC"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = google_sql_database.clawdb.name
}

output "user_name" {
  description = "PostgreSQL application user name"
  value       = google_sql_user.clawapp.name
}

output "user_password" {
  description = "PostgreSQL application user password (sensitive)"
  value       = random_password.db_password.result
  sensitive   = true
}
