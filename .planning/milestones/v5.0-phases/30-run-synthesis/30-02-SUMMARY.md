---
phase: 30-run-synthesis
plan: 02
subsystem: api
tags: [ring-leader, synthesis, council, performance-judge, bullmq, coordination]

# Dependency graph
requires:
  - phase: 30-run-synthesis-01
    provides: generateRunSynthesis function and RingLeaderSynthesis type
  - phase: 29-real-time-execution-coordination
    provides: coordination loop, getCoordinationLog, CoordinationContext
  - phase: 28-ring-leader-agent-spawning
    provides: populationManifest on ring_leader_runs row
provides:
  - Synthesis auto-triggers on coordination loop termination (SYNTH-01 through SYNTH-04 wired)
  - CouncilJobData and CouncilContext carry optional ringLeaderSynthesis field
  - Performance Judge prompt includes Ring Leader synthesis as primary context section
  - Satisfies SYNTH-05: Performance Judge receives synthesis as primary input before bot metrics
affects: [council-pipeline, performance-judge, completion-checker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget synthesis after coordination loop stop: generate → persist → transition to completed"
    - "Optional synthesis propagation: null for non-Ring-Leader runs, document for Ring Leader runs"
    - "Primary context injection: synthesis section prepended to performance judge prompt when present"

key-files:
  created: []
  modified:
    - services/execution-service/src/services/coordination-loop.ts
    - services/execution-service/src/queue/council-queue.ts
    - services/execution-service/src/queue/council-worker.ts
    - services/execution-service/src/council/performance-judge.ts
    - services/execution-service/src/orchestrator/completion-checker.ts

key-decisions:
  - "Synthesis is fire-and-forget from coordination loop (generateRunSynthesis handles its own status transition to completed)"
  - "populationManifest read directly from ring_leader_runs DB row at termination time (not passed through loop params)"
  - "ringLeaderSynthesis is optional/nullable in CouncilJobData — backward compat for non-Ring-Leader executions"
  - "Synthesis section prepended to performance judge prompt (not appended) to satisfy primary input requirement"
  - "completion-checker queries ring_leader_runs by executionId to fetch synthesis for council job bulk enqueue"

patterns-established:
  - "Primary context injection pattern: optional synthesis section prepended before bot metrics in performance judge prompt"
  - "Context propagation pattern: job data field → CouncilContext field → judge prompt section"

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 30 Plan 02: Run Synthesis Summary

**Synthesis auto-triggered on coordination loop termination and Ring Leader synthesis passed as primary input to Performance Judge via council pipeline (SYNTH-05)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T13:49:31Z
- **Completed:** 2026-03-02T13:51:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Coordination loop now fires `generateRunSynthesis` after transitioning to 'synthesizing'; synthesis runs independently and transitions run to 'completed' on success
- `CouncilJobData` and `CouncilContext` both include an optional `ringLeaderSynthesis` field
- `completion-checker` loads Ring Leader synthesis from `ring_leader_runs` before bulk-enqueuing council jobs, so every council job carries the synthesis document
- `council-worker` assigns synthesis from job data onto `CouncilContext` before invoking judges
- `performance-judge` builds a dedicated "Ring Leader Run Synthesis (Primary Context)" section prepended before bot metrics — satisfies SYNTH-05

## Task Commits

1. **Task 1: Wire synthesis into coordination loop termination** - `c1a7747` (feat)
2. **Task 2: Pass Ring Leader synthesis to Performance Judge via council pipeline** - `e4bca92` (feat)

## Files Created/Modified
- `services/execution-service/src/services/coordination-loop.ts` - Imports generateRunSynthesis and getCoordinationLog; fires synthesis after 'synthesizing' transition in tick() termination block
- `services/execution-service/src/queue/council-queue.ts` - Adds ringLeaderSynthesis field to CouncilJobData and CouncilContext; imports RingLeaderSynthesis type
- `services/execution-service/src/queue/council-worker.ts` - Assigns context.ringLeaderSynthesis from job.data before invoking judges
- `services/execution-service/src/council/performance-judge.ts` - Adds buildRingLeaderSynthesisSection helper; prepends synthesis section to buildPerformancePrompt output
- `services/execution-service/src/orchestrator/completion-checker.ts` - Loads ring_leader_runs synthesis before addBulk; passes ringLeaderSynthesis in each CouncilJobData

## Decisions Made
- Synthesis is fire-and-forget from the coordination loop: `generateRunSynthesis` handles its own DB persistence and status transition to 'completed'; the loop just fires it and calls `handle.stop()`
- `populationManifest` is read directly from the `ring_leader_runs` DB row at termination time rather than threaded through loop params — DB is the source of truth at this point
- `ringLeaderSynthesis` is optional/nullable in both `CouncilJobData` and `CouncilContext` for full backward compatibility with non-Ring-Leader executions
- Synthesis section is prepended (not appended) to the Performance Judge prompt to satisfy SYNTH-05's "primary input" requirement
- `completion-checker` uses `eq(ringLeaderRuns.executionId, executionId)` to locate the synthesis — a non-Ring-Leader execution simply returns no row, leaving `ringLeaderSynthesis` as null

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 30 complete: synthesis module built (Plan 01), wired into coordination loop and council pipeline (Plan 02)
- Ring Leader v4.0 end-to-end pipeline is now fully connected: population assembly → agent spawning → coordination loop → synthesis generation → council evaluation with synthesis context
- Ready for Phase 31 (next phase in roadmap)

## Self-Check: PASSED

All files verified present. Commits c1a7747 and e4bca92 confirmed in git log.

---
*Phase: 30-run-synthesis*
*Completed: 2026-03-02*
