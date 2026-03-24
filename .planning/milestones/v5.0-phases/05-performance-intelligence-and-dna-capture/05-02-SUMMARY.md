---
phase: 05-evolution-routes
plan: 02
subsystem: akasa-server / council / evolution-trigger
tags: [council, tdd, vitest, evolution-trigger, polling, weighted-verdict, devil-advocate]
dependency_graph:
  requires:
    - services/akasa-server/src/council/performance-judge.ts (new, this plan)
    - packages/db councilVerdicts schema
    - packages/db bots.paperclipAgentId (from plan 01)
    - paperclip/packages/db heartbeatRuns table
  provides:
    - services/akasa-server/src/council/performance-judge.ts
    - services/akasa-server/src/council/soul-analyst.ts
    - services/akasa-server/src/council/devils-advocate.ts
    - services/akasa-server/src/council/council-runner.ts
    - services/akasa-server/src/routes/council.ts
    - services/akasa-server/src/routes/evolution-trigger.ts
  affects:
    - services/akasa-server/src/routes/index.ts (adds /api/akasa/verdicts, /api/akasa/evolution)
    - services/akasa-server/src/index.ts (adds evolution polling startup)
tech_stack:
  added:
    - "zod@^3.25" (via workspace pnpm add)
  patterns:
    - TDD: RED (test scaffold) → GREEN (implementation) per task
    - Promise.allSettled for parallel judge execution with graceful partial failure
    - Deterministic post-processing overrides LLM output for structural guarantees
    - Fire-and-forget runCouncilForBot.catch() per coding conventions
    - Top-level vi.mock() hoisting pattern for Vitest (avoids local variable reference errors)
key_files:
  created:
    - services/akasa-server/src/council/performance-judge.ts
    - services/akasa-server/src/council/soul-analyst.ts
    - services/akasa-server/src/council/devils-advocate.ts
    - services/akasa-server/src/council/council-runner.ts
    - services/akasa-server/src/routes/council.ts
    - services/akasa-server/src/routes/evolution-trigger.ts
    - services/akasa-server/src/__tests__/council.test.ts
    - services/akasa-server/src/__tests__/evolution-trigger.test.ts
  modified:
    - services/akasa-server/src/routes/index.ts
    - services/akasa-server/src/index.ts
    - services/akasa-server/package.json (added zod)
decisions:
  - Devil's Advocate uses @ai-sdk/openai gpt-4o-mini (OpenAI family), NOT @ai-sdk/google as in execution-service — plan spec says OpenAI, CLAUDE.md says different provider from PJ (Anthropic), both satisfied
  - Council runner weights are 0.5/0.3/0.2 (PJ/SA/DA) per plan spec, matching execution-service aggregateVerdicts logic
  - requiresHumanConfirmation set for Promote and Retire (both extremes) — per plan spec (differs from execution-service which uses DA strongUnresolvedArgument)
  - hasUnresolvedDevilsAdvocate=true when DA's verdict differs from weighted verdict (not only strongUnresolvedArgument)
  - Top-level vi.mock() used throughout — avoids hoisting errors when mockInsert was referenced inside factory
  - evolution-trigger.ts creates paperclipDb lazily via createDb(DATABASE_URL) in manual trigger route — avoids startup failure when DB not available
  - Partial judge failures handled: renormalized weights for fulfilled judges; all-failed fallback to Monitor with requiresHumanConfirmation=true
metrics:
  duration: "461s"
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 11
requirements_satisfied:
  - EVO-02
  - EVO-04
  - EVO-06
---

# Phase 05 Plan 02: Council Judges + Evolution Trigger Summary

**One-liner:** Three-judge council pipeline (PJ=Anthropic/SA=Anthropic/DA=OpenAI) with 0.5/0.3/0.2 weighted verdict aggregation, stored in council_verdicts, triggered automatically by 60s heartbeat_runs polling for completed Akasa-managed Paperclip agents.

## What Was Built

1. **Performance Judge (`council/performance-judge.ts`):** Uses `@ai-sdk/anthropic` claude-sonnet-4-6. Evaluates task completion rate, composite score, tier, and decision trace quality. Returns `PerformanceJudgeOutput` with verdictType, confidence, summary, reasoning, keyMetrics. Also exports `CouncilContext` interface used by all three judges.

2. **Soul Analyst (`council/soul-analyst.ts`):** Uses `@ai-sdk/anthropic` claude-sonnet-4-6 (same family as PJ is permitted; DA is the required heterogeneous judge). Performs counterfactual verification of directive attribution. Deterministic post-processing: recomputes `counterfactualOverrides` via `|counterfactualScore - selfReportedConfidence| > 0.25` and recomputes `disagreementRate` from corrected overrides, overriding LLM values.

