---
phase: 03-bot-runtime-and-tool-gateway
plan: 03
subsystem: api
tags: [bullmq, ai-sdk, docker, jwt, bot-worker, reasoning-loop, llm, tool-gateway]

requires:
  - phase: 03-01
    provides: Tool Gateway with JWT auth, allowlist, rate limiting, and tool dispatch
  - phase: 03-02
    provides: Tool handler implementations (llm_call, fetch_url, write_file) wired to /tool.invoke

provides:
  - bot-worker service with BullMQ Worker, LLM reasoning loop, and Docker image
  - callGateway() HTTP proxy routing all bot tool calls through Tool Gateway security boundary
  - runReasoningLoop() using AI SDK 6 generateText with stopWhen: stepCountIs(20)
  - SIGTERM handler draining current job before exit
  - LLM-based planObjective() in execution-service with JSON fallback
  - 24-hour JWTs for bot container lifetime coverage
  - TOOL_GATEWAY_URL and LLM_MODEL injected into bot container environment

affects:
  - 04-realtime-and-observability
  - 05-scoring-and-analytics
  - 06-frontend

tech-stack:
  added:
    - ai (Vercel AI SDK 6) — added to @claw/bot-worker and @claw/execution-service
    - "@ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google" — multi-provider routing in both services
  patterns:
    - inputSchema API (not parameters) for AI SDK 6 tool() definitions
    - callGateway thin proxy — bot is untrusted; all enforcement in gateway
    - stopWhen: stepCountIs(20) for bounded reasoning loops
    - LLM decomposition with JSON fallback to prevent planner blocking execution pipeline
    - lockDuration 300s on BullMQ Worker for long-running LLM tasks

key-files:
  created:
    - services/bot-worker/src/main.ts
    - services/bot-worker/src/reasoning-loop.ts
    - services/bot-worker/src/tools/gateway-proxy.ts
    - services/bot-worker/package.json
    - services/bot-worker/tsconfig.json
    - services/bot-worker/Dockerfile
  modified:
    - services/execution-service/src/services/planner.service.ts
    - services/execution-service/src/orchestrator/bot-orchestrator.ts
    - services/execution-service/src/orchestrator/jwt.ts
    - services/execution-service/src/routes/executions.ts
    - services/execution-service/package.json
    - pnpm-lock.yaml

key-decisions:
  - "AI SDK 6 uses inputSchema (not parameters) for tool() definitions — FlexibleSchema accepts Zod v4"
  - "Local Zod schemas defined in reasoning-loop to avoid Zod v4 enum type mismatch with AI SDK internal types"
  - "StepResult.finishReason + toolCalls used in onStepFinish (stepType field does not exist in AI SDK 6)"
  - "planObjective() direct LLM call (not via Tool Gateway) per locked decision #3 — execution-service is trusted"
  - "JSON parse fallback in planObjective ensures execution pipeline never stalls due to LLM output format issues"
  - "lockDuration 300s on BullMQ Worker — real LLM reasoning loops can take minutes, prevents stalled-job false positives"

patterns-established:
  - "Bot worker is thin untrusted caller — all tool enforcement (auth, allowlist, rate limits) in Tool Gateway"
  - "callGateway() pattern: randomUUID invocationId + timestamp + JWT auth header on every tool call"
  - "Multi-provider resolveModel() duplicated in bot-worker and execution-service (no shared location yet)"

duration: 7min
completed: 2026-02-18
---

# Phase 3 Plan 3: Bot Worker and Planner LLM Upgrade Summary

