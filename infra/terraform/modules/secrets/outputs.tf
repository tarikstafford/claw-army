output "db_password_secret_name" {
  description = "Secret Manager secret name for the database password"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "openai_secret_name" {
  description = "Secret Manager secret name for OpenAI API key (populate manually)"
  value       = google_secret_manager_secret.openai_api_key.secret_id
}

output "anthropic_secret_name" {
  description = "Secret Manager secret name for Anthropic API key (populate manually)"
  value       = google_secret_manager_secret.anthropic_api_key.secret_id
}