3. **Devil's Advocate (`council/devils-advocate.ts`):** MUST use `@ai-sdk/openai` gpt-4o-mini per CLAUDE.md ("Devil's Advocate must always use a different LLM provider family than Performance Judge"). Adversarial judge challenges performance evidence. Deterministic post-processing: recomputes `strongUnresolvedArgument = challenges.some(c => c.severity === 'strong')`.

4. **Council Runner (`council/council-runner.ts`):** `runCouncilForBot(executionId, botId, soulId)` assembles `CouncilContext` from Akasa DB, calls all three judges via `Promise.allSettled`, handles partial failures gracefully (renormalizes weights for fulfilled judges), computes weighted verdict, inserts into `council_verdicts` table. Promote and Retire verdicts set `requiresHumanConfirmation=true`. DA verdict differs from weighted verdict sets `hasUnresolvedDevilsAdvocate=true`.

5. **Council Routes (`routes/council.ts`):** `GET /api/akasa/verdicts?executionId=` returns ordered list of verdicts; `GET /api/akasa/verdicts/:id` returns single verdict or 404.

6. **Evolution Trigger (`routes/evolution-trigger.ts`):** `checkAndTriggerCouncilEvaluations(paperclipDb, akasaDb)` queries heartbeat_runs (status in ['succeeded','failed'], finishedAt > 5 min ago), matches agents to Akasa bots via `paperclipAgentId`, skips runs with existing verdicts, fire-and-forgets `runCouncilForBot`. `startEvolutionPolling()` wraps in `setInterval(60s)`. Manual `POST /api/akasa/evolution/trigger` route for on-demand checks.

7. **Wiring:** `akasaRouter` mounts both routers. `index.ts` calls `startEvolutionPolling(db, akasaDb)` after server starts listening.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock hoisting error with local mockInsert variable**
- **Found during:** Task 1 GREEN phase — tests failed with "ReferenceError: mockInsert is not defined"
- **Issue:** Initial test design used `vi.mock('@claw/db', () => { ... mockInsert ... })` where `mockInsert` was a local variable defined inside a `describe` block. Vitest hoists `vi.mock` calls to top of file, so `mockInsert` wasn't in scope.
- **Fix:** Restructured council tests to use top-level `vi.mock()` declarations with `vi.mocked()` pattern, setting mock return values inside each test using `vi.mocked(mockDb.insert).mockReturnValue(...)`. Removed local variable references from mock factories.
- **Files modified:** `services/akasa-server/src/__tests__/council.test.ts`
- **Commit:** ceed142

**2. [Rule 3 - Blocking] Missing zod dependency in akasa-server**
- **Found during:** Task 1 GREEN phase — tests failed with "Cannot find package 'zod'"
- **Issue:** Council judge files use `zod` for schema validation but akasa-server package.json didn't have it as a direct dependency. Vitest couldn't resolve it.
- **Fix:** `pnpm --filter @claw/akasa-server add zod` (resolved to zod@3.25.76)
- **Files modified:** `services/akasa-server/package.json`
- **Commit:** ceed142

**3. [Rule 2 - Missing Functionality] Evolution trigger mock for DATABASE_URL in manual trigger test**
- **Found during:** Task 2 GREEN phase — manual trigger test returned 500 because DATABASE_URL was not set in test env
- **Issue:** The manual trigger route creates a new `paperclipDb = createDb(DATABASE_URL)` — requires DATABASE_URL. Tests don't have it.
- **Fix:** Added `vi.mock('@paperclipai/db', ...)` at top of test file mocking `createDb`, and set `process.env.DATABASE_URL` within the failing test.
- **Files modified:** `services/akasa-server/src/__tests__/evolution-trigger.test.ts`
- **Commit:** 96d07f1

## Known Stubs

None — all three judges call real LLM APIs (mocked in tests only). Council runner makes real DB queries (mocked in tests). Evolution trigger polls real Paperclip DB and real Akasa DB.

## Self-Check: PASSED

Verified files exist:
- `services/akasa-server/src/council/performance-judge.ts` ✓
- `services/akasa-server/src/council/soul-analyst.ts` ✓
- `services/akasa-server/src/council/devils-advocate.ts` ✓
- `services/akasa-server/src/council/council-runner.ts` ✓
- `services/akasa-server/src/routes/council.ts` ✓
- `services/akasa-server/src/routes/evolution-trigger.ts` ✓

Verified commits:
- ceed142: feat(05-02): port council judges and council runner with weighted verdict aggregation ✓
- 96d07f1: feat(05-02): verdict CRUD routes, evolution trigger polling, wire into akasaRouter ✓

Tests: 26/26 passing (`pnpm --filter @claw/akasa-server exec vitest run`)
