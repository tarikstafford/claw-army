output "topic_names" {
  description = "Map of logical topic names to GCP Pub/Sub topic IDs"
  value = {
    bot_lifecycle       = google_pubsub_topic.bot_lifecycle.name
    execution_lifecycle = google_pubsub_topic.execution_lifecycle.name
    task_lifecycle      = google_pubsub_topic.task_lifecycle.name
    guardrail_events    = google_pubsub_topic.guardrail_events.name
    billing_events      = google_pubsub_topic.billing_events.name
    dead_letter         = google_pubsub_topic.dead_letter.name
  }
}

output "subscription_names" {
  description = "Map of logical subscription names to GCP Pub/Sub subscription IDs"
  value = {
    bot_lifecycle       = google_pubsub_subscription.bot_lifecycle_sub.name
    execution_lifecycle = google_pubsub_subscription.execution_lifecycle_sub.name
    task_lifecycle      = google_pubsub_subscription.task_lifecycle_sub.name
    guardrail_events    = google_pubsub_subscription.guardrail_events_sub.name
    billing_events      = google_pubsub_subscription.billing_events_sub.name
  }
}
