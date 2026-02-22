# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v3.0 Phase 15 — Bot Reliability

## Current Position

Phase: 15 of 19 (Bot Reliability)
Plan: 3 of 3 in current phase (15-03 complete — phase complete)
Status: In progress
Last activity: 2026-02-22 — 15-03 complete: dispatcher round-trip validation + UI error surfacing

Progress: [██░░░░░░░░] 5% (v3.0 — Phase 15 complete, Phase 16 next)

## Performance Metrics

**Velocity:**
- Total plans completed: 40 (v1.0 + v1.1 + v2.0 + v3.0 P01-02)
- Average duration: 4.6 min
- Total execution time: 192 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01–07 (v1.0 + v1.1) | 25/25 | 147 min | 5.9 min |
| 08–14 (v2.0) | 19/19 | 55 min | 2.9 min |
| 15–19 (v3.0) | 3/TBD | 13 min | 4.3 min |

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
- [15-02] Return 200 for failure payload receipt — VM completed its job by reporting; ACK prevents retry spam
- [15-02] Liveness check placed between connect() and registry update — never register a stale WebSocket client
- [15-02] Spawn timeout uses botRegistry polling (not DB query) — avoids per-interval DB hit; registry is authoritative in-process state
- [15-03] checkExecutionCompletion called fire-and-forget after task terminal state — completion check non-blocking, failures logged but don't affect task result
- [15-03] bot-stopped class no longer applied to failed bots — failed bots need distinct visual treatment (red/pink) not faded opacity
- [15-03] Connection-level errorMessage uses substring matching ('not connected', 'Connection closed') — matches openclaw-client error strings from Plan 02

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
Stopped at: Completed 15-03-PLAN.md — dispatcher round-trip validation, UI bot error surfacing; Phase 15 complete
Resume file: None
