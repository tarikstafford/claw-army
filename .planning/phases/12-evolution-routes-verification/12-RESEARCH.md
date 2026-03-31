# Phase 12: Evolution Routes Verification - Research

**Researched:** 2026-03-31
**Domain:** Retroactive GSD verification artifact generation — code audit and requirements traceability
**Confidence:** HIGH

---

## Summary

Phase 12 is a verification-artifact-only phase. No code will be written. The goal is to produce a VERIFICATION.md that formally proves EVO-01 through EVO-06 are satisfied by code already shipped in Phase 5 (completed 2026-03-24).

Phase 5 created three plans (05-01, 05-02, 05-03) that together built the complete evolution pipeline: soul CRUD/generation/mutation (05-01), council judges + runner + verdict routes + evolution trigger polling (05-02), and God Layer modules + class transitions + DNA capture + confirm/reject verdict routes (05-03). All implementation files exist under `services/akasa-server/src/`. Vitest unit tests exist for all six EVO domains. The `akasaRouter` in `routes/index.ts` mounts all evolution routes on Paperclip's Express server at server startup (`index.ts`).

The research task here is an audit: map each EVO requirement to specific source files, route paths, and function names as evidence. One partial gap was identified: EVO-06 (evolution event hooks via Paperclip heartbeat events) is implemented as a polling loop rather than a push-event hook — this distinction must be noted clearly in the VERIFICATION.md with a confidence qualifier.

**Primary recommendation:** Write VERIFICATION.md with six evidence blocks, one per EVO requirement. Each block must cite specific file path, function/route, and line-of-truth. Note the polling-vs-event-hook distinction for EVO-06. No code changes are required.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVO-01 | Soul system routes mounted on Paperclip's Express server — CRUD for bot_souls, soul generation, mutation engine | `soulsRouter()` at `/api/akasa/souls` — 5 routes, `soul-generator.ts` provides generation + mutation |
| EVO-02 | Council evaluation routes — trigger 3-judge evaluation after heartbeat run completes, store verdicts | `councilRouter()` at `/api/akasa/verdicts` + `runCouncilForBot()` in `council-runner.ts` |
| EVO-03 | God Layer routes — class transitions, DNA capture, negative signal updates, triggered by confirmed verdicts | `godLayerRouter()` at `/api/akasa/verdicts` + `executeGodLayer()` in `god-layer-handler.ts` |
| EVO-04 | Karpathy loop wired to Paperclip's heartbeat lifecycle — after each agent run: score → council → verdict → mutate/keep/discard → DNA capture | `checkAndTriggerCouncilEvaluations()` + `startEvolutionPolling()` in `evolution-trigger.ts` + God Layer pipeline |
| EVO-05 | Soul injection into Paperclip agent sessions — SOUL.md content injected as system prompt when heartbeat dispatches an agent | `injectSoulIntoAgent()` in `soul-injector.ts`, exposed via `POST /api/akasa/souls/inject` |
| EVO-06 | Evolution event hooks — Paperclip emits events on heartbeat completion that trigger council evaluation pipeline | `startEvolutionPolling()` (60s polling of `heartbeat_runs` table) + `POST /api/akasa/evolution/trigger` (manual trigger) |
</phase_requirements>

---

## Evidence Map: EVO-01 through EVO-06

### EVO-01: Soul System Routes

**Requirement:** Soul system routes mounted on Paperclip's Express server — CRUD for bot_souls, soul generation, mutation engine

**Evidence (HIGH confidence):**

