output "instance_name" {
  description = "GCE instance name of the bot VM"
  value       = google_compute_instance.bot_vm.name
}

output "self_link" {
  description = "Self-link URL of the GCE instance"
  value       = google_compute_instance.bot_vm.self_link
}
