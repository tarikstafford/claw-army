resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "postgres" {
  name             = "claw-postgres-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region
  project          = var.project_id

  # Set deletion_protection = false for dev. In Terraform google provider 7.x,
  # deletion_protection defaults to true and will block `terraform destroy`.
  deletion_protection = false

  settings {
    tier    = var.db_tier
    edition = "ENTERPRISE"

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }

    insights_config {
      query_insights_enabled = true
    }
  }
}

resource "google_sql_database" "clawdb" {
  name     = "clawdb"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

resource "google_sql_user" "clawapp" {
  name     = "clawapp"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}