| Evidence Item | Location |
|---------------|----------|
| Router factory | `services/akasa-server/src/routes/souls.ts` — `soulsRouter()` |
| Mount point | `services/akasa-server/src/routes/index.ts` line 22: `akasaRouter.use('/akasa/souls', soulsRouter())` |
| Express server mount | `services/akasa-server/src/index.ts` line 142: `extraApiRouter: akasaRouter` passed to Paperclip's `createApp()` |
| CRUD: list souls | `GET /api/akasa/souls` — queries `botSouls` where `isArchetype = false`, ordered by `createdAt desc` |
| CRUD: get by ID | `GET /api/akasa/souls/:id` — 404 if not found |
| Generation | `POST /api/akasa/souls/generate` — calls `generateSoul()` from `soul-generator.ts` |
| Mutation engine | `POST /api/akasa/souls/:id/mutate` — calls `generateMutatedSoul()` from `soul-generator.ts` |
| Injection | `POST /api/akasa/souls/inject` — calls `injectSoulIntoAgent()` from `soul-injector.ts` |
| Soul generator | `services/akasa-server/src/services/soul-generator.ts` — `generateSoul()` and `generateMutatedSoul()` |
| Embedding support | `generateSoul()` and `generateMutatedSoul()` call `embedMany()` via `text-embedding-3-small` (non-blocking) |
| DB table | `bot_souls` via `@claw/db` `botSouls` Drizzle schema |
| Unit tests | `services/akasa-server/src/__tests__/souls.test.ts` — covers GET /, GET /:id, POST /generate, POST /:id/mutate |

**Route summary:**
```
GET  /api/akasa/souls               — list non-archetype souls
GET  /api/akasa/souls/:id           — get soul by UUID
POST /api/akasa/souls/generate      — generate from archetype
POST /api/akasa/souls/:id/mutate    — generate mutated child
POST /api/akasa/souls/inject        — inject into Paperclip agent
```

---

### EVO-02: Council Evaluation Routes

**Requirement:** Council evaluation routes — trigger 3-judge evaluation after heartbeat run completes, store verdicts

**Evidence (HIGH confidence):**

| Evidence Item | Location |
|---------------|----------|
| Router factory | `services/akasa-server/src/routes/council.ts` — `councilRouter()` |
| Mount point | `services/akasa-server/src/routes/index.ts` line 25: `akasaRouter.use('/akasa/verdicts', councilRouter())` |
| Council runner | `services/akasa-server/src/council/council-runner.ts` — `runCouncilForBot(executionId, botId, soulId)` |
| Performance Judge | `services/akasa-server/src/council/performance-judge.ts` — `runPerformanceJudge(ctx)` using `@ai-sdk/anthropic` (`claude-sonnet-4-6`) |
| Soul Analyst | `services/akasa-server/src/council/soul-analyst.ts` — `runSoulAnalyst(ctx)` using `@ai-sdk/anthropic` |
| Devil's Advocate | `services/akasa-server/src/council/devils-advocate.ts` — `runDevilsAdvocate(ctx)` using `@ai-sdk/openai` (`gpt-4o-mini`) — different LLM provider family per CLAUDE.md requirement |
| Weighted aggregation | `council-runner.ts` `computeWeightedVerdict()` — weights 0.5/0.3/0.2 (PJ/SA/DA), renormalizes on judge failure |
| Verdict storage | `runCouncilForBot()` inserts into `council_verdicts` via `@claw/db` |
| `requiresHumanConfirmation` | Set `true` for Promote and Retire verdicts |
| Partial failure handling | `Promise.allSettled` — one judge failure does not block the overall verdict |
| Verdict CRUD | `GET /api/akasa/verdicts?executionId=` and `GET /api/akasa/verdicts/:id` |
| Unit tests | `services/akasa-server/src/__tests__/council.test.ts` — covers all 3 judges + council runner (requiresHumanConfirmation, partial failures, weighted verdict) |
| Unit tests | `services/akasa-server/src/__tests__/evolution-trigger.test.ts` — covers `councilRouter` GET routes |

**Route summary:**
```
GET /api/akasa/verdicts?executionId=  — list verdicts for execution
GET /api/akasa/verdicts/:id           — get single verdict
```

---

### EVO-03: God Layer Routes

**Requirement:** God Layer routes — class transitions, DNA capture, negative signal updates, triggered by confirmed verdicts

**Evidence (HIGH confidence):**

