output "external_ip" {
  description = "VM external IP address — set VITE_API_URL=http://<this>:3001 when building the UI"
  value       = google_compute_instance.app.network_interface[0].access_config[0].nat_ip
}

output "instance_name" {
  description = "GCE instance name"
  value       = google_compute_instance.app.name
}

output "service_account_email" {
  description = "App service account email"
  value       = google_service_account.app.email
}

output "ssh_command" {
  description = "gcloud SSH command to connect to the VM"
  value       = "gcloud compute ssh ${google_compute_instance.app.name} --zone=${google_compute_instance.app.zone} --project=${var.project_id}"
}
