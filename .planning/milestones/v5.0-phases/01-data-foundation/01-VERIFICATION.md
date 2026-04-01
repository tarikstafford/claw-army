---
phase: 01-data-foundation
verified: 2026-02-18T08:05:20Z
status: gaps_found
score: 3/4 must-haves verified
re_verification: false
gaps:
  - truth: "GCP resources (Cloud SQL, Memorystore Redis, Pub/Sub, VPC, Artifact Registry) are provisioned and reachable from the local development environment — verified by a connectivity health check script that tests each resource"
    status: failed
    reason: "Terraform configuration is valid and terraform validate passes, but terraform apply has NOT been run. No terraform.tfvars exists (only terraform.tfvars.example with placeholder values). GCP resources have not been provisioned. The connectivity check script exists and is substantive but cannot confirm GCP resource reachability because those resources do not yet exist."
    artifacts:
      - path: "infra/terraform/terraform.tfvars"
        issue: "File does not exist — user has not configured GCP credentials or project ID and has not run terraform apply"
    missing:
      - "User must copy infra/terraform/terraform.tfvars.example to infra/terraform/terraform.tfvars and fill in GCP project_id and region"
      - "User must run: cd infra/terraform && terraform init && terraform plan && terraform apply"
      - "After apply, connectivity check script must be run against real GCP endpoints to confirm Cloud SQL, Memorystore, and Pub/Sub are reachable"
      - "Note: Memorystore (Redis) has no public IP — reachability can only be confirmed from within the GCP VPC (a GCE VM or Cloud Run instance), not from local dev directly"
human_verification:
  - test: "Run connectivity check against GCP resources after terraform apply"
    expected: "PASS for PostgreSQL (via Cloud SQL Auth Proxy), PASS for Pub/Sub (GCP), and confirmation of Memorystore reachability from within the VPC"
    why_human: "Requires a configured GCP project with billing enabled, service account credentials, and terraform apply to provision the actual infrastructure. Cannot verify cloud resource reachability without real credentials and provisioned resources."
  - test: "Run egress-test.sh and confirm all 5 required tests pass"
    expected: "TCP to external IP blocked, HTTP to external hostname blocked, bot reaches gateway stub, gateway reaches internet, host network blocked — 5/5 PASS, exit code 0"
    why_human: "Docker must be running locally to build and start the containers. The test runs live containers. While the script logic and Docker compose topology are verified in the codebase, the actual network isolation behavior is a runtime property that requires Docker to be running."
---

# Phase 1: Data Foundation Verification Report

**Phase Goal:** Every data structure, shared contract, and GCP resource that all subsequent phases depend on exists, is correct, and is reachable from local development — before any application code is written.
**Verified:** 2026-02-18T08:05:20Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PostgreSQL schema (6 tables) can be applied via migration with zero errors and all tables accept typed records matching shared TypeScript interfaces with no cast or coercion | VERIFIED | All 6 schema files present and substantive; migration SQL `0000_misty_iron_fist.sql` contains all 6 CREATE TABLE statements with correct types, FKs, and indexes; `$inferSelect`/`$inferInsert` types used throughout; `tsc --noEmit` exits 0 on packages/db |
| 2 | shared-types, event-schemas, and tool-contracts packages compile in strict mode without errors and can be imported cleanly from any service workspace | VERIFIED | All 3 packages exist with correct internal-packages strategy (`main`/`types` point to `.ts` source, `@claw/source` export condition); `tsc --noEmit` exits 0 for all 3 packages; no runtime dependencies on shared-types; Zod v4 APIs used (z.uuid(), z.iso.datetime()) |
| 3 | GCP resources (Cloud SQL, Memorystore Redis, Pub/Sub, VPC, Artifact Registry) are provisioned and reachable from local dev — verified by connectivity health check script | FAILED | Terraform configuration validates (`terraform validate` exits 0, lock file exists), but `terraform.tfvars` does not exist. `terraform apply` has not been run. GCP resources are not provisioned. The connectivity check script is substantive and correct but has never been run against real GCP resources. |
| 4 | A Docker container started with the bot isolation profile cannot reach any external host except the designated Tool Gateway address — confirmed by egress test verifying both TCP and DNS are blocked | HUMAN NEEDED | All artifacts verified (docker-compose.yml with `internal: true`, egress-test.sh is executable, both Dockerfiles are substantive). The topology is architecturally correct. Runtime behavior needs Docker execution to confirm. |