| Evidence Item | Location |
|---------------|----------|
| Router factory | `services/akasa-server/src/routes/god-layer.ts` — `godLayerRouter()` |
| Mount point | `services/akasa-server/src/routes/index.ts` line 28: `akasaRouter.use('/akasa/verdicts', godLayerRouter())` |
| Main handler | `services/akasa-server/src/god-layer/god-layer-handler.ts` — `executeGodLayer(verdictId)` |
| Class machine | `services/akasa-server/src/god-layer/class-machine.ts` — `computeClassTransition(currentClass, verdictType)` — pure function |
| DNA capture | `services/akasa-server/src/god-layer/dna-writer.ts` — `captureDna()` — writes to `dna_store`, versioned with Redis lock |
| Negative signals | `services/akasa-server/src/god-layer/negative-register.ts` — `recordNegativeSignal()` — maps Demote→high/Monitor→medium/Retire→critical |
| Pioneer tracking | `services/akasa-server/src/god-layer/pioneer-tracker.ts` — `checkAndRecordPioneer()` — inserts `category_benchmarks` row on first promote in category |
| Confirm route | `PATCH /api/akasa/verdicts/:id/confirm` — updates status → `confirmed`, calls `executeGodLayer()` |
| Reject route | `PATCH /api/akasa/verdicts/:id/reject` — updates status → `rejected`, no God Layer triggered |
| Idempotency | `executeGodLayer()` checks `godLayerProcessedAt` — skips if already set |
| Class transitions | `agentClasses` insert on `transitioned=true` — includes `artisanGraduationAt` for Artisan promotions |
| DNA trigger | Fires for Promote verdicts AND Maintain verdicts with `compositeScore >= 0.7` |
| Unit tests | `services/akasa-server/src/__tests__/god-layer.test.ts` — covers class-machine transitions, captureDna versioning, recordNegativeSignal, pioneer tracking, executeGodLayer idempotency, godLayerRouter HTTP responses |

**Route summary:**
```
PATCH /api/akasa/verdicts/:id/confirm  — confirm verdict, trigger God Layer
PATCH /api/akasa/verdicts/:id/reject   — reject verdict, no God Layer
```

**Class transition rules (from `class-machine.ts`):**
- Promote: Novice→Understudy, Understudy→Artisan, Artisan stays Artisan
- Demote: Artisan→Understudy, Understudy→Novice, Novice stays Novice
- Retire: any class → Retired
- Maintain / Monitor: no class change

---

### EVO-04: Karpathy Loop

**Requirement:** Karpathy loop wired to Paperclip's heartbeat lifecycle — after each agent run: score → council → verdict → mutate/keep/discard → DNA capture

**Evidence (HIGH confidence):**

| Evidence Item | Location |
|---------------|----------|
| Polling function | `services/akasa-server/src/routes/evolution-trigger.ts` — `checkAndTriggerCouncilEvaluations(paperclipDb, akasaDb)` |
| Polling start | `services/akasa-server/src/index.ts` line 168: `startEvolutionPolling(db as never, akasaDb as never)` |
| Heartbeat query | Queries `heartbeat_runs` WHERE `status IN ('succeeded','failed')` AND `finishedAt > (now - 5 minutes)` |
| Agent lookup | Queries Akasa `bots` table by `paperclipAgentId = run.agentId` |
| Deduplication | Checks `council_verdicts` for existing verdict before triggering |
| Council trigger | Fire-and-forget `runCouncilForBot(executionId, botId, soulId)` — per coding conventions (`.catch()`) |
| Verdict → mutation | God Layer (`executeGodLayer`) executes on confirm: class transition + DNA capture (keep) or negative signal (discard) |
| DNA capture | `captureDna()` in `dna-writer.ts` — triggers on Promote and high-score Maintain (compositeScore >= 0.7) |
| Loop interval | 60 seconds (default in `startEvolutionPolling`) |
| Manual trigger | `POST /api/akasa/evolution/trigger` — same logic, on-demand |
| Unit tests | `services/akasa-server/src/__tests__/evolution-trigger.test.ts` — covers all polling scenarios: no runs, no matching bot, existing verdict, triggers council |

