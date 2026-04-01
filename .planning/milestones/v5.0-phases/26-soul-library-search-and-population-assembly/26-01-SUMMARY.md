---
phase: 26-soul-library-search-and-population-assembly
plan: 01
subsystem: api
tags: [pgvector, drizzle, openai-embeddings, soul-search, ring-leader, cosine-similarity]

# Dependency graph
requires:
  - phase: 24-ring-leader-schema-and-shared-types
    provides: SOUL_SEARCH_SIMILARITY_THRESHOLD, TaskComplexity, CampaignType from @claw/shared-types
  - phase: 24-ring-leader-schema-and-shared-types
    provides: bot_souls, negative_signal_register, agent_classes schema tables
provides:
  - searchSoulLibrary function: multi-filter library query returning 2x soul pool for Ring Leader
  - SoulSearchParams interface: typed input for all search dimensions
  - SoulSearchResult interface: ranked result with similarity score, campaign boost, and final rank
affects:
  - 26-02 (population assembly — will consume searchSoulLibrary for task assignment)
  - 26-03+ (any soul selection or pioneer path phases)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pgvector cosine distance via drizzle sql`` template tag with <=> operator
    - db.execute<Row extends Record<string, unknown>>(sql) pattern for raw SQL queries
    - Application-layer filtering after DB query for complex multi-criteria exclusion
    - Interface extends Record<string, unknown> to satisfy drizzle execute generic constraint

key-files:
  created:
    - services/execution-service/src/services/soul-library-search.ts
  modified: []

key-decisions:
  - "pgvector <=> cosine distance computed in SQL; similarity threshold applied at query level not application level"
  - "Negative signal exclusion done via LEFT JOIN + IS NULL rather than subquery for single-pass elimination"
  - "Agent class lookup via LEFT JOIN agent_classes on (bot_id, task_category); defaults to Novice if no row"
  - "Required tools and complexity filters applied in application layer after DB fetch (avoids JSONB query complexity)"
  - "Campaign boost uses sibling-count proxy (souls sharing same parentSoulId) as lineage-reuse signal"
  - "RawSoulRow uses snake_case to match PostgreSQL column names returned by raw db.execute query"

patterns-established:
  - "Raw SQL via drizzle sql`` tag: use db.execute<T extends Record<string, unknown>> and access .rows"
  - "Snake_case interface properties for raw SQL result types; camelCase for mapped application types"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 26 Plan 01: Soul Library Search Summary

**pgvector cosine similarity search of Akashic Library with 5-filter pipeline (similarity, negative signal exclusion, tools, complexity, campaign weighting) returning a ranked 2x selection pool**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T10:40:01Z
- **Completed:** 2026-03-02T10:42:34Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `soul-library-search.ts` implementing the Ring Leader's Akashic Library search engine
- pgvector query with LEFT JOINs excludes negative-signal souls and resolves agent class in one pass
- Application-layer tool doctrine substring matching and high-complexity Novice exclusion
- Campaign type weighting via lineage sibling-count proxy: +0.05 boost for reused soul lineages
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create soul-library-search.ts with multi-filter library query** - `f6f047f` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `services/execution-service/src/services/soul-library-search.ts` — searchSoulLibrary function: 5-filter search pipeline + 2x pool return for Ring Leader soul assembly

## Decisions Made
- pgvector `<=>` cosine distance used in SQL WHERE clause (not post-fetch); allows DB index scans to do the heavy lifting
- Negative signal exclusion via LEFT JOIN + `nsr.id IS NULL` — single SQL pass, no subquery
- Required tools filter done in app layer via toolUsageDoctrine JSONB field substring match — avoids JSONB operator complexity in raw SQL
- Campaign boost uses sibling count (souls with same parentSoulId) as a proxy for lineage reuse rather than counting distinct executionIds (simpler, good enough for Phase 26)
- drizzle `db.execute<T>` requires `T extends Record<string, unknown>` — interface must extend this to satisfy constraint; raw query returns snake_case column names

## Deviations from Plan

None - plan executed exactly as written. TypeScript type constraint issue with `db.execute` was resolved inline (Rule 3 — blocking) during initial implementation by adding `extends Record<string, unknown>` to internal interfaces.

## Issues Encountered
- `db.execute<T>` generic constraint requires `T extends Record<string, unknown>` — raw SQL result interfaces must extend this. Added `extends Record<string, unknown>` to `RawSoulRow` and `LineageRow` interfaces to satisfy drizzle's type system. Resolved in first compile pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `searchSoulLibrary` is ready for consumption by Phase 26 Plan 02 (population assembly)
- Pioneer path (no library results) will be handled by a separate plan calling soul-generator.ts
- Caller must handle the case where pool size < requiredPopulation (insufficient library results)

## Self-Check: PASSED

- soul-library-search.ts: FOUND
- 26-01-SUMMARY.md: FOUND
- commit f6f047f: FOUND

---
*Phase: 26-soul-library-search-and-population-assembly*
*Completed: 2026-03-02*
