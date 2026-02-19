# ── Service Account ─────────────────────────────────────────────────────────

resource "google_service_account" "app" {
  account_id   = "claw-app-${var.environment}"
  display_name = "Claw Army App (${var.environment})"
  project      = var.project_id
}

# ── IAM Bindings ─────────────────────────────────────────────────────────────

resource "google_project_iam_member" "artifact_registry_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.app.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# ── Firewall Rules ───────────────────────────────────────────────────────────

resource "google_compute_firewall" "allow_http" {
  name    = "claw-allow-http-${var.environment}"
  network = var.vpc_network_name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["80", "3001"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["claw-app"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "claw-allow-ssh-${var.environment}"
  network = var.vpc_network_name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = ["claw-app"]
}

# ── GCE Instance ─────────────────────────────────────────────────────────────

locals {
  # Extract just the region prefix for Artifact Registry auth
  # e.g. "us-central1-docker.pkg.dev/proj/repo" → "us-central1"
  registry_region = split("-docker.pkg.dev", var.registry_url)[0]
}

resource "google_compute_instance" "app" {
  name         = "claw-app-${var.environment}"
  machine_type = var.machine_type
  zone         = "${var.region}-a"
  project      = var.project_id

  tags = ["claw-app"]

  boot_disk {
    initialize_params {
      # Ubuntu 22.04 LTS — Docker-compatible, good package support
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 50  # GB — room for OS, Docker images, and bot container layers
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = var.vpc_network_name
    subnetwork = var.subnet_name

    # Ephemeral external IP for inbound traffic and outbound internet access
    access_config {}
  }

  service_account {
    email  = google_service_account.app.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    "google-logging-enabled"  = "true"
    "google-monitoring-agent" = "true"
  }

  metadata_startup_script = templatefile(
    "${path.module}/startup.sh.tpl",
    {
      db_host          = var.db_host
      db_name          = var.db_name
      db_user          = var.db_user
      redis_host       = var.redis_host
      redis_port       = var.redis_port
      registry_url     = var.registry_url
      registry_region  = local.registry_region
      project_id       = var.project_id
      environment      = var.environment
    }
  )

  # Allow stopping the instance for machine type changes
  allow_stopping_for_update = true
}
