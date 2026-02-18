output "host" {
  description = "Memorystore Redis host (VPC-internal, not publicly accessible)"
  value       = google_redis_instance.claw_redis.host
}

output "port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.claw_redis.port
}

output "redis_url" {
  description = "Redis URL for use within the VPC (redis://host:port)"
  value       = "redis://${google_redis_instance.claw_redis.host}:${google_redis_instance.claw_redis.port}"
}
