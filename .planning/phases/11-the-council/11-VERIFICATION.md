---
phase: 11-the-council
verified: 2026-02-22T02:03:31Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 11: The Council Verification Report

**Phase Goal:** After every execution, three independent LLM judges evaluate each agent's performance and produce a weighted verdict with causal attribution — processed asynchronously on a dedicated queue so execution results surface immediately.
**Verified:** 2026-02-22T02:03:31Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths — Plan 01

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Council queue is defined with its own name, job data type, and connection exports | VERIFIED | `council-queue.ts` exports `COUNCIL_QUEUE_NAME = 'council-queue'`, `CouncilJobData`, `councilQueue`, `CouncilContext` |
| 2 | Performance Judge produces a structured verdict using Anthropic claude-sonnet-4-6 | VERIFIED | `performance-judge.ts` line 103: `model: anthropic('claude-sonnet-4-6')` with Zod schema and typed output |
| 3 | Soul Analyst produces a structured verdict with counterfactual verification using Anthropic | VERIFIED | `soul-analyst.ts` line 110: `model: anthropic('claude-sonnet-4-6')`, full counterfactual post-processing present |
| 4 | Devil's Advocate produces a structured verdict using Google gemini-2.5-flash (different provider) | VERIFIED | `devils-advocate.ts` line 116: `model: google('gemini-2.5-flash')` |
| 5 | Each judge accepts a context object and returns a typed output — no judge sees another's output | VERIFIED | No cross-judge imports found; each receives only `CouncilContext` |
| 6 | Soul Analyst filters to traces with attributionConfidence > 0.5 and non-null directiveReferenced, capped at 20 | VERIFIED | `soul-analyst.ts` lines 50-54: exact filter + `.slice(0, 20)` |
| 7 | Counterfactual override threshold is 0.25 | VERIFIED | `soul-analyst.ts` line 13: `export const COUNTERFACTUAL_OVERRIDE_THRESHOLD = 0.25` |
| 8 | Disagreement rate computed and returned in Soul Analyst output | VERIFIED | `soul-analyst.ts` lines 134-138: deterministic recomputation after LLM call |

### Observable Truths — Plan 02

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | After execution completes, council jobs enqueued on council-queue fire-and-forget, not blocking execution result | VERIFIED | `completion-checker.ts` line 98: `enqueueCouncilJobs(executionId).catch(...)` — not awaited, `.catch()` guard present |
| 10 | All three judges run in parallel via Promise.all — no inter-judge visibility before aggregation | VERIFIED | `council-worker.ts` line 243: `const [performanceOutput, soulOutput, devilOutput] = await Promise.all([...])` |
| 11 | Weighted verdict aggregation: Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15% | VERIFIED | `council-worker.ts` line 185: `perf.confidence * 0.5 + soul.confidence * 0.35 + devil.confidence * 0.15`; line 192 same for verdict type |
| 12 | Strong unresolved Devil's Advocate argument sets requiresHumanConfirmation = true | VERIFIED | `council-worker.ts` lines 197-198: `hasUnresolvedDevilsAdvocate = devil.strongUnresolvedArgument; requiresHumanConfirmation = hasUnresolvedDevilsAdvocate` |
| 13 | Each bot receives a council_verdicts row with verdict type, confidence, summary, and human-confirmation flag | VERIFIED | `council-worker.ts` lines 253-266: full `db.insert(councilVerdicts).values({...})` with all required fields |
| 14 | Council worker starts alongside dispatcher in main.ts and shuts down gracefully | VERIFIED | `main.ts` line 33: `startCouncilWorker()`; line 44: `councilWorker.close()` in `shutdown()` |
| 15 | Soul Analyst disagreement rate logged as console metric per job | VERIFIED | `council-worker.ts` lines 278-282: `console.log('[council-worker] Soul Analyst counterfactual disagreement rate:', ...)` |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `services/execution-service/src/queue/council-queue.ts` | VERIFIED | Exists, substantive (59 lines), exports `COUNCIL_QUEUE_NAME`, `CouncilJobData`, `CouncilContext`, `councilQueue`. Imports `queueConnection` from `task-queue`. |
| `services/execution-service/src/council/performance-judge.ts` | VERIFIED | Exists, substantive (115 lines). Exports `runPerformanceJudge`, `PerformanceJudgeOutput`. Uses `anthropic('claude-sonnet-4-6')` + `Output.object`. |
| `services/execution-service/src/council/soul-analyst.ts` | VERIFIED | Exists, substantive (145 lines). Exports `runSoulAnalyst`, `SoulAnalystOutput`, `COUNTERFACTUAL_OVERRIDE_THRESHOLD`. Deterministic post-processing implemented. |
| `services/execution-service/src/council/devils-advocate.ts` | VERIFIED | Exists, substantive (139 lines). Exports `runDevilsAdvocate`, `DevilsAdvocateOutput`. Uses `google('gemini-2.5-flash')`. Deterministic `strongUnresolvedArgument`. |
| `services/execution-service/src/queue/council-worker.ts` | VERIFIED | Exists, substantive (333 lines). Exports `startCouncilWorker`. Full processor: `loadCouncilContext`, `Promise.all` judges, `aggregateVerdicts`, `db.insert`. |
| `services/execution-service/src/orchestrator/completion-checker.ts` | VERIFIED | Modified — `enqueueCouncilJobs` function added, called fire-and-forget with `.catch()` after `runPerformancePipeline`. Not exported (internal contract). |
| `services/execution-service/src/main.ts` | VERIFIED | Modified — `startCouncilWorker` imported and called; `councilWorker.close()` in `shutdown()`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `council-queue.ts` | `task-queue.ts` | `import queueConnection` | WIRED | Line 2: `import { queueConnection } from './task-queue'`; used at line 57 |
| `performance-judge.ts` | `@ai-sdk/anthropic` | `anthropic('claude-sonnet-4-6')` | WIRED | Line 2: import; line 103: `model: anthropic('claude-sonnet-4-6')` |
| `devils-advocate.ts` | `@ai-sdk/google` | `google('gemini-2.5-flash')` | WIRED | Line 2: import; line 116: `model: google('gemini-2.5-flash')` |
| `council-worker.ts` | `performance-judge.ts` | `import runPerformanceJudge` | WIRED | Line 6 import; line 244 usage in `Promise.all` |
| `council-worker.ts` | `soul-analyst.ts` | `import runSoulAnalyst` | WIRED | Line 7 import; line 245 usage in `Promise.all` |
| `council-worker.ts` | `devils-advocate.ts` | `import runDevilsAdvocate` | WIRED | Line 8 import; line 246 usage in `Promise.all` |
| `council-worker.ts` | `@claw/db councilVerdicts` | `db.insert(councilVerdicts)` | WIRED | Line 2 import; line 253 `await db.insert(councilVerdicts).values(...)` |
| `completion-checker.ts` | `council-queue.ts` | `councilQueue.addBulk` | WIRED | Line 6 import; line 22 `await councilQueue.addBulk(...)` |
| `main.ts` | `council-worker.ts` | `import startCouncilWorker` | WIRED | Line 6 import; line 33 call; line 44 graceful close |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| CNCL-01: Async pipeline, execution results not blocked | SATISFIED | Fire-and-forget `enqueueCouncilJobs().catch()` in completion-checker; rate limiter 10/min on worker |
| CNCL-02: Judge independence — no judge sees another's output | SATISFIED | Each judge receives only `CouncilContext`; no cross-judge imports; `Promise.all` aggregates after all complete |
| CNCL-03: Heterogeneous provider — Performance/Soul = Anthropic, DA = Google | SATISFIED | Confirmed in all three judge files |
| CNCL-04: Disagreement rate logged per job | SATISFIED | `council-worker.ts` lines 278-282 |
| CNCL-05: 50/35/15 weights; strong DA argument escalates to human review | SATISFIED | `aggregateVerdicts()` lines 184-198 |
| CNCL-06: Verdict persisted with summary and human-confirmation flag | SATISFIED | `db.insert(councilVerdicts)` with all required fields; DB schema confirmed |

