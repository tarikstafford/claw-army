# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** v2.0 — The SOUL System (Phase 9 Plan 03 complete)

## Current Position

Phase: 09-soul-generation-and-dispatch-integration
Plan: 03 (complete)
Status: Phase 9 Plan 03 complete — humanReviewFlag persisted to database; SGEN-05 fully satisfied
Last activity: 2026-02-21 — Phase 09-03 complete (humanReviewFlag schema column, migration, and soul-generator.ts insert wired)

Progress: [█░░░░░░░░░░░░░░░░░░░░░░░░░░░] 7% (2/TBD v2.0 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 32
- Average duration: 4.9 min
- Total execution time: 162 min

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

**Recent Trend:**
- Last 5 plans: 08-01 (2 min), 08-02 (3 min), 09-01 (3 min), 09-03 (1 min)
- Trend: ~1-3 min per plan for targeted gap-closure work.

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

Phase 08-01 decisions:
- AnyPgColumn import from drizzle-orm/pg-core used for bot_souls self-referencing parentSoulId FK — the explicit return type annotation `references((): AnyPgColumn => botSouls.id)` is required to avoid TypeScript TS7022 implicit-any error on circular initializers
- council_verdicts.soulId left as bare uuid() without explicit FK reference to bot_souls (logical linkage only; avoids unnecessary cross-file import in council-verdicts.ts)
- All additive columns on bots/executions/dna_store are nullable with no defaults — safe for live Cloud SQL with existing rows pre-dating the SOUL system
- decision_traces TTL policy (90 days / 5M row threshold) documented as JSDoc in schema file; enforcement deferred to Phase 10

Phase 08-02 decisions:
- Migration file renamed from drizzle-kit auto-generated 0003_solid_magdalene.sql to 0003_soul_system_foundation.sql; journal tag updated — drizzle-kit tracks migrations by tag in _journal.json, so rename is fully safe; snapshot file is indexed numerically and unaffected
- pgvector CREATE EXTENSION IF NOT EXISTS vector manually prepended as first migration statement — drizzle-kit does not emit extension creation; manual prepend is the standard approach and is idempotent
- Seed script idempotency guard uses count >= 6 (not == 0) — tolerates partial seed states where some archetypes were inserted before a failure
- Archetype SOUL.md content is full markdown documents so Phase 9 can inject soulContent directly as system prompt prefixes without additional templating
- constitutionDirectives stored as both JSONB array column and verbatim in SOUL.md Constitution section — single source of truth for inviolable directives
- [Phase 09-01]: Novel path restricted to Substitution and Attenuation only at temperature 0.2 to preserve archetype spread (amplification/recombination/introduction would erode behavioral distinctiveness)
- [Phase 09-01]: pickFromPool() helper wraps array index-modulo access for noUncheckedIndexedAccess safety without littering callsites with non-null assertions
- [Phase 09-01]: humanReviewFlag set on soul instead of throwing when MAX_MUTATION_ITERATIONS exceeded — pipeline completes, flagged souls reviewed externally per SGEN-04/05
- [Phase 09-03]: humanReviewFlag column placed after embedding, before createdAt — consistent with column ordering convention of operational fields before audit timestamps
- [Phase 09-03]: Migration renamed from auto-generated 0004_empty_lady_bullseye to 0004_add_human_review_flag following the pattern established in 08-02 — drizzle-kit tracks by _journal.json tag, rename is safe

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
- [Phase 8 blocker]: Confirm pgvector extension is enabled on Cloud SQL before running migration (`psql -c '\dx'`). Migrations 0003_soul_system_foundation.sql AND 0004_add_human_review_flag.sql are ready; apply via `cd packages/db && npx drizzle-kit migrate` after pgvector confirmed.
- [Phase 8 blocker]: Run seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Phase 9 blocker]: Verify OpenClaw WebSocket task dispatch protocol — confirm whether `run_task` accepts extra fields (soul_content, task_category) or requires prompt-prefix injection.
- [Phase 10 blocker]: Confirm whether OpenClaw supports emitting `decision_annotation` messages from agent reasoning. If unavailable, post-hoc attribution path ships as primary.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 09-03-PLAN.md (humanReviewFlag database persistence gap closure)
Resume file: None
