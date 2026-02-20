/**
 * bot-vm module — ephemeral GCE instance for a single bot.
 *
 * NOTE: This Terraform module is provided for reference and for provisioning
 * static infrastructure (firewall rules, service accounts). Ephemeral bot VMs
 * are created at runtime via the Compute Engine API in gce-bot-launcher.ts,
 * NOT via Terraform. The startup.sh.tpl is shared between both.
 *
 * Static resources created by this module:
 *   - Firewall rule: allow port 18789 from execution-service tag to claw-bot-vm tag
 *   - (Instance creation is handled by gce-bot-launcher.ts at runtime)
 */

locals {
  instance_name = "bot-${substr(var.bot_id, 0, 8)}-${var.instance_suffix}"
  region        = join("-", slice(split("-", var.zone), 0, length(split("-", var.zone)) - 1))
}

# ── Ephemeral bot VM instance ─────────────────────────────────────────────────
# NOTE: This resource is for documentation/testing only.
# Production ephemeral VMs are created via gce-bot-launcher.ts (Compute Engine API).
resource "google_compute_instance" "bot_vm" {
  name         = local.instance_name
  machine_type = var.machine_type
  zone         = var.zone
  project      = var.project_id

  boot_disk {
    initialize_params {
      image = "projects/ubuntu-os-cloud/global/images/family/ubuntu-2204-lts"
      size  = 30
      type  = "pd-balanced"
    }
    auto_delete = true
  }

  network_interface {
    network    = var.vpc_network_name
    subnetwork = "projects/${var.project_id}/regions/${local.region}/subnetworks/${var.subnet_name}"
    # No access_config block = no external IP.
    # Egress routes through Cloud NAT or the Tool Gateway proxy.
  }

  metadata = {
    startup-script = templatefile("${path.module}/startup.sh.tpl", {
      bot_id                  = var.bot_id
      execution_id            = var.execution_id
      llm_provider            = var.llm_provider
      llm_api_key_secret_name = var.llm_api_key_secret_name
      tool_gateway_url        = var.tool_gateway_url
      execution_service_url   = var.execution_service_url
    })
  }

  labels = {
    managed-by   = "claw-army"
    bot-id       = substr(replace(var.bot_id, "-", ""), 0, 8)
    execution-id = substr(replace(var.execution_id, "-", ""), 0, 8)
  }

  # Tag used by the firewall rule to allow only execution-service to reach port 18789
  tags = ["claw-bot-vm"]

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  # Shielded VM options for additional security
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  lifecycle {
    # Bot VMs are ephemeral — recreate rather than update in place
    create_before_destroy = false
  }
}

# ── Firewall rule: allow execution-service → bot VMs on port 18789 ────────────
resource "google_compute_firewall" "allow_openclaw_gateway" {
  name    = "allow-openclaw-gateway-${substr(replace(var.execution_id, "-", ""), 0, 8)}"
  network = var.vpc_network_name
  project = var.project_id

  description = "Allow execution-service to reach OpenClaw Gateway (port 18789) on bot VMs"

  allow {
    protocol = "tcp"
    ports    = ["18789"]
  }

  # Source: VMs tagged as execution-service
  source_tags = ["execution-service"]

  # Target: VMs tagged as claw-bot-vm
  target_tags = ["claw-bot-vm"]
}