---

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments, no stub return patterns (`return null`, `return {}`, `return []`) in phase 11 files.

---

### Compilation

TypeScript compilation (`pnpm --filter execution-service exec tsc --noEmit`) exits with code 0. Zero errors across all new and modified files.

---

### Commit Verification

All four commits referenced in summaries confirmed in git log:

- `1ec0d03` — feat(11-01): council queue definition and CouncilContext type
- `9623491` — feat(11-01): three independent LLM judge modules
- `68e3e81` — feat(11-02): council worker processor with parallel judges and aggregation
- `46e9c6a` — feat(11-02): wire council enqueue into completion-checker and start worker in main.ts

---

### Human Verification Required

#### 1. LLM Provider API Key (Google)

**Test:** Confirm `GOOGLE_GENERATIVE_AI_API_KEY` is set in the `claw-app-dev` GCE VM environment.
**Expected:** Devil's Advocate judge can call `google('gemini-2.5-flash')` without authentication errors.
**Why human:** Environment variable presence on a GCE VM cannot be verified programmatically from this context.

#### 2. End-to-End Council Job Processing

**Test:** Complete an execution and observe BullMQ council-queue; verify a `council_verdicts` row appears in the database for each participating bot.
**Expected:** Within 2-3 minutes after execution completes, each bot has a `council_verdicts` row with `status='pending'`, a non-null `weighted_confidence_score`, and populated judge output JSON columns.
**Why human:** Requires a live execution, running worker, and database access.

#### 3. Soul Analyst Disagreement Rate Console Log

**Test:** Observe execution-service logs after a council job completes.
**Expected:** Log line `[council-worker] Soul Analyst counterfactual disagreement rate: { executionId, botId, disagreementRate: "X.XXX" }` appears.
**Why human:** Requires live worker and log access.

---

### Summary

Phase 11 goal is fully achieved. All seven files (4 created in Plan 01, 1 created + 2 modified in Plan 02) exist, are substantive implementations, and are correctly wired. The full async Council evaluation pipeline is operational:

- Council queue definition and shared `CouncilContext` type are established
- Three structurally independent LLM judges (Performance Judge via Anthropic, Soul Analyst via Anthropic with counterfactual verification, Devil's Advocate via Google Gemini) each produce typed verdicts
- Council worker loads context from DB, runs all three judges in parallel, aggregates with 50/35/15 weights, persists to `council_verdicts`, and logs disagreement rate
- Completion checker enqueues council jobs fire-and-forget immediately after execution completes — execution result surfacing is never blocked
- Council worker starts and shuts down gracefully in main.ts alongside the existing dispatcher

The only items requiring human verification are operational (environment variable for Google API key, live execution testing) rather than structural gaps in the implementation.

---

_Verified: 2026-02-22T02:03:31Z_
_Verifier: Claude (gsd-verifier)_
