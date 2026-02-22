# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Planning next milestone (v2.0 shipped — The SOUL System complete)

## Current Position

Phase: milestone-complete
Plan: v2.0 archived
Status: v2.0 The SOUL System shipped — 7 phases (8–14), 19 plans, 2 days. All 37 v2.0 requirements delivered. Evolutionary loop closes end-to-end: SOUL generation → Council evaluation → Human confirmation → God Layer DNA writes → Agent class transitions → UI visibility.
Last activity: 2026-02-22 — v2.0 milestone archived

Progress: [████████████████████████████] 100% (v2.0 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 39
- Average duration: 4.7 min
- Total execution time: 189 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4/4 | 31 min | 8 min |
| 02-core-execution-pipeline | 4/4 | 29 min | 7.3 min |
| 03-bot-runtime-and-tool-gateway | 4/4 | 53 min | 13 min |
| 04-control-plane-services | 3/3 | 11 min | 3.7 min |
| 05-performance-intelligence-and-dna-capture | 3/3 | 8 min | 2.7 min |
| 06-ui-command-center | 5/5 | 15 min | 3 min |
| 07-google-auth-gate | 6/6 | 16 min | 2.7 min |
| 08-database-schema-and-shared-types | 2/? | 5 min | 2.5 min |
| 09-soul-generation-and-dispatch-integration | 3/? | 4 min | 1.3 min |
| 10-decision-trace-collection | 2/2 | 10 min | 5 min |
| 11-the-council | 2/2 | 6 min | 3 min |
| 12-human-confirmation-gate | 2/2 | 8 min | 4 min |
| 13-god-layer-and-agent-class-system | 4/4 | 11 min | 2.75 min |

**Recent Trend:**
- Last 5 plans: 13-02 (2 min), 13-03 (5 min), 13-04 (4 min)
- Trend: ~2-5 min per plan for targeted gap-closure work.

*Updated after each plan completion*
| Phase 13-god-layer-and-agent-class-system P04 | 4 | 2 tasks | 4 files |
| Phase 14-ui-extensions P01 | 2 | 2 tasks | 3 files |
| Phase 14-ui-extensions P02 | 8 | 2 tasks | 5 files |
| Phase 14-ui-extensions P03 | 2 | 2 tasks | 4 files |
| Phase 14-ui-extensions P04 | 4 | 3 tasks | 5 files |

## Accumulated Context

### Decisions

v2.0 shipped. All architectural decisions archived to PROJECT.md Key Decisions table.
See `.planning/milestones/v2.0-ROADMAP.md` for full phase-level decision log.

### Roadmap Evolution

v2.0 complete (Phases 8–14). v3.0 planning starts with `/gsd:new-milestone`.

### Pending Todos

None.

### Blockers/Concerns (carry forward to v3.0)

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Production]: Verify OpenClaw WebSocket `run_task` accepts extra soul fields or use prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [Production]: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be set in Vercel env vars.
- [Production]: Composite score weights (40/30/20/10) not empirically validated — iterate after first real execution data.
- [Production]: GCP resources not yet provisioned. Terraform config valid. Run terraform apply when GCP project is ready.

## Session Continuity

Last session: 2026-02-22
Stopped at: v2.0 milestone archived — all 7 phases complete, 19 plans shipped
Resume file: None
