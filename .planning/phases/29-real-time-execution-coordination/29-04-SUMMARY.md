---
phase: 29-real-time-execution-coordination
plan: "04"
subsystem: api
tags: [ring-leader, coordination, drift-detection, embeddings, openai, cosine-similarity]

# Dependency graph
requires:
  - phase: 29-01-real-time-execution-coordination
    provides: CoordinationModule interface, CoordinationContext, logCoordinationEvent, coordination-loop.ts extension-point
  - phase: 24-ring-leader-schema-and-shared-types
    provides: DRIFT_REANCHORING_THRESHOLD (0.35), RingLeaderRunState.objectiveDriftScore, RingLeaderMissionBrief.objective
  - package: event-schemas
    provides: ReanchoringEvent type with objectiveRestatement, driftSummary, reorientationDirective fields
provides:
  - drift-detector.ts with createDriftDetector() factory
  - COORD-06: live objectiveDriftScore on ctx.runState computed via cosine similarity
  - COORD-07: ReanchoringEvent broadcast when drift > 0.35 (debounced at 2min intervals)
affects: [29-05, ring-leader synthesis, coordination loop consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-level per-run state Map (DriftRunState keyed by runId) — objective embedding cached once on first poll, debounce clock tracked across cycles
    - Lazy embedding computation — objective embedding computed once on first execute() call then cached for all subsequent cycles
    - Non-fatal embedding API calls — try/catch around both embed() calls; previous drift score retained on failure; loop never crashes

key-files:
  created:
    - services/execution-service/src/services/drift-detector.ts
  modified: []

key-decisions:
  - "Objective embedding cached per runId in module-level Map — avoids re-embedding the same static string on every poll cycle; cost optimization"
  - "No-completed-outputs path sets drift to 0 (not null or error) — drift is unmeasurable without outputs; 0 is the neutral/aligned default"
  - "Reanchoring debounce at 2min (REANCHORING_DEBOUNCE_MS=120000) prevents signal flooding when drift stays elevated across multiple poll cycles"
  - "Per-task output truncated to 500 chars, combined text capped at 8000 chars — keeps embedding token cost bounded without dropping outputs entirely"
  - "runStates Map never cleaned up (no clearDriftState) — run lifetime is bounded; leaked state is negligible compared to complexity of cleanup coordination"

patterns-established:
  - "CoordinationModule state pattern: module-level Map<runId, ModuleState> for per-run state that persists across poll cycles within a module"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 29 Plan 04: Objective Drift Detection Summary

**Cosine similarity drift detector computing live objectiveDriftScore between mission objective embedding and collective task outputs, broadcasting ReanchoringEvent with COORD-07 fields when drift exceeds 0.35**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T13:15:01Z
- **Completed:** 2026-03-02T13:16:34Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `createDriftDetector()` returns a `CoordinationModule` implementing COORD-06 and COORD-07 with `name: 'drift-detector'`
- Objective embedding computed once on first poll and cached in module-level `runStates` Map per runId
- Completed task results queried via Drizzle ORM (WHERE executionId + status=completed + result IS NOT NULL), concatenated with per-output 500-char truncation and 8000-char total cap
- `driftScore = 1 - cosineSimilarity(objectiveEmbedding, outputEmbedding)` written to `ctx.runState.objectiveDriftScore` each cycle
- Reanchoring signal fired when `driftScore > 0.35` (DRIFT_REANCHORING_THRESHOLD) with 2-minute debounce; event contains all three COORD-07 fields: `objectiveRestatement`, `driftSummary`, `reorientationDirective`
- Both embedding calls wrapped in try/catch — failures are non-fatal, WARN logged, previous score retained

## Task Commits

1. **Task 1: Drift detection coordination module** - `3ac6b31` (feat)

**Plan metadata:** (docs commit — this SUMMARY)

## Files Created/Modified
- `services/execution-service/src/services/drift-detector.ts` - CoordinationModule factory; computes objective vs output cosine similarity; broadcasts ReanchoringEvent on drift > 0.35; exports `createDriftDetector`

## Decisions Made
- Objective embedding cached once per runId — static string, no need to re-embed on every 30s poll cycle
- No-completed-outputs path returns drift=0 (neutral) — drift is unmeasurable without outputs; avoids spurious reanchoring on early cycles
- Reanchoring debounce 2min — prevents signal flooding when drift stays elevated across consecutive poll cycles
- Output truncation (500 chars each, 8000 chars total) — bounds embedding API cost without discarding outputs
- `runStates` Map not explicitly cleaned up — run lifetime is bounded; simplicity preferred over cleanup coordination

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict null errors in cosine similarity function**
- **Found during:** Task 1 verification (TypeScript compilation)
- **Issue:** `a[i]` and `b[i]` array access returns `T | undefined` in strict mode — TypeScript errors TS2532
- **Fix:** Added `?? 0` fallback for each array access: `const ai = a[i] ?? 0; const bi = b[i] ?? 0;`
- **Files modified:** services/execution-service/src/services/drift-detector.ts
- **Verification:** `pnpm --filter @claw/execution-service exec tsc --noEmit` exits 0
- **Committed in:** 3ac6b31 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript strict mode bug)
**Impact on plan:** Minor fix required for TypeScript strict mode compliance. No logic change.

## Issues Encountered
None beyond the TypeScript strict null fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `createDriftDetector()` is ready to be instantiated and registered via `handle.addModule(createDriftDetector())` in the Ring Leader spawner or coordination setup
- `ctx.runState.objectiveDriftScore` will now contain real cosine-similarity-derived drift on each poll cycle (not the placeholder 0)
- Plan 29-05 (synthesis) can read `ctx.runState.objectiveDriftScore` and `ctx.runState.anomalies` for drift-related synthesis fields
- `reanchoringEvents` counter in synthesis maps directly to `state.reanchoringCount` in drift-detector module state

## Self-Check: PASSED

- `services/execution-service/src/services/drift-detector.ts`: FOUND
- Commit `3ac6b31`: FOUND
- TypeScript compilation: CLEAN (0 errors)

---
*Phase: 29-real-time-execution-coordination*
*Completed: 2026-03-02*