**Loop flow:**
```
heartbeat_runs (Paperclip) → checkAndTriggerCouncilEvaluations (60s poll)
  → bots.paperclipAgentId match
  → council_verdicts dedup check
  → runCouncilForBot() [fire-and-forget]
  → council_verdicts INSERT (status: pending)
  → PATCH /:id/confirm triggers executeGodLayer()
  → computeClassTransition() → agentClasses INSERT
  → captureDna() → dna_store INSERT
  OR recordNegativeSignal() → negative_signal_register INSERT
```

---

### EVO-05: Soul Injection

**Requirement:** Soul injection into Paperclip agent sessions — SOUL.md content injected as system prompt when heartbeat dispatches an agent

**Evidence (HIGH confidence):**

| Evidence Item | Location |
|---------------|----------|
| Injector function | `services/akasa-server/src/services/soul-injector.ts` — `injectSoulIntoAgent(paperclipDb, agentId, companyId, soulContent, soulId, adapterType?)` |
| Inject route | `POST /api/akasa/souls/inject` in `soulsRouter()` — looks up soul by ID, creates paperclipDb lazily, calls `injectSoulIntoAgent()` |
| File-based adapters | Writes SOUL.md to `~/.akasa/souls/{soulId}.md`, patches `agent.adapterConfig.instructionsFilePath` |
| OpenAI-compatible | When `adapterType === 'openai_compatible'`, patches `agent.adapterConfig.systemPrompt` with soul content directly |
| DB target | Updates `@paperclipai/db` `agents` table — scoped by `agentId` AND `companyId` |
| Audit trail | SOUL.md always written to disk regardless of adapter type |
| Unit tests | `services/akasa-server/src/__tests__/soul-injection.test.ts` — covers default adapter (instructionsFilePath) and openai_compatible adapter (systemPrompt) |

**Injection flow:**
```
POST /api/akasa/souls/inject { agentId, companyId, soulId, adapterType? }
  → lookup soul by soulId from bot_souls
  → createDb(DATABASE_URL) for Paperclip DB
  → injectSoulIntoAgent()
    → mkdir ~/.akasa/souls/
    → writeFile {soulId}.md
    → agents.update({ adapterConfig: { instructionsFilePath | systemPrompt } })
```

---

### EVO-06: Evolution Event Hooks

**Requirement:** Evolution event hooks — Paperclip emits events on heartbeat completion that trigger council evaluation pipeline

**Evidence (MEDIUM confidence — implementation uses polling, not push events):**

| Evidence Item | Location |
|---------------|----------|
| Trigger mechanism | `services/akasa-server/src/routes/evolution-trigger.ts` — `startEvolutionPolling()` + `checkAndTriggerCouncilEvaluations()` |
| Polling start | `services/akasa-server/src/index.ts` line 168: `startEvolutionPolling(db, akasaDb)` — runs every 60 seconds |
| Manual hook route | `POST /api/akasa/evolution/trigger` — manually invokes a single evaluation cycle |
| Trigger condition | Polls `heartbeat_runs WHERE status IN ('succeeded','failed') AND finishedAt > (now - 5 minutes)` |

**Important distinction:** EVO-06 states "Paperclip emits events... that trigger council evaluation pipeline." The actual implementation uses **polling** of the `heartbeat_runs` DB table rather than a Paperclip push event/webhook. This is the correct architectural approach given the v6.0 constraints (Paperclip does not expose a heartbeat completion webhook at this integration depth), and the requirement is functionally satisfied — every heartbeat completion does trigger the council pipeline within 60 seconds. However, the VERIFICATION.md should note this implementation detail: the "event hook" is a DB poll with a 60s SLA, not an immediate push event.

