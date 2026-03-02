---
phase: 26-soul-library-search-and-population-assembly
verified: 2026-03-02T10:53:05Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 26: Soul Library Search and Population Assembly — Verification Report

**Phase Goal:** The Ring Leader can search the Akashic Library to assemble a differentiated population of souls per task, handle novel tasks with archetypal generation, and produce a structured population manifest ready for spawning.
**Verified:** 2026-03-02T10:53:05Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                           | Status     | Evidence                                                                                                    |
|-----|-------------------------------------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------------|
| 1   | Library search filters by embedding similarity >= 0.78, excludes negative-signal souls, filters by tools and complexity, applies campaign weighting, returns 2x pool | ✓ VERIFIED | `searchSoulLibrary` in `soul-library-search.ts`: SQL WHERE uses `<=>` operator with `SOUL_SEARCH_SIMILARITY_THRESHOLD`, LEFT JOIN `negativeSignalRegister` with `nsr.id IS NULL`, app-layer tool doctrine substring match, Novice exclusion for high complexity, +0.05 campaign boost via sibling lineage count, `results.slice(0, requiredPopulation * 2)` |
| 2   | Ring Leader selects from pool with Artisan-first class priority; no two selected souls have cosine similarity >= 0.85 | ✓ VERIFIED | `selectFromPool` in `population-assembler.ts`: sorts by `CLASS_PRIORITY` map (`Artisan=0, Understudy=1, Novice=2`); greedy loop uses `cosineSimilarity` from `ai` against `SOUL_DIFFERENTIATION_THRESHOLD` (0.85) and skips violating candidates |
| 3   | Ring Leader can apply a single mutation (substitution or amplification) to a selected soul and log the operation and rationale | ✓ VERIFIED | `applyPreDeploymentMutation` in `population-assembler.ts`: throws on any operation not in `['substitution', 'amplification']`; applies LLM mutation via `gpt-4o-mini`; re-embeds mutated content; returns `MutationResult` with `operation` and `rationale` fields logged |
| 4   | For a novel task with insufficient library results, Ring Leader generates 5 archetypal souls and flags the task as Pioneer | ✓ VERIFIED | `generatePioneerPopulation` in `pioneer-generator.ts`: `PIONEER_POPULATION_SIZE = 5`; archetype-derived path when archetypes exist, scratch path with `BEHAVIORAL_ARCHETYPES` when none; all 5 persisted to `bot_souls`; `assemble-population.ts` sets `isPioneerPath = searchResults.length < node.minPopulation` and propagates as `pioneerFlag: isPioneerPath` in manifest |
| 5   | Ring Leader produces a PopulationManifest per task with all required fields: soul_id, agent_class, source, parent_soul_id, mutation_applied, selection_rationale, differentiation_score | ✓ VERIFIED | `assemblePopulation` in `assemble-population.ts`: manifest built with all 7 `SoulSelectionEntry` fields per soul plus `taskId`, `taskDescription`, `pioneerFlag`, `varianceIntent`; persisted to `ringLeaderRuns.populationManifest` and status transitioned to `'spawning'` |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact                                                                         | Expected                                                | Status     | Details                                                                                                   |
|----------------------------------------------------------------------------------|---------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------|
| `services/execution-service/src/services/soul-library-search.ts`                | `searchSoulLibrary`, `SoulSearchParams`, `SoulSearchResult` | ✓ VERIFIED | 263 lines; exports all three; substantive pgvector SQL query with LEFT JOINs, 5-filter pipeline, 2x pool slice |
| `services/execution-service/src/services/population-assembler.ts`               | `selectFromPool`, `applyPreDeploymentMutation`, `PoolSelectionParams`, `SelectedSoul`, `MutationResult` | ✓ VERIFIED | 271 lines; exports all five; class-priority sort, greedy differentiation enforcement, LLM mutation + re-embed |
| `services/execution-service/src/services/pioneer-generator.ts`                  | `generatePioneerPopulation`                             | ✓ VERIFIED | 302 lines; exports function; archetype-derived and from-scratch paths, batch embed via `embedMany`, DB persist, pairwise differentiation scoring |
| `services/execution-service/src/services/assemble-population.ts`                | `assemblePopulation`                                    | ✓ VERIFIED | 222 lines; exports function; full pipeline: classify → search → pioneer/library path → optional mutation → manifest build → DB persist + status transition |
| `services/execution-service/src/services/ring-leader-spawner.ts`                | Updated to call `assemblePopulation`                    | ✓ VERIFIED | Imports `assemblePopulation` from `./assemble-population`; fire-and-forget call with error handling that sets status to `'failed'` on failure; no TODO placeholder |

---

### Key Link Verification

