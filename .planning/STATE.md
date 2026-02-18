# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 6 (Data Foundation)
Plan: 3 of 4 in current phase (awaiting GCP apply checkpoint)
Status: In progress
Last activity: 2026-02-18 — Plan 01-03 auto-tasks complete: Terraform modules for VPC+Cloud SQL+Memorystore+Pub/Sub+Artifact Registry validated, docker-compose.dev.yml and connectivity-check.ts ready. Awaiting human GCP apply checkpoint.

Progress: [███░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 5 min
- Total execution time: 16 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 3/4 | 16 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (7 min), 01-02 (4 min), 01-03 (5 min)
- Trend: Stable (infrastructure + scripts creation)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Bot hosting — dockerode on GCE VM recommended over Cloud Run Jobs for MVP (faster lifecycle control, tighter per-bot management). Cloud Run Jobs is the long-term target but has latency trade-offs. NEEDS prototype validation in Phase 2.
- [Pre-Phase 1]: Task queue — BullMQ 5 on Redis recommended over Postgres row-level locking. If Redis is not yet available, Postgres locking is a valid fallback to reconcile in Phase 2.
- [Pre-Phase 1]: Single-tenant MVP, no auth complexity. No Stripe. Billing is metering and display only.
- [Phase 01-data-foundation]: moduleResolution: Bundler in packages/db tsconfig to fix drizzle-kit esbuild-register .js import incompatibility
- [Phase 01-data-foundation]: Integer cents for all monetary values (budgetCapCents, amountCents) - never float
- [Phase 01-data-foundation]: Extensionless imports in schema files for drizzle-kit esbuild-register CJS compatibility
- [Phase 01-data-foundation/01-02]: ESNext+Bundler moduleResolution applied to all new packages (shared-types, event-schemas, tool-contracts) for consistency and pnpm resolution compatibility
- [Phase 01-data-foundation/01-02]: result field optional on tool-contracts response schemas to support both success and error cases with a single type
- [Phase 01-data-foundation/01-02]: executionStatusSchema defined inline in execution-events.ts (not imported from @claw/shared-types) to keep event-schemas dep-free from shared-types
- [Phase 01-data-foundation/01-02]: z.record(z.string(), z.unknown()) for metadata fields — Zod v4 requires explicit key/value type args (unlike v3)
- [Phase 01-data-foundation/01-03]: deletion_protection = false on Cloud SQL — Terraform google provider 7.x defaults to true, blocking terraform destroy in dev
- [Phase 01-data-foundation/01-03]: Memorystore has no public IP by design — local dev uses Docker redis:7, GCP Redis is VPC-only
- [Phase 01-data-foundation/01-03]: Pub/Sub dead-letter + retry policy (10s-300s backoff, max 5 attempts) on all subscriptions for production reliability

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 watch]: GCP bot hosting topology (Cloud Run Jobs vs GCE/dockerode) is the single most consequential unresolved architectural fork. Recommend a prototype to validate Cloud Run Jobs API latency under concurrent bot spawning before Phase 2 commits to either path.
- [Phase 3 watch]: Tool Gateway auth patterns and bot JWT rotation strategy are MEDIUM confidence. May need targeted research during Phase 3 planning.
- [Phase 5 watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected.
- [Phase 2+ watch]: Services that import @claw/event-schemas or @claw/tool-contracts will need Zod as a runtime dependency in their own package.json.

## Session Continuity

Last session: 2026-02-18
Stopped at: Plan 01-03 auto-tasks complete — Terraform modules + docker-compose.dev.yml + connectivity-check.ts committed. Task 3 is a human checkpoint requiring GCP project setup and terraform apply. User must run terraform plan/apply and confirm before continuing.
Resume file: None