**Functional test evidence:** `evolution-trigger.test.ts` tests the full polling cycle including:
- No completed runs → triggered: 0
- Completed run with no matching Akasa bot → triggered: 0
- Completed run with existing verdict → triggered: 0 (dedup)
- Completed run with matching bot and no verdict → triggered: 1 (council fires)

---

## Architecture Patterns

### How Evolution Routes Are Mounted

The `akasaRouter` is created as an Express `Router` in `routes/index.ts` and passed as `extraApiRouter` to Paperclip's `createApp()` in `index.ts`. This is the integration pattern from Phase 1 (Approach B) — Akasa routes coexist alongside Paperclip's Express routes under the same server process.

All Akasa routes are prefixed with `/akasa/` and are accessible at the same port as Paperclip's own routes (default: `3100`).

### Route Organization

```
services/akasa-server/src/
├── routes/
│   ├── index.ts              — akasaRouter: assembles all sub-routers
│   ├── souls.ts              — soulsRouter() → /akasa/souls
│   ├── council.ts            — councilRouter() → /akasa/verdicts (GET)
│   ├── god-layer.ts          — godLayerRouter() → /akasa/verdicts (PATCH confirm/reject)
│   └── evolution-trigger.ts  — evolutionTriggerRouter() → /akasa/evolution/trigger
├── council/
│   ├── council-runner.ts     — runCouncilForBot() orchestrator
│   ├── performance-judge.ts  — runPerformanceJudge() [Anthropic claude-sonnet-4-6]
│   ├── soul-analyst.ts       — runSoulAnalyst() [Anthropic claude-sonnet-4-6]
│   └── devils-advocate.ts    — runDevilsAdvocate() [OpenAI gpt-4o-mini]
├── god-layer/
│   ├── god-layer-handler.ts  — executeGodLayer() orchestrator
│   ├── class-machine.ts      — computeClassTransition() pure function
│   ├── dna-writer.ts         — captureDna() with Redis locking
│   ├── negative-register.ts  — recordNegativeSignal()
│   └── pioneer-tracker.ts    — checkAndRecordPioneer()
└── services/
    ├── soul-generator.ts     — generateSoul() + generateMutatedSoul()
    └── soul-injector.ts      — injectSoulIntoAgent()
```

---

## Don't Hand-Roll

| Problem | Implementation Approach |
|---------|------------------------|
| Council verdict aggregation | Weighted vote with renormalized weights on judge failure — all in `council-runner.ts` |
| Class transition state machine | Pure function `computeClassTransition()` — no DB in the function itself |
| DNA versioning | Redis category lock + MAX(version)+1 DB query — `dna-writer.ts` |
| Soul content hashing | `node:crypto` SHA-256 in `soul-generator.ts` |
| Soul embedding | `text-embedding-3-small` via `@ai-sdk/openai`, non-blocking |

---

## Common Pitfalls for Verification

### Pitfall 1: EVO-06 Polling vs Push Event Distinction
**What:** EVO-06 says "Paperclip emits events" but the implementation polls `heartbeat_runs` every 60 seconds.
**Impact on verification:** Must be documented honestly in VERIFICATION.md — functionally satisfied but implementation uses polling, not Paperclip events. Mark as SATISFIED with note.

### Pitfall 2: Soul Injection Is Not Automatic on Heartbeat
**What:** `POST /api/akasa/souls/inject` is a manually-called endpoint, not auto-wired to every heartbeat dispatch.
**Impact on verification:** EVO-05 says "injected as system prompt when heartbeat dispatches an agent" — the route exists and works, but the connection between heartbeat dispatch and soul injection depends on the caller invoking the inject endpoint before/during dispatch. Document the mechanism clearly.

### Pitfall 3: Karpathy Loop Mutation Step
**What:** EVO-04 mentions "mutate/keep/discard" as part of the loop. The "mutate" step is triggered separately via `POST /api/akasa/souls/:id/mutate`, not automatically during the God Layer.
**Impact on verification:** The loop covers score → council → verdict → keep (DNA capture) or discard (negative signal). Mutation is available as a capability but is not auto-triggered post-verdict. VERIFICATION.md should note this accurately.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.0 |
| Config file | `services/akasa-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @claw/akasa-server exec vitest run --reporter=verbose` |
| Full suite command | `pnpm --filter @claw/akasa-server exec vitest run` |

