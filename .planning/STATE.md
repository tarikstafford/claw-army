# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Planning v2.0 — The SOUL System

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements for v2.0 The SOUL System
Last activity: 2026-02-21 — Milestone v2.0 started

Progress: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 plans)

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

v2.0 milestone started. Soul PRD read and digested. Requirements definition in progress.

### Roadmap Evolution

v2.0 starts at Phase 8. Roadmap pending requirements definition.

### Pending Todos

None.

### Blockers/Concerns

- [Watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Iterate after first real execution data.
- [Watch]: Any new service or Dockerfile using @claw/db must add NODE_OPTIONS --conditions @claw/source.
- [Deferred]: GCP resources not yet provisioned. Terraform config valid. Run terraform apply when GCP project is ready.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [Production]: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be set in Vercel env vars.

## Session Continuity

Last session: 2026-02-21
Stopped at: v2.0 milestone started. Defining requirements from soul PRD.
Resume file: None