**Score:** 2/4 truths fully verified (3/4 automated artifacts verified — truth 4 needs human runtime confirmation for full credit)

---

### Required Artifacts

#### Success Criterion 1 — PostgreSQL Schema

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/executions.ts` | Executions table with lifecycle enum | VERIFIED | `executionStatusEnum` with 6 values, 9 columns, `$inferSelect`/`$inferInsert` exported |
| `packages/db/src/schema/tasks.ts` | Tasks table with lease semantics | VERIFIED | `taskStatusEnum`, `claimedByBotId`, `leaseExpiresAt`, 3 indexes |
| `packages/db/src/schema/bots.ts` | Bots table with lifecycle tracking | VERIFIED | `botStatusEnum` with 6 values, heartbeat tracking, task counters, 2 indexes |
| `packages/db/src/schema/billing-events.ts` | Billing events with integer cents | VERIFIED | `billingEventTypeEnum`, `amountCents` as integer (not float), jsonb metadata, 3 indexes |
| `packages/db/src/schema/telemetry.ts` | Telemetry with numeric metric values | VERIFIED | `numeric(12,6)` for metric_value, FK to both executions and bots, 3 indexes |
| `packages/db/src/schema/dna-store.ts` | DNA store with versioned JSONB | VERIFIED | `DnaPayload` interface with all 6 fields, `numeric(5,2)` composite_score, 4 indexes |
| `packages/db/src/schema/index.ts` | Barrel export of all schemas | VERIFIED | Exports all 6 schema modules |
| `packages/db/src/client.ts` | Drizzle client instance | VERIFIED | `drizzle()` with node-postgres adapter, schema import, `db` exported |
| `packages/db/migrations/0000_misty_iron_fist.sql` | Generated SQL migration | VERIFIED | All 6 CREATE TABLE, 4 CREATE TYPE, 6 FK constraints, 13 indexes |
| `packages/db/tsconfig.json` | Strict mode TypeScript config | VERIFIED | Extends base (strict=true), ESNext+Bundler for drizzle-kit compatibility |

#### Success Criterion 2 — Shared Contract Packages

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared-types/src/index.ts` | Pure TypeScript domain types | VERIFIED | Exports ExecutionStatus, TaskStatus, BotStatus, BillingEventType — no runtime deps |
| `packages/shared-types/package.json` | Internal packages strategy | VERIFIED | `main`/`types` point to `./src/index.ts`, `@claw/source` condition, zero runtime deps |
| `packages/event-schemas/src/index.ts` | Zod v4 Pub/Sub event schemas | VERIFIED | Exports botStartedEventSchema, botStoppedEventSchema, guardrailTriggeredEventSchema, budgetExceededEventSchema, taskClaimedEventSchema |
| `packages/tool-contracts/src/index.ts` | Zod v4 Tool Gateway contracts | VERIFIED | Exports llmCallRequestSchema, llmCallResponseSchema, fetchUrlRequestSchema, fetchUrlResponseSchema, writeFileRequestSchema, writeFileResponseSchema |

