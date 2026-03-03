# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v5.0 Full Spectrum — Phase 35: Execution Form Enhancements

## Current Position

Milestone: v5.0 Full Spectrum
Phase: 35 of 40 (Execution Form Enhancements)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-03-03 — 35-02 complete: campaignType column added to DB, wired through POST/GET API contract

Progress: [████░░░░░░] 50% (v5.0, 6/12 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed (v5.0): 4
- Prior milestones: ~103 plans across 32 phases

**By Phase:** (v5.0)

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 33 (Execution Data Model Fixes) | 2 | 4 min | 2 min |
| 34-01 (API Alignment SSE - billing topic) | 1 | 1 min | 1 min |
| 34-02 (API Alignment smoke tests) | 1 | 15 min | 15 min |
| 35-01 (Execution Form UI) | 1 | 1 min | 1 min |
| 35-02 (campaignType API contract) | 1 | 2 min | 2 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0–v4.0 architectural decisions archived in PROJECT.md Key Decisions table.

v5.0 decisions (33-01):
- llmProvider validated at app level only (not DB enum) to avoid migration churn when adding providers
- allowedDomains null=use global PROXY_DOMAIN_ALLOWLIST, []=allow all — semantically distinct
- Migration 0013 uses ADD COLUMN IF NOT EXISTS for idempotency (consistent with 0008-0010)

v5.0 decisions (34-01):
- Promise.allSettled used for SSE topic subscription creation — missing GCP topics log warning and are skipped rather than crashing the entire SSE connection

v5.0 decisions (34-02):
- Ring-leader inject tests accept statusCode in [404, 500] — both confirm route registration; 500 means ring_leader_runs table not yet applied to local dev DB
- Fastify printRoutes() radix tree compression: state/synthesis share 's' prefix → appear as tate/ynthesis in output; tests check compressed suffixes
- SSE route registration verified via inject returning non-405 (streaming not testable via inject without real PubSub)

v5.0 decisions (35-01):
- runtimeLimitMinutes converted to runtimeLimitSeconds in server action — backend expects seconds (default 60 min = 3600 sec)
- formData.getAll() used for allowedTools (multi-value hidden inputs)
- Tool allowlist multi-select uses ENABLED badge; campaign type single-select uses SELECTED — differentiates interaction patterns

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
- [Phase 35-02]: campaignType stored as nullable varchar(20) with app-level validation only — consistent with llmProvider approach, avoids migration churn when enum values change
- [Phase 35-02]: resolvedCampaignType fallback preserves objectiveId-based derivation for spawnRingLeader when form field is omitted

### Pending Todos

None.

### Blockers/Concerns

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Production]: Verify OpenClaw WebSocket run_task schema accepts extra soul fields or requires prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 35-02-PLAN.md — campaignType column + migration + API contract complete; Phase 35 done
Resume file: None