### EVO Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVO-01 | Soul CRUD routes (GET list, GET /:id, POST /generate, POST /:id/mutate) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/souls.test.ts` | ✅ |
| EVO-01 | Soul injection route (POST /inject) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/soul-injection.test.ts` | ✅ |
| EVO-02 | Council routes GET / and GET /:id | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-trigger.test.ts` | ✅ |
| EVO-02 | Council runner: 3 judges, weighted verdict, partial failures | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/council.test.ts` | ✅ |
| EVO-02 | requiresHumanConfirmation true for Promote and Retire | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/council.test.ts` | ✅ |
| EVO-03 | God Layer confirm/reject routes (PATCH /:id/confirm, PATCH /:id/reject) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-03 | Class machine transitions (Promote, Demote, Retire, Maintain) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-03 | DNA capture with version MAX+1 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-03 | Negative signal for Demote/Monitor/Retire | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-03 | Pioneer detection on first category promote | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-03 | executeGodLayer idempotency | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | ✅ |
| EVO-04 | Evolution trigger: no runs → triggered:0 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-trigger.test.ts` | ✅ |
| EVO-04 | Evolution trigger: run with matching bot, no verdict → triggered:1 | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-trigger.test.ts` | ✅ |
| EVO-04 | Evolution trigger: dedup on existing verdict | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-trigger.test.ts` | ✅ |
| EVO-04 | POST /api/akasa/evolution/trigger manual endpoint | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/evolution-trigger.test.ts` | ✅ |
| EVO-05 | injectSoulIntoAgent: default adapter (instructionsFilePath) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/soul-injection.test.ts` | ✅ |
| EVO-05 | injectSoulIntoAgent: openai_compatible adapter (systemPrompt) | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/soul-injection.test.ts` | ✅ |
| EVO-06 | Evolution polling started at server startup | manual | Visual log inspection: `[akasa-server] Evolution polling started (60s interval)` | N/A |

### Sampling Rate
- **Verification gate:** `pnpm --filter @claw/akasa-server exec vitest run` — all tests green before writing VERIFICATION.md

### Wave 0 Gaps
None — all test files already exist and cover all EVO requirements.

---

## Environment Availability

Phase 12 creates only documentation files (VERIFICATION.md). No new code execution, no external dependencies.

Step 2.6: SKIPPED (no external dependencies for a documentation-only phase)

---

## Sources

### Primary (HIGH confidence)
- Direct code audit of `services/akasa-server/src/routes/` — all 4 evolution route files read
- Direct code audit of `services/akasa-server/src/council/` — all 4 council files read
- Direct code audit of `services/akasa-server/src/god-layer/` — all 5 god-layer files read
- Direct code audit of `services/akasa-server/src/services/` — soul-generator.ts and soul-injector.ts read
- Direct code audit of `services/akasa-server/src/__tests__/` — all 5 evolution test files read
- `services/akasa-server/src/index.ts` — server entry point confirming route mount and polling start
- `.planning/REQUIREMENTS.md` — EVO-01 through EVO-06 definitions
- `.planning/ROADMAP.md` — Phase 5 and Phase 12 descriptions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` decisions log — Phase 05 decisions (council weights, class machine simplification, Devil's Advocate OpenAI family)

---

## Metadata

**Confidence breakdown:**
- Evidence map (EVO-01 to EVO-05): HIGH — direct source code read, routes and functions confirmed
- Evidence map (EVO-06): MEDIUM — polling satisfies the requirement but does not match the push-event language in the requirement text
- Test coverage: HIGH — test files for all 6 EVO domains verified to exist and cover the required behaviors

**Research date:** 2026-03-31
**Valid until:** Indefinite — this phase is verification of existing code, no external dependencies
