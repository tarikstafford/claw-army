# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Users can deploy a crew of AI bots, watch them work in real-time, and see exactly what each bot cost and how well it performed — so they can trust and improve every run.
**Current focus:** v2.0 — The SOUL System (Phase 13 complete — God Layer and Agent Class System; Phase 14 next)

## Current Position

Phase: 13-god-layer-and-agent-class-system
Plan: 04 (complete — phase complete)
Status: Phase 13 complete — DB schema (agent_classes, category_benchmarks, migration 0007), class state machine (computeClassTransition pure function, 18 tests passing), God Layer support modules (dna-writer, pioneer-tracker, negative-register), God Layer BullMQ worker with idempotency, Redis category lock, atomic DB transaction, and full enqueue wiring. All GODL-01 through GODL-07 + CLAS-01 through CLAS-06 satisfied.
Last activity: 2026-02-22 — Phase 13 complete (God Layer and Agent Class System)

Progress: [██████░░░░░░░░░░░░░░░░░░░░░░] 31% (11/TBD v2.0 plans — Phase 13 complete)

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
- [Phase 10-01]: Migration 0005 renamed from 0005_slimy_goliath to 0005_decision_traces_unique_decision_id; journal tag updated; snapshot file (numerically indexed) untouched — same rename pattern as prior migrations
- [Phase 10-01]: MAX_INVOCATIONS_PER_BOT=50 caps LLM cost per bot; rejected tool calls included for counterfactual value in CNCL-04
- [Phase 10-01]: reasoning_branch writes low-confidence fallback row on LLM failure — Council always has a row to evaluate; fire-and-forget boundary at top-level never throws
- [Phase 10-01]: Verbatim directive validation — confidence > 0.5 AND directive not in soulContent → degrade to max 0.3 + validationWarning metadata flag to prevent confabulation from poisoning Council analysis
- [Phase 10-02]: Admin route uses plain FastifyInstance (not FastifyPluginAsyncTypebox) — no TypeBox schema needed for internal Cloud Scheduler trigger endpoint
- [Phase 10-02]: No auth middleware on /admin prefix at this stage — execution service is internal, protected by GCP firewall rules; auth hook can be added later as a Fastify onRequest hook on the prefix
- [Phase 10-02]: decision_annotation stub placed after task_failed handler inside handleMessage() — natural extension point when OpenClaw adds annotation support
- [Phase 11-01]: Output import from AI SDK 6 is 'Output' (capital O) — the package re-exports lowercase 'output' namespace as 'Output'; import { Output } from 'ai'
- [Phase 11-01]: Devil's Advocate uses google('gemini-2.5-flash') per CNCL-03 heterogeneous provider family requirement; Performance Judge and Soul Analyst use anthropic('claude-sonnet-4-6')
- [Phase 11-01]: COUNTERFACTUAL_OVERRIDE_THRESHOLD=0.25 exported as named constant; threshold logic is deterministic post-processing after LLM call — overrides LLM-reported booleans
- [Phase 11-01]: Soul Analyst filters to attributionConfidence > 0.5 AND directiveReferenced non-null, capped at 20 traces for counterfactual verification
- [Phase 11-01]: Devil's Advocate strongUnresolvedArgument deterministically computed as challenges.some(c => c.severity === 'strong') — structural guarantee for CNCL-05 human review escalation
- [Phase 11-01]: councilQueue reuses queueConnection from task-queue (same Redis); council worker in Plan 02 imports workerConnection directly from task-queue
- [Phase 11-02]: VERDICT_VALUES numeric map (Promote=4 to Retire=0) + weighted average + VERDICT_FROM_VALUE lookup enables clean weighted aggregation of three judge verdicts with bidirectional mapping
- [Phase 11-02]: enqueueCouncilJobs not exported — internal to completion-checker, enforcing fire-and-forget contract at module boundary; callers cannot accidentally await it
- [Phase 11-02]: councilQueue.addBulk used instead of individual add() calls — atomic bulk enqueue per execution is cleaner and reduces Redis round-trips
- [Phase 12-01]: GET /verdicts/pending only surfaces Promote and Retire verdicts — Maintain/Monitor/Demote never require human confirmation per CONF requirements
- [Phase 12-01]: Confirm and reject use single atomic UPDATE WHERE status=pending AND verdictType IN (Promote,Retire) plus .returning() — eliminates race conditions vs SELECT-then-UPDATE; 0 rows returned means 409
- [Phase 12-01]: reject endpoint does NOT set confirmedAt — only confirmedBy and timeOnScreenMs; rejection is not a confirmation event
- [Phase 12-01]: warningTriggered threshold total>=10 AND rate>0.95 — requires meaningful sample size before anti-rubber-stamp alert triggers
- [Phase 12-01]: Migration 0006 renamed from 0006_parallel_rage to 0006_add_time_on_screen_ms following established rename pattern (08-02, 09-03, 10-01)
- [Phase 12-02]: evidenceLoaded flag set after getVerdict() resolves — action buttons not in DOM until evidence renders, enforcing CONF-02 at template level rather than CSS visibility
- [Phase 12-02]: arrivedAt = Date.now() on mount; timeOnScreenMs = Date.now() - arrivedAt at click time — captures actual reading time including scroll delay
- [Phase 12-02]: Reject button labeled "Reject — Your feedback teaches the army" per CONF-03; both buttons use flex:1 so neither dominates visual weight (equal-weight met structurally)
- [Phase 12-02]: Calibration warning uses amber color scheme (#fbbf24/#1a1100/#92400e) distinct from error (red) and info (blue) — signals behavioral feedback, not system failure
- [Phase 13-god-layer-and-agent-class-system]: agentClassEnum uses pgEnum; DnaPayload GODL-02 fields all optional for backward compat with existing rows; dna_store version uniqueness excludes NULL soul_id rows by Postgres NULL semantics (intentional); godLayerProcessedAt nullable with no default for idempotency guard pattern
- [Phase 13-02]: computeClassTransition counter update always runs before transition evaluation — updated counters used for all threshold checks; enables single-call idempotency; consistent with plan spec
- [Phase 13-02]: Non-soul-driven Retire returns type:none (Monitor treatment) — mirrors CLAS-04 pattern where context-driven events never trigger irreversible transitions
- [Phase 13-02]: VerdictInput exported as named interface to facilitate God Layer worker building VerdictInput from DB row fields without type assertion
- [Phase 13-03]: Transaction type alias (type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]) avoids importing PgTransaction generics from drizzle-orm/pg-core — cleaner and does not require explicit generic params
- [Phase 13-03]: pioneer-tracker uses single SELECT + existingRow === undefined check for pioneer detection — no separate COUNT query needed
- [Phase 13-03]: MATURE_THRESHOLD=3 and THIN_DATA_CLEAR_THRESHOLD=5 defined as module-internal constants in pioneer-tracker — not over-exported since they are implementation details
- [Phase 13-03]: mutationBlacklist key avoidMutationOps matches research spec (different from params field name mutationOpsApplied)
- [Phase 13-04]: IORedis v5 set() overload order requires EX, seconds, NX — not NX, EX, seconds; TypeScript enforces this via overload resolution
- [Phase 13-04]: God Layer processor skips DNA write and negative signal write when effectiveSoulId is null — soul-less executions produce class transitions only
- [Phase 13-04]: effectiveCategory resolved from job.data.taskCategory first, then soul.taskCategory fallback — ensures Redis lock key is consistent with enqueue-time category

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
- [Phase 8 blocker]: Confirm pgvector extension is enabled on Cloud SQL before running migration (`psql -c '\dx'`). Migrations 0003_soul_system_foundation.sql, 0004_add_human_review_flag.sql, AND 0005_decision_traces_unique_decision_id.sql are ready; apply via `cd packages/db && npx drizzle-kit migrate` after pgvector confirmed.
- [Phase 8 blocker]: Run seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [Phase 9 blocker]: Verify OpenClaw WebSocket task dispatch protocol — confirm whether `run_task` accepts extra fields (soul_content, task_category) or requires prompt-prefix injection.
- [Phase 10 complete]: DTRC-01 (attribution compiler) and DTRC-02 (admin TTL cleanup endpoint) fully satisfied. Cloud Scheduler can be configured to POST /admin/cleanup/decision-traces on a cron schedule.

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 13-04-PLAN.md (God Layer worker + wiring — god-layer-worker.ts, council-worker.ts, verdicts.ts, main.ts)
Resume file: None
