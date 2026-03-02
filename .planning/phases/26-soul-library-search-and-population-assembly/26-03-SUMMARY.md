---
phase: 26-soul-library-search-and-population-assembly
plan: 03
subsystem: api
tags: [soul-library, population-assembly, pioneer-generation, ring-leader, ai-sdk, pgvector]

# Dependency graph
requires:
  - phase: 26-01
    provides: searchSoulLibrary function (soul-library-search.ts)
  - phase: 26-02
    provides: selectFromPool + applyPreDeploymentMutation (population-assembler.ts)
  - phase: 25
    provides: ring-leader-spawner.ts with spawnRingLeader function
provides:
  - pioneer-generator.ts: generatePioneerPopulation for novel tasks (SOUL-06)
  - assemble-population.ts: assemblePopulation top-level orchestrator (SOUL-08)
  - ring-leader-spawner.ts: wired to trigger population assembly async post-spawn
affects: [phase-27-ring-leader-spawn, phase-28-ring-leader-coordination, phase-29-ring-leader-synthesis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pioneer path: generate 5 souls from archetypes when library returns < minPopulation results"
    - "Pool shortfall supplement: library path supplemented with pioneers if selection < minPopulation"
    - "Fire-and-forget assembly: spawnRingLeader triggers assemblePopulation async; status transitions inside assemblePopulation"
    - "Optional pre-deployment mutation: high-complexity tasks amplify lowest-ranked selected soul"

key-files:
  created:
    - services/execution-service/src/services/pioneer-generator.ts
    - services/execution-service/src/services/assemble-population.ts
  modified:
    - services/execution-service/src/services/ring-leader-spawner.ts

key-decisions:
  - "Pioneer population always 5 souls (constant PIONEER_POPULATION_SIZE); covers behavioral spread: analytical, creative, cautious, aggressive, balanced"
  - "Archetype-derived pioneer path: if archetypes exist, derive task-specialized variants; otherwise generate from scratch with distinct behavioral profiles"
  - "Pool shortfall supplement: if library path produces fewer than minPopulation selected souls, pioneer generation fills the gap rather than failing"
  - "Task category classification happens per-task inside assemblePopulation (not pre-computed) to keep orchestrator self-contained"
  - "Status transition assembling -> spawning occurs inside assemblePopulation (not in spawner) — caller simply fires async without waiting"
  - "Mutation error in high-complexity path is non-fatal (caught + logged); assembly continues with unmutated soul rather than failing the whole task"

patterns-established:
  - "Pioneer generation uses temperature=0.3 for moderate diversity while staying on-archetype"
  - "Differentiation scores in pioneer population = 1 - cosine_similarity to nearest sibling (pairwise)"
  - "All pioneer souls inserted with isArchetype=false, generation=1, humanReviewFlag=false"

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 26 Plan 03: Pioneer Generation and Population Assembly Summary

**Full SOUL pipeline wired: pioneer-generator.ts generates 5 archetypal souls for novel tasks, assemble-population.ts orchestrates library-search -> pool-selection -> pioneer-gen -> optional-mutation -> manifest per task, persists PopulationManifest[] to ring_leader_runs, and ring-leader-spawner.ts fires the assembly async after DB row creation**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T10:47:39Z
- **Completed:** 2026-03-02T10:50:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `pioneer-generator.ts` with `generatePioneerPopulation` — generates 5 souls from archetypes (or scratch) for novel tasks, embeds all via text-embedding-3-small, persists to bot_souls, returns SelectedSoul[] with source='generated' and pairwise differentiation scores
- Created `assemble-population.ts` with `assemblePopulation` — top-level orchestrator that classifies task categories, runs library search per task, chooses pioneer vs. library path, applies optional amplification mutation for high-complexity tasks, assembles PopulationManifest[] and persists to ring_leader_runs with status transition to 'spawning'
- Updated `ring-leader-spawner.ts` — replaced TODO comment with fire-and-forget `assemblePopulation` call; error handler sets ring_leader_runs.status='failed'

## Task Commits

1. **Task 1: Create pioneer-generator.ts** - `c5e0744` (feat)
2. **Task 2: Create assemble-population.ts and wire ring-leader-spawner.ts** - `97ec6ef` (feat)

## Files Created/Modified

- `services/execution-service/src/services/pioneer-generator.ts` — generates 5 archetypal pioneer souls for novel tasks with insufficient library coverage (SOUL-06)
- `services/execution-service/src/services/assemble-population.ts` — top-level population assembly orchestrator tying together library search, pool selection, pioneer generation, mutation, and manifest building (SOUL-08)
- `services/execution-service/src/services/ring-leader-spawner.ts` — wired to call assemblePopulation async after DB row creation; error handling sets status=failed

## Decisions Made

- Pioneer population is always exactly 5 souls (PIONEER_POPULATION_SIZE constant) for consistent behavioral spread coverage
- Archetype-derived path used when archetypes exist; scratch-generation used as fallback with 5 distinct profiles (analytical, creative, cautious, aggressive, balanced)
- Pool shortfall after `selectFromPool` triggers supplemental pioneer generation rather than failing — library path remains preferred but shortfalls are gracefully handled
- Task category classification happens per-task inside `assemblePopulation` (not pre-classified) to keep each function self-contained
- Status transition `assembling -> spawning` lives inside `assemblePopulation` — the spawner fires and forgets so `spawnRingLeader` returns immediately
- Mutation errors in the high-complexity path are non-fatal: logged as warnings but assembly continues with unmutated soul

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- All 8 SOUL requirements (SOUL-01 through SOUL-08) are now implemented across Phase 26 plans 01-03
- `ring_leader_runs.populationManifest` is populated after each execution kicks off
- Status transitions correctly: assembling -> spawning (after population assembly) -> coordinating (Phase 27+)
- Phase 27 (Ring Leader Spawn) can now read the PopulationManifest from the DB row to know which souls to dispatch to bots

---
*Phase: 26-soul-library-search-and-population-assembly*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/pioneer-generator.ts
- FOUND: services/execution-service/src/services/assemble-population.ts
- FOUND: .planning/phases/26-soul-library-search-and-population-assembly/26-03-SUMMARY.md
- FOUND: commit c5e0744 (Task 1)
- FOUND: commit 97ec6ef (Task 2)
