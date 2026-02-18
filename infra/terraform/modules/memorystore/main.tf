resource "google_redis_instance" "claw_redis" {
  name           = "claw-redis-${var.environment}"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  project        = var.project_id

  # Redis 7.x
  redis_version = "REDIS_7_0"

  # BASIC tier (no replication) — adequate for dev, use STANDARD_HA for prod
  tier = "BASIC"

  # Memorystore has NO public IP — it is only accessible within the authorized VPC.
  # This is by design. Local dev uses Docker redis:7 instead.
  # The connectivity check for Memorystore runs from a GCE VM within the VPC.
  authorized_network = "projects/${var.project_id}/global/networks/${var.vpc_network_name}"

  # Enable in-transit encryption for production workloads
  transit_encryption_mode = "DISABLED"
}
