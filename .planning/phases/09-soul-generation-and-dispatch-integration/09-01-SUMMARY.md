---
phase: 09-soul-generation-and-dispatch-integration
plan: 01
subsystem: api
tags: [soul-generation, llm-mutation, embeddings, drizzle, openai, pgvector, cosine-similarity]

# Dependency graph
requires:
  - phase: 08-database-schema-and-shared-types
    provides: bot_souls table with vector(1536) embedding column, SoulDimension type, archetype seed data

provides:
  - "generateSoulPopulation(executionId, objective, populationSize) — full soul generation pipeline"
  - "Known-path soul generation: top-5 historical parents + diversity parent, 5 mutation operations at temp=0.4"
  - "Novel-path soul generation: archetype pool round-robin, 2 light operations at temp=0.2 to preserve archetype spread"
  - "Constitution validation with up to MAX_MUTATION_ITERATIONS=5 retries, then humanReviewFlag"
  - "Pairwise cosine similarity enforcement at 0.85 threshold with targeted remutation"
  - "Batch embedding via text-embedding-3-small (1536d) matching bot_souls.embedding schema column"

affects:
  - 09-02-dispatch-integration
  - 10-decision-trace-capture
  - 11-council-evaluation
  - 13-soul-mutation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soul generation pipeline: classify → query parents → mutate → validate constitution → embed batch → pairwise similarity → persist"
    - "Path-conditional mutation: KNOWN (5 ops, temp=0.4) vs NOVEL (2 ops, temp=0.2) based on historical soul count"
    - "Safe array access with noUncheckedIndexedAccess: pickFromPool() helper + explicit undefined guards"
    - "Batch embedding with embedMany() then Array.from() for type compatibility with drizzle vector insert"

key-files:
  created:
    - services/execution-service/src/services/soul-generator.ts
  modified: []

key-decisions:
  - "Novel path restricted to Substitution and Attenuation only at temperature 0.2 — preserves archetype spread that is the entire point of SGEN-02 (amplification/recombination/introduction would destroy behavioral distinctiveness)"
  - "pickFromPool() helper wraps array access with guaranteed non-undefined return to satisfy noUncheckedIndexedAccess without littering code with null assertions"
  - "Array.from(embedding) applied after embedMany to convert EmbeddingModelV3Embedding (Array<number>) to plain number[] for drizzle vector insert compatibility"
  - "Diversity parent query uses OFFSET 2 LIMIT 1 — skips top-2 to get a mid-tier soul that adds variance without being a low-performer"
  - "humanReviewFlag set on soul (not thrown as error) when MAX_MUTATION_ITERATIONS exceeded — prevents pipeline stall per SGEN-04/05 requirements"

patterns-established:
  - "Soul generation pipeline: 10-step sequential flow as internal implementation of generateSoulPopulation()"
  - "LLM calls: gpt-4o-mini for mutation, temperature varies by path (0.4 known / 0.2 novel)"
  - "Constitution enforcement: verbatim includes() check after every mutation, before expensive embedding call"

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 9 Plan 01: Soul Generation Pipeline Summary

**LLM-based soul mutation pipeline with path-conditional operations (5 ops/temp=0.4 for known, 2 ops/temp=0.2 for novel), constitution validation, pairwise cosine similarity enforcement, and bot_souls persistence via text-embedding-3-small (1536d)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T08:00:04Z
- **Completed:** 2026-02-21T08:03:12Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `soul-generator.ts` with `generateSoulPopulation(executionId, objective, populationSize)` — the only public export
- Known path (SGEN-01): queries top-5 historical parents by compositeScore + 1 mid-tier diversity parent; applies all 5 mutation operations at temperature 0.4
- Novel path (SGEN-02): round-robin archetypes as parents; applies only Substitution and Attenuation at temperature 0.2 to preserve archetype behavioral spread
- Constitution validation (SGEN-05): verbatim directive check after every mutation, up to 5 retries, then humanReviewFlag
- Batch embedding via `embedMany()` with `text-embedding-3-small` (1536d matching schema)
- Pairwise similarity enforcement (SGEN-04): cosineSimilarity threshold 0.85, remutation with diversity prompt, up to 5 iterations per pair
- All souls persisted to `bot_souls` table with embeddings, parsed 7-dimension breakdown, and lineage linkage
- Zero new npm packages installed; zero TypeScript errors with strict + noUncheckedIndexedAccess

## Task Commits

Each task was committed atomically:

1. **Task 1: Create soul-generator.ts with full generation pipeline** - `1ac2248` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified

- `services/execution-service/src/services/soul-generator.ts` — Full soul generation pipeline: 495 lines, single public export, all 6 SGEN requirements implemented

## Decisions Made

- Novel path restricted to Substitution and Attenuation only at temperature 0.2 — amplification, recombination, and introduction would erode archetype spread by adding specificity, merging profiles, or injecting novelty
- `pickFromPool<T>()` helper wraps index-modulo access with an `undefined` throw guard to satisfy `noUncheckedIndexedAccess` without polluting callsites with `!` assertions
- `Array.from(embedding)` used after `embedMany()` to coerce `EmbeddingModelV3Embedding` (which is `Array<number>`) to a plain `number[]` accepted by drizzle vector insert
- Diversity parent query uses `OFFSET 2 LIMIT 1` to skip top-2 performers and sample mid-tier variance
- `humanReviewFlag` set on soul record (not thrown) when `MAX_MUTATION_ITERATIONS` exceeded — allows pipeline to complete and flag for manual review per SGEN-04/05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript strict mode (`noUncheckedIndexedAccess`) required all array accesses to be guarded. Fixed by:
1. Introducing `pickFromPool<T>()` helper for index-modulo pattern
2. Adding `undefined` guards before `candidates[i]`/`candidates[j]` accesses in loops
3. Using `Array.from()` for embedding type compatibility

All fixes are correctness improvements consistent with the codebase's strict TypeScript settings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `generateSoulPopulation(executionId, objective, populationSize)` is ready for Plan 02 integration
- Plan 02 must: wire soul generation into `executions.ts` setImmediate block (between planObjective and spawnBotsForExecution), extend `gce-bot-launcher.ts` to write SOUL.md via base64 in startup script, and extend `spawnBot()` to accept soulId + soulContent
- Blocker: OpenClaw WebSocket protocol must be confirmed before finalizing the soul delivery approach (already documented in STATE.md)

---
*Phase: 09-soul-generation-and-dispatch-integration*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: `services/execution-service/src/services/soul-generator.ts`
- FOUND: `.planning/phases/09-soul-generation-and-dispatch-integration/09-01-SUMMARY.md`
- FOUND: commit `1ac2248`
