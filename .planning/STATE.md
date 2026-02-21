# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** v2.0 — The SOUL System (roadmap created, ready for Phase 8 planning)

## Current Position

Phase: Not started (requirements defined, roadmap created)
Plan: —
Status: Ready for Phase 8 planning
Last activity: 2026-02-21 — v2.0 roadmap created (7 phases, phases 8–14, 37 requirements)

Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0/TBD v2.0 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 5.0 min
- Total execution time: 156 min

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

**Recent Trend:**
- Last 5 plans: 07-02 (2 min), 07-03 (3 min), 07-04 (2 min), 07-05 (3 min), 07-06 (1 min)
- Trend: ~3 min per plan for config/infrastructure work.

*Updated after each plan completion*

## Accumulated Context

### Decisions

v2.0 milestone started. Soul PRD read and digested. Requirements defined (37 requirements, 8 categories: SOUL, SGEN, DTRC, CNCL, CONF, GODL, CLAS, UIEX). Roadmap created with 7 phases (8–14).

Phase build order driven by hard dependency direction: schema before generation, generation before traces, traces before council, council before confirmation gate, gate before God Layer, God Layer before UI. Each phase is independently testable before the next begins.

Key architecture decisions carried into v2.0:
- Council runs fully async on a dedicated `council-queue` (concurrency=5) — never blocks execution result delivery
- Three Council judges run with zero inter-agent visibility; Devil's Advocate uses a heterogeneous LLM provider family
- Counterfactual verification by Soul Analyst is mandatory — self-reported attribution alone is treated as confabulation
- Human confirmation gate ships with anti-rubber-stamp mechanics at launch (evidence surface, confirmation rate tracking, parity framing for reject)
- God Layer evaluates `bot_souls` snapshot at execution start — Redis lock prevents mid-run library mutations
- pgvector extension on Cloud SQL must be confirmed before Phase 8 migration runs
- OpenClaw WebSocket protocol acceptance of soul fields must be confirmed before Phase 9 dispatch code is finalized

### Roadmap Evolution

v2.0 starts at Phase 8 (v1.0 Phases 1–6, v1.1 Phase 7). 7 phases planned. Roadmap finalized 2026-02-21.

### Pending Todos

None.

### Blockers/Concerns

- [Watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Iterate after first real execution data.
- [Watch]: Any new service or Dockerfile using @claw/db must add NODE_OPTIONS --conditions @claw/source.
- [Deferred]: GCP resources not yet provisioned. Terraform config valid. Run terraform apply when GCP project is ready.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [Production]: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be set in Vercel env vars.
- [Phase 8 blocker]: Confirm pgvector extension is enabled on Cloud SQL before running migration (`psql -c '\dx'`).
- [Phase 9 blocker]: Verify OpenClaw WebSocket task dispatch protocol — confirm whether `run_task` accepts extra fields (soul_content, task_category) or requires prompt-prefix injection.
- [Phase 10 blocker]: Confirm whether OpenClaw supports emitting `decision_annotation` messages from agent reasoning. If unavailable, post-hoc attribution path ships as primary.

## Session Continuity

Last session: 2026-02-21
Stopped at: v2.0 roadmap created. Ready to begin Phase 8 planning.
Resume file: None
