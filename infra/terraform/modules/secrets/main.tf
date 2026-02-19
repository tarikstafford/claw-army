resource "google_secret_manager_secret" "db_password" {
  secret_id = "claw-db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = var.db_password
}

# Placeholder secrets — populate manually after terraform apply:
#   gcloud secrets versions add claw-openai-api-key --data-file=-
#   gcloud secrets versions add claw-anthropic-api-key --data-file=-

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "claw-openai-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  lifecycle {
    ignore_changes = [labels]
  }
}

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "claw-anthropic-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  lifecycle {
    ignore_changes = [labels]
  }
}
