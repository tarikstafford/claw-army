resource "google_compute_network" "claw_vpc" {
  name                    = "claw-vpc-${var.environment}"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "claw_subnet" {
  name          = "claw-subnet-${var.environment}"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.claw_vpc.id
  project       = var.project_id
}

resource "google_compute_global_address" "private_ip_range" {
  name          = "claw-private-ip-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.claw_vpc.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.claw_vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# ── Cloud NAT ─────────────────────────────────────────────────────────────────
# Bot VMs have no external IP. Cloud NAT gives them outbound internet access
# so the startup script can install Node.js, OpenClaw, and SecureClaw.
# Once running, all egress is proxied through the tool-gateway — NAT is only
# used during the ~3-minute startup installation phase.

resource "google_compute_router" "nat_router" {
  name    = "claw-nat-router-${var.environment}"
  network = google_compute_network.claw_vpc.id
  region  = var.region
  project = var.project_id
}

resource "google_compute_router_nat" "nat" {
  name                               = "claw-nat-${var.environment}"
  router                             = google_compute_router.nat_router.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