#### Success Criterion 3 — GCP Infrastructure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/terraform/main.tf` | Root Terraform wiring all modules | VERIFIED | 5 module blocks with correct source paths and depends_on chains |
| `infra/terraform/modules/vpc/main.tf` | VPC with private services access | VERIFIED | `google_compute_network`, `google_compute_global_address`, `google_service_networking_connection` |
| `infra/terraform/modules/cloud-sql/main.tf` | Cloud SQL PostgreSQL 16 | VERIFIED | `google_sql_database_instance` PostgreSQL 16, private IP only, `deletion_protection=false` |
| `infra/terraform/modules/memorystore/main.tf` | Memorystore Redis | VERIFIED | `google_redis_instance` Redis 7.0 BASIC, VPC-authorized |
| `infra/terraform/modules/pubsub/main.tf` | Pub/Sub 5 topics + dead-letter | VERIFIED | 5 event topics + dead-letter topic + 5 subscriptions with retry/DLQ policies |
| `infra/terraform/modules/artifact-registry/main.tf` | Artifact Registry Docker repo | VERIFIED | `google_artifact_registry_repository` DOCKER format |
| `infra/terraform/terraform.tfvars` | GCP project configuration | MISSING | File does not exist — terraform apply not run |
| `scripts/connectivity-check.ts` | Health check script | VERIFIED | checkPostgres, checkRedis, checkPubSub with --local flag, Promise.allSettled, colored output, exit codes |
| `docker-compose.dev.yml` | Local dev services | VERIFIED | postgres:16-alpine, redis:7-alpine, Pub/Sub emulator with healthchecks |

#### Success Criterion 4 — Bot Network Isolation

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/docker/bot-isolation/docker-compose.yml` | Docker topology with internal network | VERIFIED | `bot-internal: internal: true`, `external` bridge, bot-test on internal only, gateway on both |
| `infra/docker/bot-isolation/Dockerfile.bot-test` | Test bot container with network tools | VERIFIED | Alpine 3.20 with curl, wget, bind-tools, netcat-openbsd |
| `infra/docker/bot-isolation/Dockerfile.gateway-stub` | Gateway stub on port 8080 | VERIFIED | Alpine 3.20 with Python 3 http.server returning "Gateway OK" — not the nc-loop stub |
| `infra/docker/bot-isolation/egress-test.sh` | Automated egress test script | VERIFIED | Executable (`-rwxr-xr-x`), 6 tests, readiness probe, PASS/FAIL/INFO reporting, teardown, exit code logic |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/drizzle.config.ts` | `packages/db/src/schema/**/*.ts` | schema glob in defineConfig | WIRED | `schema: './src/schema/**/*.ts'` confirmed in drizzle.config.ts |
| `packages/db/src/client.ts` | `packages/db/src/schema/index` | schema import in drizzle() call | WIRED | `import * as schema from './schema/index'` then `drizzle(..., { schema })` |
| `packages/db/src/index.ts` | `packages/db/src/client.ts` | re-export of db client and all schema types | WIRED | `export { db, type Database } from './client'` and `export * from './schema/index'` |
| `infra/terraform/main.tf` | `infra/terraform/modules/*/main.tf` | module source references | WIRED | All 5 `module "..."` blocks with `source = "./modules/..."` |
| `infra/terraform/modules/cloud-sql/main.tf` | `infra/terraform/modules/vpc/main.tf` | Cloud SQL uses VPC private IP | WIRED | `private_network = var.vpc_network_id` and `depends_on = [module.vpc]` |
| `infra/terraform/modules/memorystore/main.tf` | `infra/terraform/modules/vpc/main.tf` | Memorystore uses authorized VPC network | WIRED | `authorized_network = "projects/${var.project_id}/global/networks/claw-vpc-${var.environment}"` |
| `infra/docker/bot-isolation/docker-compose.yml` | `Dockerfile.bot-test` | bot-test service builds from Dockerfile.bot-test | WIRED | `build: dockerfile: Dockerfile.bot-test` |
| `infra/docker/bot-isolation/docker-compose.yml` | `Dockerfile.gateway-stub` | gateway-stub service builds from Dockerfile.gateway-stub | WIRED | `build: dockerfile: Dockerfile.gateway-stub` |
| `infra/docker/bot-isolation/egress-test.sh` | `infra/docker/bot-isolation/docker-compose.yml` | Test script uses docker compose to start and exec into containers | WIRED | `COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"` then `docker compose -f "$COMPOSE_FILE"` throughout |
| `packages/shared-types/src/execution.ts` | `packages/db/src/schema/executions.ts` | Matching enum values — no import but mirrors DB schema | VERIFIED (structural) | Both define same 6 values: queued, running, paused, stopped, completed, failed |

