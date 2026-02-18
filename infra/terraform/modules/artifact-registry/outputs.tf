output "repository_url" {
  description = "Artifact Registry Docker repository URL (region-docker.pkg.dev/project/repo)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.claw_bots.repository_id}"
}

output "repository_id" {
  description = "Artifact Registry repository ID"
  value       = google_artifact_registry_repository.claw_bots.repository_id
}
