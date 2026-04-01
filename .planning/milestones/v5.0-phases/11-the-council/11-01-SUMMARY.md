---
phase: 11-the-council
plan: "01"
subsystem: api
tags: [bullmq, anthropic, google-gemini, zod, ai-sdk, council, llm-evaluation]

# Dependency graph
requires:
  - phase: 10-decision-trace-collection
    provides: decision_traces table with attributionConfidence, directiveReferenced, outcome fields
  - phase: 08-database-schema-and-shared-types
    provides: bot_souls schema (soulContent, constitutionDirectives, taskCategory, humanReviewFlag)
  - phase: 09-soul-generation-and-dispatch-integration
    provides: soul generation pipeline producing bot_souls rows
provides:
  - Council BullMQ queue definition (COUNCIL_QUEUE_NAME, CouncilJobData, councilQueue)
  - CouncilContext shared input type for all three judges
  - Performance Judge: Anthropic claude-sonnet-4-6 quantitative metrics evaluator
  - Soul Analyst: Anthropic claude-sonnet-4-6 counterfactual directive verification
  - Devil's Advocate: Google gemini-2.5-flash adversarial challenge generator
affects:
  - 11-the-council plan 02 (council worker wires these judges together)
  - 11-the-council plan 03 (confirmation gate uses verdict outputs)
  - 12-confirmation-gate (reads verdictType, requiresHumanConfirmation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Council judges: generateText + Output.object({ schema }) pattern (AI SDK 6)"
    - "Judge independence: each judge receives only CouncilContext, never peer outputs"
    - "Deterministic post-processing: threshold logic computed after LLM call overrides LLM-reported booleans"
    - "Heterogeneous provider: Performance/Soul use Anthropic, Devil's Advocate uses Google (CNCL-03)"

key-files:
  created:
    - services/execution-service/src/queue/council-queue.ts
    - services/execution-service/src/council/performance-judge.ts
    - services/execution-service/src/council/soul-analyst.ts
    - services/execution-service/src/council/devils-advocate.ts
  modified: []

key-decisions:
  - "Output import from AI SDK 6 is 'Output' (capital O) — the package re-exports lowercase 'output' namespace as 'Output'; import { Output } from 'ai'"
  - "Devil's Advocate uses google('gemini-2.5-flash') per CNCL-03 heterogeneous provider family requirement"
  - "COUNTERFACTUAL_OVERRIDE_THRESHOLD=0.25 exported as named constant for testability; threshold logic is deterministic post-processing, not LLM-determined"
  - "Soul Analyst filters to traces where attributionConfidence > 0.5 AND directiveReferenced non-null, capped at 20 — high-confidence subset prevents noise in counterfactual analysis"
  - "Devil's Advocate strongUnresolvedArgument deterministically computed as challenges.some(c => c.severity === 'strong') — overrides LLM value to guarantee CNCL-05 escalation logic"
  - "councilQueue reuses queueConnection from task-queue (same Redis) — no separate Redis connection needed for producer side; council worker in Plan 02 will import workerConnection directly from task-queue"

patterns-established:
  - "Judge module structure: Zod output schema -> type export -> system prompt constant -> prompt builder function -> single exported async function"
  - "Temperature discipline: factual judges at 0.2, adversarial judge at 0.5"
  - "Post-processing override pattern: LLM provides structured output, deterministic business logic corrects booleans/rates before returning"

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 11 Plan 01: The Council Summary

**BullMQ council queue + three independent LLM judge modules using AI SDK 6 generateText+Output.object pattern with Anthropic (Performance/Soul) and Google Gemini (Devil's Advocate)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T01:49:09Z
- **Completed:** 2026-02-22T01:52:47Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- Council BullMQ queue with CouncilJobData and CouncilContext types, reusing existing Redis connection
- Performance Judge using Anthropic claude-sonnet-4-6 — evaluates task metrics, success rate, tier, decision quality with verdictType+confidence+keyMetrics output
- Soul Analyst using Anthropic claude-sonnet-4-6 — counterfactual verification of directive attribution, 0.25 threshold override, disagreementRate computation, filters to high-confidence traces (>0.5, non-null directive, cap 20)
- Devil's Advocate using Google gemini-2.5-flash — adversarial challenge generation, deterministic strongUnresolvedArgument from challenge severity (CNCL-05), temperature 0.5 for creative adversarial reasoning
- All three judges structurally independent: receive only CouncilContext, never peer judge output (CNCL-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create council queue definition and shared CouncilContext type** - `1ec0d03` (feat)
2. **Task 2: Create three independent LLM judge modules** - `9623491` (feat)

## Files Created/Modified

- `services/execution-service/src/queue/council-queue.ts` - COUNCIL_QUEUE_NAME, CouncilJobData, CouncilContext, councilQueue instance
- `services/execution-service/src/council/performance-judge.ts` - PerformanceJudgeOutput, runPerformanceJudge using anthropic('claude-sonnet-4-6')
- `services/execution-service/src/council/soul-analyst.ts` - SoulAnalystOutput, COUNTERFACTUAL_OVERRIDE_THRESHOLD=0.25, runSoulAnalyst with deterministic post-processing
- `services/execution-service/src/council/devils-advocate.ts` - DevilsAdvocateOutput, runDevilsAdvocate using google('gemini-2.5-flash') with deterministic strongUnresolvedArgument

## Decisions Made

- `Output` import (capital O) from `ai` package — the package exports the `output` namespace as `Output`; using lowercase `output` caused a TypeScript error
- Devil's Advocate uses `google('gemini-2.5-flash')` per CNCL-03 heterogeneous provider family requirement — different analytical lens via different model family
- COUNTERFACTUAL_OVERRIDE_THRESHOLD exported as a named constant (not inlined) for Plan 02 testability
- Soul Analyst filters to `attributionConfidence > 0.5 AND directiveReferenced !== null`, capped at 20 — keeps the counterfactual analysis focused on high-confidence claims worth examining
- Council queue reuses `queueConnection` from `task-queue.ts` (same Redis, no extra connection); council worker in Plan 02 will import `workerConnection` directly from `task-queue`
- Deterministic post-processing overrides LLM-reported booleans: `counterfactualOverrides` and `strongUnresolvedArgument` are both computed from the data after the LLM call, not trusted from the LLM response

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect `output` import alias in all three judge files**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Plan specified `import { generateText, Output } from 'ai'` which is correct, but files were written with `import { generateText, output as Output } from 'ai'` — the AI SDK 6 package exports `output` namespace under the name `Output` (capital O), so `output` (lowercase) does not exist as an export
- **Fix:** Changed all three judge files to use `import { generateText, Output } from 'ai'` (capital O, no alias needed)
- **Files modified:** performance-judge.ts, soul-analyst.ts, devils-advocate.ts
- **Verification:** TypeScript compilation passes cleanly with zero errors
- **Committed in:** `9623491` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in import statement)
**Impact on plan:** Necessary for correctness; no scope creep; corrected within same task commit.

## Issues Encountered

None — TypeScript compilation was the only hiccup, resolved immediately.

## Next Phase Readiness

- Plan 02 (council worker processor) can now import `councilQueue`, `workerConnection` (from task-queue), `CouncilContext`, and all three judge run functions
- Plan 02 needs to assemble `CouncilContext` from database queries (bot_souls, decision_traces, telemetry), then call all three judges in parallel and persist to council_verdicts

## Self-Check: PASSED

- FOUND: services/execution-service/src/queue/council-queue.ts
- FOUND: services/execution-service/src/council/performance-judge.ts
- FOUND: services/execution-service/src/council/soul-analyst.ts
- FOUND: services/execution-service/src/council/devils-advocate.ts
- FOUND: .planning/phases/11-the-council/11-01-SUMMARY.md
- FOUND commit: 1ec0d03 (Task 1 — council queue definition)
- FOUND commit: 9623491 (Task 2 — three judge modules)
- TypeScript: CLEAN (zero errors)

---
*Phase: 11-the-council*
*Completed: 2026-02-22*
