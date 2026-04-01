---
phase: 09-soul-generation-and-dispatch-integration
plan: 03
subsystem: database
tags: [drizzle, postgres, schema, migration, soul-generator, human-review]

# Dependency graph
requires:
  - phase: 09-soul-generation-and-dispatch-integration
    provides: soul-generator.ts with in-memory humanReviewFlag set on SoulCandidate (09-01)
  - phase: 08-database-schema-and-shared-types
    provides: bot_souls table schema and 0003_soul_system_foundation migration (08-02)
provides:
  - humanReviewFlag boolean column on bot_souls table (schema + migration ready to apply)
  - Durable persistence of SGEN-05 human review flag — souls exceeding MAX_MUTATION_ITERATIONS stored with human_review_flag=true
affects:
  - Phase 10+ (council, confirmation gate, God Layer) — can now query bot_souls WHERE human_review_flag=true for operator review queue
  - Phase 8 migration run — 0004_add_human_review_flag.sql must be applied after pgvector confirmed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Drizzle migration rename pattern: rename auto-generated file name + update _journal.json tag to match (established in 08-02, reapplied)
    - Column placement: nullable/optional columns added after core fields, before timestamps

key-files:
  created:
    - packages/db/migrations/0004_add_human_review_flag.sql
    - packages/db/migrations/meta/0004_snapshot.json
  modified:
    - packages/db/src/schema/bot-souls.ts
    - packages/db/migrations/meta/_journal.json
    - services/execution-service/src/services/soul-generator.ts

key-decisions:
  - "humanReviewFlag column placed after embedding column and before createdAt — follows the established column ordering convention (operational fields before audit timestamps)"
  - "Migration renamed from 0004_empty_lady_bullseye to 0004_add_human_review_flag following the pattern established in 08-02 for 0003_soul_system_foundation — drizzle-kit tracks migrations by tag in _journal.json, so rename is safe"

patterns-established:
  - "Drizzle migration rename pattern: auto-generated name replaced with semantic name; _journal.json tag updated to match SQL filename"

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 9 Plan 03: Human Review Flag Persistence Summary

**`human_review_flag` boolean column added to bot_souls schema with ALTER TABLE migration and wired into soul-generator.ts db.insert, durably persisting SGEN-05 review flags to Postgres**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-21T10:20:51Z
- **Completed:** 2026-02-21T10:22:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `humanReviewFlag: boolean('human_review_flag').notNull().default(false)` to botSouls schema definition in `bot-souls.ts`
- Generated and renamed Drizzle migration `0004_add_human_review_flag.sql` with `ALTER TABLE "bot_souls" ADD COLUMN "human_review_flag" boolean DEFAULT false NOT NULL`
- Wired `humanReviewFlag: candidate.humanReviewFlag` into the `db.insert(botSouls).values({...})` call in soul-generator.ts
- Closed SGEN-05 gap: humanReviewFlag was set in-memory but never persisted; now durable in the database

## Task Commits

Each task was committed atomically:

1. **Task 1: Add humanReviewFlag column to bot_souls schema and generate migration** - `fc223cb` (feat)
2. **Task 2: Include humanReviewFlag in soul-generator.ts database insert** - `46d5950` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `packages/db/src/schema/bot-souls.ts` - Added humanReviewFlag boolean column (notNull, default false), placed after embedding before createdAt
- `packages/db/migrations/0004_add_human_review_flag.sql` - ALTER TABLE DDL to add human_review_flag column
- `packages/db/migrations/meta/_journal.json` - idx=4 entry with tag `0004_add_human_review_flag`
- `packages/db/migrations/meta/0004_snapshot.json` - Drizzle schema snapshot for migration idx=4
- `services/execution-service/src/services/soul-generator.ts` - humanReviewFlag: candidate.humanReviewFlag added to db.insert values

## Decisions Made

- Migration renamed from auto-generated `0004_empty_lady_bullseye` to `0004_add_human_review_flag` following the pattern established in Phase 08-02 — drizzle-kit tracks migrations by tag in `_journal.json`, so rename is fully safe; snapshot file is indexed numerically and unaffected
- humanReviewFlag column placed after embedding, before createdAt — consistent with the column ordering convention of operational fields before audit timestamps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Note: migration file is ready to apply but blocked on pgvector confirmation (existing Phase 8 blocker). Run `cd packages/db && npx drizzle-kit migrate` after pgvector is confirmed on Cloud SQL.

## Next Phase Readiness

- SGEN-05 is now fully satisfied: humanReviewFlag is durably persisted to the database
- VERIFICATION.md truth #8 moves from PARTIAL to VERIFIED: "Max iterations exceeded sets humanReviewFlag instead of blocking forever" — now stored in DB
- Operators can query `SELECT * FROM bot_souls WHERE human_review_flag = true` for the review queue
- Phase 9 soul generation pipeline is complete; ready for Phase 10 (decision traces and council integration)

---
*Phase: 09-soul-generation-and-dispatch-integration*
*Completed: 2026-02-21*
