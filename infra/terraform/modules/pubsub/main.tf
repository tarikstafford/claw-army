locals {
  # Event topics for all claw-army event types
  topics = [
    "bot-lifecycle",
    "execution-lifecycle",
    "task-lifecycle",
    "guardrail-events",
    "billing-events",
  ]
}

# Dead-letter topic (must be created before subscriptions reference it)
resource "google_pubsub_topic" "dead_letter" {
  name    = "dead-letter-${var.environment}"
  project = var.project_id
}

# Individual topic resources (using explicit resources for clear naming and outputs)
resource "google_pubsub_topic" "bot_lifecycle" {
  name    = "bot-lifecycle-${var.environment}"
  project = var.project_id
}

resource "google_pubsub_topic" "execution_lifecycle" {
  name    = "execution-lifecycle-${var.environment}"
  project = var.project_id
}

resource "google_pubsub_topic" "task_lifecycle" {
  name    = "task-lifecycle-${var.environment}"
  project = var.project_id
}

resource "google_pubsub_topic" "guardrail_events" {
  name    = "guardrail-events-${var.environment}"
  project = var.project_id
}

resource "google_pubsub_topic" "billing_events" {
  name    = "billing-events-${var.environment}"
  project = var.project_id
}

# Subscriptions with dead-letter and retry policies

resource "google_pubsub_subscription" "bot_lifecycle_sub" {
  name    = "bot-lifecycle-sub-${var.environment}"
  topic   = google_pubsub_topic.bot_lifecycle.name
  project = var.project_id

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}

resource "google_pubsub_subscription" "execution_lifecycle_sub" {
  name    = "execution-lifecycle-sub-${var.environment}"
  topic   = google_pubsub_topic.execution_lifecycle.name
  project = var.project_id

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}

resource "google_pubsub_subscription" "task_lifecycle_sub" {
  name    = "task-lifecycle-sub-${var.environment}"
  topic   = google_pubsub_topic.task_lifecycle.name
  project = var.project_id

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}

resource "google_pubsub_subscription" "guardrail_events_sub" {
  name    = "guardrail-events-sub-${var.environment}"
  topic   = google_pubsub_topic.guardrail_events.name
  project = var.project_id

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}

resource "google_pubsub_subscription" "billing_events_sub" {
  name    = "billing-events-sub-${var.environment}"
  topic   = google_pubsub_topic.billing_events.name
  project = var.project_id

  ack_deadline_seconds = 30

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }
}