---

### Anti-Patterns Found

No blockers or warnings found:

- No TODO/FIXME/PLACEHOLDER comments in any package source files
- No stub returns (`return null`, `return {}`, `return []`) in schema or contract files
- No `console.log`-only implementations
- No Zod v3 patterns (`z.string().uuid()`, `.errors`) — Zod v4 patterns used exclusively
- All monetary values in schema use integer (cents), not float
- No extensionless-import anti-pattern in drizzle config (correctly uses glob pattern)

---

### Human Verification Required

#### 1. GCP Resource Provisioning and Connectivity

**Test:** Copy `infra/terraform/terraform.tfvars.example` to `infra/terraform/terraform.tfvars`, fill in `project_id` and `region` for a GCP project with billing enabled. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`. Run:
```bash
cd infra/terraform && terraform init && terraform plan
```
Verify the plan shows approximately 17-20 resources to create (VPC, subnet, private IP range, service networking, Cloud SQL instance + database + user, Memorystore, 6 Pub/Sub topics, 5 subscriptions, Artifact Registry). If correct, run `terraform apply`.

After apply, run the connectivity check:
```bash
GCP_PROJECT_ID=your-project-id \
DATABASE_URL=$(terraform output -raw db_connection_name) \
pnpm --filter @claw/scripts check
```

**Expected:** PASS for PostgreSQL (via Cloud SQL Auth Proxy), PASS for Pub/Sub (GCP). Memorystore reachability requires testing from within the GCP VPC (Memorystore has no public IP by design — this is documented in the PLAN and SUMMARY).

**Why human:** Requires a GCP project with billing enabled, service account credentials, and the `terraform apply` step. Cannot verify cloud resource reachability without real infrastructure.

#### 2. Bot Network Isolation Egress Test (Runtime Confirmation)

**Test:** With Docker running locally, execute:
```bash
./infra/docker/bot-isolation/egress-test.sh
```

**Expected:** The script builds both containers, runs 6 tests, and reports at minimum 5/5 PASS (Test 3 is informational):
- PASS: TCP to external IP (8.8.8.8:443) blocked
- PASS: HTTP to external hostname (google.com) blocked
- INFO: DNS behavior documented (informational, no PASS/FAIL)
- PASS: Bot can reach Tool Gateway stub (HTTP 200, body: Gateway OK)
- PASS: Gateway can reach external hosts (google.com reachable)
- PASS: Bot cannot reach host network (host.docker.internal:80 blocked)

Exit code must be 0.

**Why human:** Requires Docker running locally to build images and run containers. The Docker network isolation is a runtime property of the kernel network stack that cannot be verified by reading source files alone.

---

### Gaps Summary

**One gap blocks full phase goal achievement:**

**Success Criterion 3 — GCP resources not provisioned.** The Terraform configuration is correct (`terraform validate` passes, all 5 modules are substantive and wired), the connectivity check script is production-ready, and the local docker-compose equivalent is verified. However, the phase goal requires GCP resources to "exist" and be "reachable from local development." The `terraform apply` step was explicitly designated a human checkpoint in 01-03-PLAN.md (`<task type="checkpoint:human-verify" gate="blocking">`). This is a pending human action, not a code defect.

**What is blocking:** The user needs to configure a GCP project, provide credentials, and run `terraform apply`. This was documented in 01-03-SUMMARY.md under "User Setup Required" and in the PLAN as a blocking human checkpoint.

**What is NOT blocking:** All code artifacts for this success criterion (Terraform modules, connectivity script, docker-compose) are complete, correct, and substantive. Once the human applies Terraform, the criterion can be re-verified by running the connectivity check.

---

_Verified: 2026-02-18T08:05:20Z_
_Verifier: Claude (gsd-verifier)_
