# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** Phase 1 — Data Foundation

## Current Position

Phase: 1 of 6 (Data Foundation)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-02-18 — Plan 01-02 complete: @claw/shared-types, @claw/event-schemas, @claw/tool-contracts packages created with Zod v4

Progress: [██░░░░░░░░] 8%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 6 min
- Total execution time: 11 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 2/4 | 11 min | 6 min |

**Recent Trend:**
- Last 5 plans: 01-01 (7 min), 01-02 (4 min)
- Trend: Faster (package creation with established patterns)

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 watch]: GCP bot hosting topology (Cloud Run Jobs vs GCE/dockerode) is the single most consequential unresolved architectural fork. Recommend a prototype to validate Cloud Run Jobs API latency under concurrent bot spawning before Phase 2 commits to either path.
- [Phase 3 watch]: Tool Gateway auth patterns and bot JWT rotation strategy are MEDIUM confidence. May need targeted research during Phase 3 planning.
- [Phase 5 watch]: Composite score weighting (40/30/20/10) is a reasoned starting point, not empirically validated. Plan to iterate after first real execution data is collected.
- [Phase 2+ watch]: Services that import @claw/event-schemas or @claw/tool-contracts will need Zod as a runtime dependency in their own package.json.

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 01-02-PLAN.md — three shared contract packages created (@claw/shared-types, @claw/event-schemas, @claw/tool-contracts), all compiling in strict mode, Zod v4 runtime validation verified. Ready for Plan 01-03.
Resume file: None
