# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** Planning next milestone

## Current Position

Milestone: v4.0 The Ring Leader — SHIPPED 2026-03-02
Status: Milestone archived. No active milestone.
Last activity: 2026-03-02 — v4.0 milestone completed and archived

Progress: [██████████] 100% (all milestones through v4.0 shipped)

## Accumulated Context

### Decisions

All v1.0–v4.0 architectural decisions archived in PROJECT.md Key Decisions table.

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
Stopped at: v4.0 milestone archived
Resume file: None
