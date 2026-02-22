# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v3.0 Phase 15 — Bot Reliability

## Current Position

Phase: 15 of 19 (Bot Reliability)
Plan: 1 of 3 in current phase (15-01 complete)
Status: In progress
Last activity: 2026-02-22 — 15-01 complete: startup script hardened + errorMessage schema

Progress: [█░░░░░░░░░] 3% (v3.0 — Phase 15, Plan 1/3 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 39 (v1.0 + v1.1 + v2.0)
- Average duration: 4.7 min
- Total execution time: 189 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01–07 (v1.0 + v1.1) | 25/25 | 147 min | 5.9 min |
| 08–14 (v2.0) | 19/19 | 55 min | 2.9 min |
| 15–19 (v3.0) | 1/TBD | 8 min | 8 min |

**Recent Trend:**
- v2.0 plans averaged 2.9 min — targeted, incremental additions to existing systems.
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0–v2.0 architectural decisions archived in PROJECT.md Key Decisions table.
See `.planning/milestones/v2.0-ROADMAP.md` for full phase-level decision log.

**v3.0 decisions:**
- [15-01] Migration files belong in packages/db/migrations/ (drizzle out:./migrations), not src/migrations/ as initially planned
- [15-01] Removed set -e from startup script in favor of explicit || { FAILURE_REASON=...; exit 1; } blocks — required for EXIT trap to fire post_failure()
- [15-01] Double-validate openclaw: command -v guard (idempotency) + --version execution (correctness) as separate checks

### Pending Todos

None.

### Blockers/Concerns (carry forward to v3.0)

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [BOT — Phase 15]: Verify OpenClaw WebSocket `run_task` schema accepts extra soul fields or use prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [Production]: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be set in Vercel env vars.
- [Production]: Composite score weights (40/30/20/10) not empirically validated — iterate after first real execution data.
- [Production]: GCP resources not yet provisioned. Terraform config valid. Run terraform apply when GCP project is ready.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 15-01-PLAN.md — startup script hardened, errorMessage schema added
Resume file: None
