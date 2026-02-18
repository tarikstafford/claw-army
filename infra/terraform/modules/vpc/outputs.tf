output "network_id" {
  description = "VPC network ID (self_link)"
  value       = google_compute_network.claw_vpc.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.claw_vpc.name
}

output "subnet_name" {
  description = "Primary subnet name"
  value       = google_compute_subnetwork.claw_subnet.name
}
