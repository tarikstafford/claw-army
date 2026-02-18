resource "google_artifact_registry_repository" "claw_bots" {
  location      = var.region
  repository_id = "claw-bots-${var.environment}"
  format        = "DOCKER"
  project       = var.project_id

  description = "Docker repository for claw-army bot container images (${var.environment})"
}
