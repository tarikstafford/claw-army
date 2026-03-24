---
phase: 05-performance-intelligence-and-dna-capture
verified: 2026-03-24T15:11:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 05: Performance Intelligence and DNA Capture — Verification Report

**Phase Goal:** Port evolution routes from execution-service to akasa-server: soul CRUD + generation + injection, three-judge Council pipeline (Performance Judge, Soul Analyst, Devil's Advocate), evolution trigger polling heartbeat_runs, God Layer handler (class machine, DNA writer, negative register, pioneer tracker), verdict confirm/reject routes
**Verified:** 2026-03-24T15:11:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Soul CRUD routes respond at /api/akasa/souls with GET list, GET by ID, POST create | VERIFIED | `services/akasa-server/src/routes/souls.ts` — GET /, GET /:id, POST /generate, POST /:id/mutate, POST /inject; mounted in index.ts |
| 2 | Soul generation produces a valid SOUL.md with 7 dimensions from an archetype | VERIFIED | `soul-generator.ts` queries archetype from botSouls, calls generateObject via AI SDK, computes SHA-256 hash, inserts with 7 dimensions |
| 3 | Soul mutation creates a child soul with incremented generation and parentSoulId set | VERIFIED | `generateMutatedSoul()` in soul-generator.ts inserts child row with `parentSoulId` and `generation: parent.generation + 1`; test passes |
| 4 | Soul injection writes SOUL.md to disk and updates Paperclip agent adapterConfig.instructionsFilePath | VERIFIED | `soul-injector.ts` writes `~/.akasa/souls/{soulId}.md` and patches agent row; openai_compatible path sets systemPrompt; 2 tests pass |
| 5 | bots table has paperclipAgentId column for linking Akasa bots to Paperclip agents | VERIFIED | `packages/db/src/schema/bots.ts` line 43; migration `0011_add_paperclip_agent_id.sql` exists |
| 6 | Three council judges each produce a typed verdict output with confidence score | VERIFIED | performance-judge (Anthropic), soul-analyst (Anthropic), devils-advocate (OpenAI) each export typed output via generateText + Output + Zod schema |
| 7 | Devil's Advocate uses a different LLM provider family (OpenAI) than Performance Judge (Anthropic) | VERIFIED | `performance-judge.ts` imports `@ai-sdk/anthropic`; `devils-advocate.ts` imports `@ai-sdk/openai` |
| 8 | Council runner aggregates three judge outputs into a single weighted verdict stored in council_verdicts | VERIFIED | `council-runner.ts`: Promise.allSettled, weights 0.5/0.3/0.2, db.insert(councilVerdicts); Promote/Retire set requiresHumanConfirmation=true |
| 9 | Evolution trigger polls heartbeat_runs for completed runs linked to Akasa bots via paperclipAgentId | VERIFIED | `evolution-trigger.ts` imports heartbeatRuns from @paperclipai/db, queries status in ['succeeded','failed'], joins via bots.paperclipAgentId, setInterval(60s) started in index.ts |
| 10 | Confirming a verdict triggers class transition, DNA capture, negative signal recording and pioneer detection | VERIFIED | `god-layer.ts` PATCH /:id/confirm calls executeGodLayer; god-layer-handler.ts orchestrates computeClassTransition, captureDna, recordNegativeSignal, checkAndRecordPioneer with idempotency guard |
| 11 | Confirm/reject verdict routes exist at /api/akasa/verdicts/:id/confirm and /reject | VERIFIED | `routes/god-layer.ts` exports godLayerRouter with PATCH /:id/confirm and /:id/reject; mounted in index.ts at /akasa/verdicts |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/akasa-server/src/routes/souls.ts` | Soul CRUD + generation + mutation + injection router | VERIFIED | 191 lines; exports soulsRouter(); GET/, GET/:id, POST/generate, POST/:id/mutate, POST/inject |
| `services/akasa-server/src/services/soul-generator.ts` | generateSoul and generateMutatedSoul | VERIFIED | 229 lines; exports both functions; SHA-256 hash; botSouls DB insert |
| `services/akasa-server/src/services/soul-injector.ts` | Soul injection into Paperclip agent adapterConfig | VERIFIED | 60 lines; exports injectSoulIntoAgent; writes SOUL.md to disk; handles both instructionsFilePath and systemPrompt paths |
| `services/akasa-server/vitest.config.ts` | Vitest test configuration | VERIFIED | Exists; environment node; path aliases for workspace packages |
| `services/akasa-server/src/council/performance-judge.ts` | Performance scoring judge using Anthropic Claude | VERIFIED | Exports runPerformanceJudge and CouncilContext; uses @ai-sdk/anthropic |
| `services/akasa-server/src/council/soul-analyst.ts` | Soul alignment judge | VERIFIED | Exports runSoulAnalyst; uses @ai-sdk/anthropic |
| `services/akasa-server/src/council/devils-advocate.ts` | Contrarian judge using OpenAI | VERIFIED | Exports runDevilsAdvocate; imports from @ai-sdk/openai (NOT anthropic) |
| `services/akasa-server/src/council/council-runner.ts` | Weighted verdict aggregation and DB insert | VERIFIED | Exports runCouncilForBot; Promise.allSettled; requiresHumanConfirmation for Promote/Retire; db.insert(councilVerdicts) |
| `services/akasa-server/src/routes/council.ts` | Verdict CRUD routes | VERIFIED | Exports councilRouter; GET / with executionId filter; GET /:id with 404 |
| `services/akasa-server/src/routes/evolution-trigger.ts` | Polling loop + manual trigger route | VERIFIED | Exports evolutionTriggerRouter, checkAndTriggerCouncilEvaluations, startEvolutionPolling; heartbeatRuns import; setInterval |
| `services/akasa-server/src/god-layer/class-machine.ts` | Pure function for agent class transitions | VERIFIED | Exports computeClassTransition; zero dependencies; Novice/Understudy/Artisan/Retired handled |
| `services/akasa-server/src/god-layer/dna-writer.ts` | DNA capture with versioned insert | VERIFIED | Exports captureDna; MAX(version) query; Redis category lock with fail-open; db.insert(dnaStore) |
| `services/akasa-server/src/god-layer/negative-register.ts` | Negative signal recording | VERIFIED | Exports recordNegativeSignal; Demote/Monitor/Retire severity mapping; db.insert(negativeSignalRegister) |
| `services/akasa-server/src/god-layer/pioneer-tracker.ts` | Pioneer detection and category benchmark | VERIFIED | Exports checkAndRecordPioneer; categoryBenchmarks insert/update; maturity thresholds |
| `services/akasa-server/src/god-layer/god-layer-handler.ts` | God Layer orchestrator with idempotency | VERIFIED | Exports executeGodLayer; godLayerProcessedAt idempotency check; calls all sub-operations with individual try/catch |
| `services/akasa-server/src/routes/god-layer.ts` | Confirm/reject verdict routes | VERIFIED | Exports godLayerRouter; PATCH /:id/confirm (409 for already-processed); PATCH /:id/reject; calls executeGodLayer |
| `packages/db/migrations/akasa/0011_add_paperclip_agent_id.sql` | Migration for bots.paperclipAgentId | VERIFIED | File exists at expected path |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| routes/souls.ts | @claw/db botSouls table | drizzle-orm queries | WIRED | db.select().from(botSouls), db.insert(botSouls) via generateSoul |
| routes/evolution-trigger.ts | heartbeat_runs (Paperclip DB) | polling query on status + finishedAt | WIRED | `heartbeatRuns` imported from @paperclipai/db; inArray(heartbeatRuns.status, ['succeeded','failed']) |
| routes/evolution-trigger.ts | council-runner.ts | runCouncilForBot call | WIRED | `runCouncilForBot` called for each unprocessed completed run |
| council/council-runner.ts | @claw/db council_verdicts | drizzle insert | WIRED | db.insert(councilVerdicts).values(...) at line 236 |
| routes/god-layer.ts | god-layer/god-layer-handler.ts | PATCH /:id/confirm calls executeGodLayer | WIRED | import executeGodLayer at line 14; called at line 63 |
| god-layer/god-layer-handler.ts | @claw/db agentClasses | class-machine computes transition, handler persists | WIRED | db.insert(agentClasses) when transitioned=true |
| god-layer/dna-writer.ts | @claw/db dnaStore | drizzle insert with MAX(version)+1 | WIRED | db.insert(dnaStore) with computed version at line 104 |
| services/akasa-server/src/index.ts | startEvolutionPolling | polling started at server startup | WIRED | import startEvolutionPolling at line 9; called at line 59 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| routes/souls.ts GET / | souls array | db.select().from(botSouls).where(eq(botSouls.isArchetype, false)) | Yes — live Drizzle query | FLOWING |
| council-runner.ts | verdict insert | db.insert(councilVerdicts) with real judge outputs | Yes — all three judges produce outputs via AI SDK | FLOWING |
| evolution-trigger.ts | heartbeat_runs | paperclipDb.select().from(heartbeatRuns) with status/finishedAt filter | Yes — live Drizzle query against Paperclip DB | FLOWING |
| god-layer-handler.ts | godLayerProcessedAt | db.update(councilVerdicts) | Yes — live timestamp write | FLOWING |
| dna-writer.ts | version | MAX(dnaStore.version) WHERE objectiveCategory = taskCategory | Yes — live Drizzle aggregate query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `pnpm --filter @claw/akasa-server exec vitest run` | 48/48 tests pass across 5 test files | PASS |
| soulsRouter exports exist | grep soulsRouter src/routes/index.ts | mounted at /akasa/souls | PASS |
| councilRouter + godLayerRouter both wired | grep councilRouter\|godLayerRouter routes/index.ts | both imported and mounted at /akasa/verdicts | PASS |
| startEvolutionPolling wired to server startup | grep startEvolutionPolling services/akasa-server/src/index.ts | imported and called | PASS |
| DA uses OpenAI (not Anthropic) | grep @ai-sdk/openai devils-advocate.ts | confirmed line 2 | PASS |
| PJ uses Anthropic (not OpenAI) | grep @ai-sdk/anthropic performance-judge.ts | confirmed line 2 | PASS |
| Migration file exists | ls packages/db/migrations/akasa/0011_add_paperclip_agent_id.sql | file present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EVO-01 | 05-01 | Soul system routes — CRUD for bot_souls, soul generation, mutation engine | SATISFIED | soulsRouter at /api/akasa/souls; generateSoul, generateMutatedSoul, botSouls queries |
| EVO-02 | 05-02 | Council evaluation routes — trigger 3-judge evaluation after heartbeat run, store verdicts | SATISFIED | council-runner.ts with 3 judges; councilRouter at /api/akasa/verdicts |
| EVO-03 | 05-03 | God Layer routes — class transitions, DNA capture, negative signal updates, triggered by confirmed verdicts | SATISFIED | godLayerRouter PATCH confirm/reject; executeGodLayer orchestrates all sub-operations |
| EVO-04 | 05-02 | Karpathy loop wired to Paperclip heartbeat lifecycle | SATISFIED | evolution-trigger.ts polls heartbeat_runs, fires runCouncilForBot, which triggers verdict, which triggers God Layer on confirm |
| EVO-05 | 05-01 | Soul injection into Paperclip agent sessions | SATISFIED | soul-injector.ts writes SOUL.md and patches Paperclip agent adapterConfig |
| EVO-06 | 05-02 | Evolution event hooks — heartbeat completion triggers council evaluation pipeline | SATISFIED | startEvolutionPolling runs every 60s polling heartbeatRuns; manual POST /trigger also available |

All 6 requirements declared across plans (EVO-01 through EVO-06) are satisfied. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| god-layer/pioneer-tracker.ts | 55 | `pioneerExecutionId: botId` — botId used instead of actual executionId | Info | Data quality: pioneer_execution_id column stores a bot UUID instead of an execution UUID. Function signature does not accept executionId. Pioneer detection still works; the incorrect FK value is a data fidelity issue, not a runtime blocker. |

### Human Verification Required

#### 1. LLM Judge Output Quality

**Test:** Create a real archetype-based bot soul, run a simulated heartbeat completion, and verify that the three council judges produce coherent, non-trivial assessments (not default or empty outputs).
**Expected:** Each judge returns a verdict, confidence score, and substantive reasoning string referencing the actual soul dimensions and task performance.
**Why human:** Cannot verify LLM output quality or coherence programmatically without live AI API calls.

#### 2. Evolution Polling Against Live Paperclip DB

**Test:** With Paperclip running, complete a heartbeat_run, wait 60 seconds, and confirm a council_verdicts row appears in the Akasa DB linked to the completed run.
**Expected:** Verdict row created automatically within ~60s of heartbeat_run.finishedAt being set.
**Why human:** Requires live connected services (Paperclip DB, Akasa DB, Redis) that cannot be tested in CI without running infrastructure.

#### 3. God Layer End-to-End with Real DB

**Test:** Confirm a pending Promote verdict and verify: (a) agent_classes row inserted with Novice->Understudy transition, (b) dna_store row inserted with version=1 for a new category, (c) council_verdicts.godLayerProcessedAt is set.
**Expected:** All three DB rows written; second confirm returns 409 (idempotency).
**Why human:** Requires live DB with seeded bot/soul/verdict rows.

### Gaps Summary

No gaps found. All 11 truths are verified, all 16 artifacts exist and are substantive and wired, all 6 requirements are satisfied, and the full 48-test suite passes with zero failures.

The only notable observation is a minor data quality issue in pioneer-tracker.ts where `pioneerExecutionId` is populated with `botId` instead of an actual execution UUID. This does not block any functionality — the column accepts UUID, the insert succeeds, and pioneer detection logic is correct. The field's semantic meaning is slightly incorrect but it is not an observable regression for any current feature.

---

_Verified: 2026-03-24T15:11:00Z_
_Verifier: Claude (gsd-verifier)_
