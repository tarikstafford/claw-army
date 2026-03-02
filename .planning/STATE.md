# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v5.0 Full Spectrum — Phase 33: Execution Data Model Fixes

## Current Position

Milestone: v5.0 Full Spectrum
Phase: 33 of 40 (Execution Data Model Fixes)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-03-02 — Completed 33-02: Per-execution domain filtering wired into Tool Gateway proxy

Progress: [██░░░░░░░░] 20% (v5.0, 2/10 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed (v5.0): 0
- Prior milestones: ~103 plans across 32 phases

**By Phase:** (v5.0)

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 33 (Execution Data Model Fixes) | 2 | 4 min | 2 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0–v4.0 architectural decisions archived in PROJECT.md Key Decisions table.

v5.0 decisions (33-01):
- llmProvider validated at app level only (not DB enum) to avoid migration churn when adding providers
- allowedDomains null=use global PROXY_DOMAIN_ALLOWLIST, []=allow all — semantically distinct
- Migration 0013 uses ADD COLUMN IF NOT EXISTS for idempotency (consistent with 0008-0010)

v5.0 decisions (33-02):
- Duplex type used for CONNECT socket parameter — Node.js server 'connect' event emits Duplex not net.Socket
- async proxy handlers wrapped with .catch() at call sites (server.on and setNotFoundHandler)
- X-Execution-Id header injection into bot VM HTTP_PROXY deferred to Phase 35+

v5.0 phase ordering rationale:
- Phase 33 before 35: `llmProvider` and `allowedDomains` schema changes must exist before form fields can submit them
- Phase 34 before 35/39: Route alignment verified before UI layers built on top
- Phase 36 isolated: Pre-flight manifest review is a distinct UX gate complex enough for its own phase
- Phase 38 after 37: DNA timeline is an enhancement to objective detail — needs the page functional first
- Phase 39 groups all read-only soul visibility features — no schema changes, all data already in DB

### Pending Todos

None.

### Blockers/Concerns

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Production]: Verify OpenClaw WebSocket run_task schema accepts extra soul fields or requires prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 33-02-PLAN.md — Phase 33 complete, ready for Phase 34
Resume file: None