**BullMQ bot-worker with AI SDK 6 reasoning loop and tool proxy, plus LLM-based task decomposition in execution-service replacing the numbered-subtask stub**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-18T12:09:28Z
- **Completed:** 2026-02-18T12:16:19Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- New `services/bot-worker` service: BullMQ Worker claiming tasks from `claw-tasks` queue, running `runReasoningLoop()` per job, SIGTERM graceful drain
- `runReasoningLoop()` uses AI SDK 6 `generateText` with `stopWhen: stepCountIs(20)` and three tool definitions (llm_call, fetch_url, write_file) that proxy through `callGateway()`
- `callGateway()` is an intentionally thin HTTP stub — posts to `TOOL_GATEWAY_URL/tool.invoke` with JWT auth header; all security enforcement happens in the gateway
- Docker image builds successfully using the stub-bot pattern with `NODE_OPTIONS --conditions @claw/source`
- `planObjective()` in execution-service upgraded from sync numbered-stub to async LLM call via `generateText`, with JSON parse and stub fallback
- JWT expiry changed from 15 minutes to 24 hours for bot container lifetime coverage
- `BOT_IMAGE` defaults to `claw-bot-worker:latest`, bot containers receive `TOOL_GATEWAY_URL` and `LLM_MODEL`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create bot-worker service with reasoning loop and Docker image** - `961e8bd` (feat)
2. **Task 2: Update execution-service planner to use LLM and mint 24h JWTs** - `50fef27` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/bot-worker/src/main.ts` - BullMQ Worker entry point with SIGTERM handler
- `services/bot-worker/src/reasoning-loop.ts` - generateText loop with inputSchema tool definitions
- `services/bot-worker/src/tools/gateway-proxy.ts` - HTTP proxy posting to Tool Gateway
- `services/bot-worker/package.json` - New service manifest with AI SDK, bullmq, jose deps
- `services/bot-worker/tsconfig.json` - Extends tsconfig.base.json with ESNext/Bundler
- `services/bot-worker/Dockerfile` - Node 20 Alpine with @claw/source conditions
- `services/execution-service/src/services/planner.service.ts` - async LLM decomposition replacing sync stub
- `services/execution-service/src/orchestrator/bot-orchestrator.ts` - BOT_IMAGE default + TOOL_GATEWAY_URL/LLM_MODEL env injection
- `services/execution-service/src/orchestrator/jwt.ts` - JWT expiry 15m -> 24h
- `services/execution-service/src/routes/executions.ts` - await planObjective() (sync -> async)
- `services/execution-service/package.json` - AI SDK dependencies added
- `pnpm-lock.yaml` - Updated with bot-worker deps

## Decisions Made

- **AI SDK 6 tool() API uses `inputSchema` not `parameters`**: The plan mentioned `parameters` (older API). AI SDK 6 uses `inputSchema: FlexibleSchema<INPUT>`. Fixed during implementation.
- **Local Zod schemas in reasoning-loop**: Tried to reuse `@claw/tool-contracts` arg schemas but Zod v4 enum type shape is incompatible with AI SDK's internal Zod types when cast. Defined local equivalent schemas to avoid type errors.
- **`StepResult` has no `stepType` field**: Plan mentioned logging `stepType` in `onStepFinish`. AI SDK 6's `StepResult` has `finishReason` and `toolCalls` instead. Used those fields.
- **planObjective fallback**: LLM output may not be valid JSON (markdown fences, prose). JSON.parse with catch + stub fallback prevents the execution pipeline from stalling.
- **lockDuration 300s**: Real LLM reasoning loops with multiple tool call iterations can take 2-5 minutes. 30s (stub-bot default) would cause BullMQ to mark jobs as stalled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK 6 uses `inputSchema` not `parameters` for tool() definitions**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan specified `parameters` field for `tool()` helper. AI SDK 6 renamed this to `inputSchema` in the `Tool<INPUT, OUTPUT>` type definition.
- **Fix:** Used `inputSchema` field directly with Zod schemas instead of `parameters`
- **Files modified:** `services/bot-worker/src/reasoning-loop.ts`
- **Verification:** TypeScript compiles clean with no errors
- **Committed in:** `961e8bd` (Task 1 commit)

**2. [Rule 1 - Bug] Zod v4 enum type incompatible with AI SDK tool() when cast from tool-contracts**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `llmCallRequestSchema.shape.args` cast to AI SDK's expected Zod types fails because Zod v4 `z.enum` uses object shape `{ system: "system" }` not tuple `["system", "user"]` internally, causing type mismatch errors.
- **Fix:** Defined equivalent Zod schemas locally in reasoning-loop.ts to avoid the cast
- **Files modified:** `services/bot-worker/src/reasoning-loop.ts`
- **Verification:** TypeScript compiles clean with no errors
- **Committed in:** `961e8bd` (Task 1 commit)

**3. [Rule 1 - Bug] `StepResult.stepType` does not exist in AI SDK 6**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan mentioned logging `step.stepType` in `onStepFinish`. AI SDK 6 `StepResult` type has `finishReason` and `toolCalls` but no `stepType`.
- **Fix:** Used `step.finishReason` and `step.toolCalls.length` for logging instead
- **Files modified:** `services/bot-worker/src/reasoning-loop.ts`
- **Verification:** TypeScript compiles clean
- **Committed in:** `961e8bd` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug: AI SDK 6 API discrepancies vs plan description)
**Impact on plan:** All fixes were necessary for correct AI SDK 6 usage. No scope creep. The semantic intent of the plan (AI SDK tool loop with proxy calls) is fully preserved.

## Issues Encountered

None beyond the AI SDK 6 API discrepancies documented above.

## User Setup Required

None — no external service configuration required for this plan. Bot containers need `OPENAI_API_KEY` (or equivalent) injected via environment to make real LLM calls, but this is part of operational deployment, not code configuration.

## Next Phase Readiness

- Full bot-runtime stack is now in place: execution-service spawns claw-bot-worker containers, bots claim tasks and run LLM reasoning loops, all tool calls route through the Tool Gateway security boundary
- Phase 3 is complete — all 3 plans executed
- Ready for Phase 4 (real-time and observability) — the event pipeline (Pub/Sub, QueueEvents) is already wired; Phase 4 will surface those events in the UI

---
*Phase: 03-bot-runtime-and-tool-gateway*
*Completed: 2026-02-18*

## Self-Check: PASSED

All files verified present. All task commits verified in git history.