| From                              | To                                         | Via                                           | Status     | Details                                                                                   |
|-----------------------------------|--------------------------------------------|-----------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| `soul-library-search.ts`          | `@claw/db` (botSouls, negativeSignalRegister, agentClasses) | `db.execute<RawSoulRow>(sql\`...\`)` drizzle query | ✓ WIRED | SQL uses `${botSouls}`, `${negativeSignalRegister}`, `${agentClasses}` table references; LEFT JOINs confirmed in source |
| `soul-library-search.ts`          | `@claw/shared-types`                       | `SOUL_SEARCH_SIMILARITY_THRESHOLD` import      | ✓ WIRED | Line 6: `import { SOUL_SEARCH_SIMILARITY_THRESHOLD, ... } from '@claw/shared-types'`; used in SQL WHERE clause at line 123 |
| `population-assembler.ts`         | `@claw/shared-types`                       | `SOUL_DIFFERENTIATION_THRESHOLD`, `SoulSelectionEntry` | ✓ WIRED | Line 3: `import { SOUL_DIFFERENTIATION_THRESHOLD, type SoulSelectionEntry } from '@claw/shared-types'`; threshold used in greedy loop at line 118 |
| `population-assembler.ts`         | `soul-library-search.ts`                   | `SoulSearchResult` type consumption           | ✓ WIRED | Line 4: `import type { SoulSearchResult } from './soul-library-search'`; used as `pool: SoulSearchResult[]` in `PoolSelectionParams` |
| `assemble-population.ts`          | `soul-library-search.ts`                   | `searchSoulLibrary` call per task             | ✓ WIRED | Line 5: `import { searchSoulLibrary } from './soul-library-search'`; called at line 66 inside task loop |
| `assemble-population.ts`          | `population-assembler.ts`                  | `selectFromPool`, `applyPreDeploymentMutation` | ✓ WIRED | Line 6: both imported; `selectFromPool` called at line 106; `applyPreDeploymentMutation` called at line 144 |
| `assemble-population.ts`          | `pioneer-generator.ts`                     | `generatePioneerPopulation` call when pool insufficient | ✓ WIRED | Line 8: imported; called at line 92 (primary pioneer path) and line 120 (supplemental path) |
| `assemble-population.ts`          | `@claw/db` (ringLeaderRuns)                | `populationManifest` persisted to DB          | ✓ WIRED | Lines 206-213: `db.update(ringLeaderRuns).set({ populationManifest: manifests, status: 'spawning', updatedAt: new Date() })` |
| `ring-leader-spawner.ts`          | `assemble-population.ts`                   | `assemblePopulation` called after DB row creation | ✓ WIRED | Line 4: imported; line 93: `assemblePopulation(ringLeaderRunId, missionBrief).catch(...)` — fire-and-forget with error fallback |

---

### Requirements Coverage

| Requirement | Status      | Notes                                                                            |
|-------------|-------------|----------------------------------------------------------------------------------|
| SOUL-01: Embedding similarity filter >= 0.78 | ✓ SATISFIED | SQL WHERE uses `<=>` operator against `SOUL_SEARCH_SIMILARITY_THRESHOLD` |
| SOUL-02: Negative signal exclusion            | ✓ SATISFIED | LEFT JOIN `negativeSignalRegister` + `nsr.id IS NULL` filter                     |
| SOUL-03: 2x pool return                       | ✓ SATISFIED | `results.slice(0, requiredPopulation * 2)`                                        |
| SOUL-04: Artisan-first + cosine < 0.85 enforcement | ✓ SATISFIED | `CLASS_PRIORITY` sort + greedy pairwise check with `SOUL_DIFFERENTIATION_THRESHOLD` |
| SOUL-05: Pre-deployment mutation (substitution/amplification) | ✓ SATISFIED | `applyPreDeploymentMutation` with strict op validation; applied to lowest-ranked soul on high-complexity tasks |
| SOUL-06: Pioneer path for novel tasks (5 archetypal souls) | ✓ SATISFIED | `generatePioneerPopulation` generates exactly 5 souls; triggered when `searchResults.length < node.minPopulation` |
| SOUL-07: Multi-soul variance intent            | ✓ SATISFIED | `varianceIntent` string set for `recommendedPopulation > 1`; passed through to manifest |
| SOUL-08: PopulationManifest with all required fields | ✓ SATISFIED | All 7 `SoulSelectionEntry` fields present plus `taskId`, `taskDescription`, `pioneerFlag`, `varianceIntent` |

---

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder returns, stub implementations, or empty handlers found in any of the five created/modified files.

---

### Human Verification Required

The following behaviors are correct by code inspection but are only observable at runtime with a live database and OpenAI API:

**1. pgvector Cosine Similarity Accuracy**
Test: Execute `searchSoulLibrary` against a live DB with seeded souls; verify that only souls with embedding cosine distance `<=` 0.22 (i.e., similarity >= 0.78) are returned.
Expected: Results respect the similarity threshold at SQL level.
Why human: Requires a running Postgres instance with pgvector extension and seeded embeddings.

**2. Pioneer Flag Propagation End-to-End**
Test: Trigger `spawnRingLeader` for a task category with no matching souls in the library; verify that `ring_leader_runs.population_manifest[].pioneer_flag` is `true` in the DB row.
Expected: `pioneerFlag: true` on every manifest entry for that task.
Why human: Requires live DB, OpenAI API calls for soul generation, and checking the persisted JSONB column.

**3. Status Transition: assembling -> spawning**
Test: After calling `spawnRingLeader`, poll `ring_leader_runs` until `status = 'spawning'`; verify it transitions within the async assembly window.
Expected: `status` column changes from `'assembling'` to `'spawning'` after population manifest is persisted.
Why human: Fire-and-forget async — requires live observation of the DB row.

---

### Gaps Summary

No gaps. All 5 observable truths are verified, all 5 required artifacts are substantive and wired, all 8 key links are confirmed in source, and TypeScript compilation passes with zero errors. The phase goal is fully achieved.

---

_Verified: 2026-03-02T10:53:05Z_
_Verifier: Claude (gsd-verifier)_
