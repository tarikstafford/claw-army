---
phase: 01-data-foundation
plan: 03
subsystem: infra
tags: [terraform, gcp, cloud-sql, memorystore, pubsub, artifact-registry, vpc, docker-compose, typescript, ioredis, pg, connectivity]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-01
    provides: pnpm monorepo workspace with packages/* and scripts workspace path

provides:
  - Terraform modules for all 5 GCP resources (VPC, Cloud SQL PostgreSQL 16, Memorystore Redis 7, Pub/Sub x5 topics, Artifact Registry)
  - infra/terraform root config validated via terraform init + validate + fmt
  - docker-compose.dev.yml providing local PostgreSQL 16 + Redis 7 + Pub/Sub emulator
  - scripts/connectivity-check.ts validating PostgreSQL, Redis, and Pub/Sub reachability
  - Pending: GCP resources provisioned after user runs terraform apply (checkpoint)

affects: [02-orchestration, 03-tool-gateway, 04-metering, 05-frontend, 06-dna]

# Tech tracking
tech-stack:
  added:
    - terraform 1.5.7 (installed via homebrew — was missing from dev machine)
    - hashicorp/google ~>7.19 (GCP Terraform provider)
    - hashicorp/random ~>3.6 (password generation)
    - pg@^8.18.0 (scripts workspace PostgreSQL client)
    - ioredis@^5.9.3 (scripts workspace Redis client)
    - @google-cloud/pubsub@^5.2.3 (scripts workspace Pub/Sub client)
    - tsx@^4.19.0 (scripts workspace TypeScript executor)
  patterns:
    - Modular Terraform: one directory per GCP service (vpc, cloud-sql, memorystore, pubsub, artifact-registry)
    - deletion_protection = false on Cloud SQL for dev — required for terraform destroy to work (provider 7.x changed the default to true)
    - Memorystore has NO public IP by design — local dev uses Docker redis:7, GCP Redis is VPC-only
    - Pub/Sub dead-letter pattern: every topic has a subscription pointing to dead-letter topic, max 5 delivery attempts
    - Connectivity check: Promise.allSettled so one failure does not block others; exit 0 if all non-skipped pass

key-files:
  created:
    - infra/terraform/versions.tf (provider version constraints: google ~>7.19, random ~>3.6)
    - infra/terraform/variables.tf (project_id, region, environment, db_tier, redis_memory_size_gb)
    - infra/terraform/main.tf (root module wiring — vpc -> cloud_sql+memorystore+pubsub+artifact_registry)
    - infra/terraform/outputs.tf (db connection_name, private_ip, redis host/port, pubsub topic/sub names, artifact registry URL)
    - infra/terraform/terraform.tfvars.example (template with annotated placeholder values)
    - infra/terraform/.gitignore (excludes .terraform/, *.tfstate, terraform.tfvars, *.tfplan)
    - infra/terraform/.terraform.lock.hcl (provider lock file — committed for reproducibility)
    - infra/terraform/modules/vpc/main.tf (VPC + subnet + private IP range + private services access)
    - infra/terraform/modules/vpc/variables.tf
    - infra/terraform/modules/vpc/outputs.tf (network_id, network_name, subnet_name)
    - infra/terraform/modules/cloud-sql/main.tf (PostgreSQL 16, private IP only, deletion_protection=false, random_password)
    - infra/terraform/modules/cloud-sql/variables.tf
    - infra/terraform/modules/cloud-sql/outputs.tf (connection_name, private_ip, database_name, user_name, user_password sensitive)
    - infra/terraform/modules/memorystore/main.tf (Redis 7.0 BASIC tier, VPC-authorized network)
    - infra/terraform/modules/memorystore/variables.tf
    - infra/terraform/modules/memorystore/outputs.tf (host, port, redis_url)
    - infra/terraform/modules/pubsub/main.tf (5 topics + dead-letter topic + 5 subscriptions with retry/DLQ policy)
    - infra/terraform/modules/pubsub/variables.tf
    - infra/terraform/modules/pubsub/outputs.tf (topic_names map, subscription_names map)
    - infra/terraform/modules/artifact-registry/main.tf (Docker format repo claw-bots-{env})
    - infra/terraform/modules/artifact-registry/variables.tf
    - infra/terraform/modules/artifact-registry/outputs.tf (repository_url)
    - docker-compose.dev.yml (postgres:16-alpine + redis:7-alpine + gcr.io pubsub emulator with healthchecks)
    - scripts/package.json (@claw/scripts workspace with pg, ioredis, @google-cloud/pubsub)
    - scripts/tsconfig.json (extends tsconfig.base.json)
    - scripts/connectivity-check.ts (--local flag, colored output, Promise.allSettled, exit codes)
  modified:
    - pnpm-lock.yaml (scripts workspace dependencies added)

key-decisions:
  - "deletion_protection = false on Cloud SQL: Terraform google provider 7.x changed the default to true. Without explicit false, terraform destroy is blocked in dev — a foot-gun. Explicitly set for dev environment."
  - "Memorystore VPC-only by design: Memorystore has no public IP. Local dev uses Docker redis:7 on port 6379. Connectivity check for Memorystore only runs from within the GCP VPC (GCE VM). This is documented in the script output."
  - "Pub/Sub dead-letter + retry policy on all subscriptions: every subscription points to the dead-letter topic with max 5 delivery attempts and exponential backoff (10s min, 300s max). Ensures no silent message loss in production."
  - "Promise.allSettled in connectivity check: each infrastructure check runs independently — a PostgreSQL failure does not prevent Redis or Pub/Sub checks from running. Script provides complete picture of infrastructure health."

patterns-established:
  - "Terraform module pattern: each GCP service is its own module (vpc, cloud-sql, memorystore, pubsub, artifact-registry) with main.tf/variables.tf/outputs.tf. Root main.tf wires modules with explicit depends_on."
  - "Connectivity check pattern: checks read from env vars, SKIP if not set (not FAIL), so partial infrastructure still gives useful output"
  - "Infrastructure naming pattern: all GCP resources named {service}-{environment} (e.g., claw-vpc-dev, claw-postgres-dev). Supports multiple environments from the same Terraform config."

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 1 Plan 03: GCP Infrastructure Terraform Modules Summary

**Modular Terraform config for VPC + Cloud SQL PostgreSQL 16 + Memorystore Redis 7 + Pub/Sub (5 topics + DLQ) + Artifact Registry, plus docker-compose.dev.yml and TypeScript connectivity check script validated against local services**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18T07:37:19Z
- **Completed:** 2026-02-18T07:42:39Z
- **Tasks:** 2 (Task 3 is a human checkpoint — pending GCP apply)
- **Files modified:** 26

## Accomplishments

- 5 Terraform modules created and validated: VPC with private services access, Cloud SQL PostgreSQL 16 with private IP + deletion_protection=false, Memorystore Redis 7.0 BASIC, Pub/Sub with 5 topics + dead-letter + retry policies, Artifact Registry Docker repo
- `terraform init` downloads providers (google 7.20.0 + random 3.8.1), `terraform validate` reports "Success!", `terraform fmt -check -recursive` passes with no issues
- docker-compose.dev.yml provides one-command local infrastructure (`docker compose -f docker-compose.dev.yml up -d`), connectivity-check.ts validates all 3 services with colored output and independent checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Terraform modules for all GCP resources** - `5609e6f` (feat)
2. **Task 2: Create local dev docker-compose and connectivity check script** - `5f4b477` (feat)

**Task 3 (GCP apply checkpoint):** Awaiting human verification — user must configure GCP credentials and run `terraform apply`.

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `infra/terraform/versions.tf` - Provider constraints (google ~>7.19, random ~>3.6, terraform >=1.5)
- `infra/terraform/variables.tf` - 5 input variables with sensible dev defaults
- `infra/terraform/main.tf` - Root module wiring all 5 modules with correct depends_on chains
- `infra/terraform/outputs.tf` - 10 outputs exposing connection details for all resources
- `infra/terraform/terraform.tfvars.example` - Template with annotated placeholder values
- `infra/terraform/.gitignore` - Excludes state, credentials, plan files, .terraform/ directory
- `infra/terraform/.terraform.lock.hcl` - Provider lock file for reproducible provider versions
- `infra/terraform/modules/vpc/main.tf` - VPC (auto_create_subnetworks=false), subnet, private IP range, service networking connection
- `infra/terraform/modules/vpc/variables.tf` - project_id, region, environment
- `infra/terraform/modules/vpc/outputs.tf` - network_id, network_name, subnet_name
- `infra/terraform/modules/cloud-sql/main.tf` - PostgreSQL 16, private IP only, deletion_protection=false, random_password, clawdb database, clawapp user
- `infra/terraform/modules/cloud-sql/variables.tf` - project_id, region, environment, db_tier, vpc_network_id, vpc_network_name
- `infra/terraform/modules/cloud-sql/outputs.tf` - connection_name, private_ip, database_name, user_name, user_password (sensitive)
- `infra/terraform/modules/memorystore/main.tf` - Redis 7.0 BASIC, authorized_network to VPC, no public IP
- `infra/terraform/modules/memorystore/variables.tf` - project_id, region, environment, redis_memory_size_gb, vpc_network_name
- `infra/terraform/modules/memorystore/outputs.tf` - host, port, redis_url
- `infra/terraform/modules/pubsub/main.tf` - 5 event topics + dead-letter, 5 subscriptions (ack_deadline=30s, DLQ, retry 10s-300s)
- `infra/terraform/modules/pubsub/variables.tf` - project_id, environment
- `infra/terraform/modules/pubsub/outputs.tf` - topic_names map, subscription_names map
- `infra/terraform/modules/artifact-registry/main.tf` - DOCKER format repo claw-bots-{env}
- `infra/terraform/modules/artifact-registry/variables.tf` - project_id, region, environment
- `infra/terraform/modules/artifact-registry/outputs.tf` - repository_url, repository_id
- `docker-compose.dev.yml` - PostgreSQL 16-alpine, Redis 7-alpine, Pub/Sub emulator with healthchecks
- `scripts/package.json` - @claw/scripts workspace with pg, ioredis, @google-cloud/pubsub, tsx
- `scripts/tsconfig.json` - Extends root tsconfig.base.json
- `scripts/connectivity-check.ts` - Independent checks, --local flag, colored output, exit codes

## Decisions Made

- **deletion_protection = false on Cloud SQL for dev:** Terraform google provider 7.x changed the default from false to true. Without this explicit setting, `terraform destroy` fails in dev with "Deletion protection is enabled". Set to false for all non-prod environments to unblock the workflow.
- **Memorystore VPC-only (no public IP):** Memorystore has no public IP by design. Local dev uses Docker redis:7 instead. The connectivity check SKIP behavior (not FAIL) for REDIS_URL when running locally without `--local` flag makes this ergonomic.
- **Pub/Sub dead-letter on all subscriptions:** Every subscription points to the dead-letter topic with max 5 delivery attempts. Prevents silent message loss in production. Dead-letter topic created before subscriptions (implicit Terraform ordering via resource references).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed terraform — not present on dev machine**
- **Found during:** Task 1 (terraform init step in verify)
- **Issue:** `terraform` command not found — needed for terraform init, validate, and fmt
- **Fix:** Ran `brew install terraform` — installed version 1.5.7
- **Files modified:** None (system-level install)
- **Verification:** `terraform init` and `terraform validate` both succeed
- **Committed in:** Not committed (system install, not project artifact)

**2. [Rule 3 - Blocking] Added `hashicorp/random` provider to versions.tf**
- **Found during:** Task 1 (creating cloud-sql/main.tf uses `random_password` resource)
- **Issue:** Plan specified only `hashicorp/google` in versions.tf but cloud-sql module uses `random_password` from `hashicorp/random`. Without declaring it, terraform init would fail.
- **Fix:** Added `random` provider (~>3.6) to versions.tf required_providers block
- **Files modified:** infra/terraform/versions.tf
- **Verification:** `terraform init` downloads both providers successfully
- **Committed in:** 5609e6f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — terraform install, missing random provider)
**Impact on plan:** Both necessary for terraform init to succeed. The random provider was an omission in the plan spec — cloud-sql uses random_password which requires hashicorp/random. No scope creep.

## Issues Encountered

- Port 5432 conflict when starting `docker compose -f docker-compose.dev.yml up -d` — existing `postgres-db-1` container from plan 01-01 is already using port 5432. The compose postgres service failed to bind. Redis and Pub/Sub emulator started successfully. This is expected in the local dev environment where postgres is already running. docker-compose.dev.yml is correct for fresh environments. The connectivity check was verified using the existing postgres container (with correct credentials: `postgres:password` from the local .env).

## User Setup Required

**GCP infrastructure provisioning is pending.** See Task 3 checkpoint for required steps:

1. Have a GCP project with billing enabled
2. Enable APIs: Cloud SQL Admin, Memorystore, Pub/Sub, Artifact Registry, Compute Engine, Service Networking
3. Create a service account with Editor role, download JSON key
4. Copy `infra/terraform/terraform.tfvars.example` to `infra/terraform/terraform.tfvars`, fill in project_id and region
5. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json`
6. Run: `cd infra/terraform && terraform init && terraform plan`
7. If plan looks correct (~17-20 resources), run `terraform apply`
8. Run `terraform output` to capture connection strings

## Next Phase Readiness

- Terraform configuration is validated and ready for `terraform apply` once GCP credentials are configured
- Local dev environment (docker-compose.dev.yml) provides PostgreSQL, Redis, and Pub/Sub emulator for development without GCP
- Connectivity check script is the authoritative way to validate infrastructure reachability
- Cloud SQL connection string (from `terraform output db_connection_name`) will be needed for Cloud SQL Auth Proxy setup in Phase 2
- Artifact Registry URL (from `terraform output artifact_registry_url`) will be the Docker push target for bot images in Phase 2

## Self-Check: PASSED

All 26 created/modified files verified present on disk. Both task commits (5609e6f, 5f4b477) verified in git log. `terraform validate` passed. Connectivity check reports 3/3 PASS for PostgreSQL, Redis, and Pub/Sub emulator.

---
*Phase: 01-data-foundation*
*Completed: 2026-02-18*
