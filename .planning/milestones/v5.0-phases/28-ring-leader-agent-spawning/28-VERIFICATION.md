---
phase: 28-ring-leader-agent-spawning
verified: 2026-03-02T13:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Task brief and any available upstream intelligence signals are injected alongside SOUL.md in each session (SPAWN-03)"
  gaps_remaining: []
  regressions: []
---

# Phase 28: Ring Leader Agent Spawning Verification Report

**Phase Goal:** Ring Leader spawns agents using the validated population manifest — injecting session JWTs, full SOUL.md documents, task briefs, and upstream intelligence signals into each OpenClaw session, respecting DAG ordering, and registering every active session.

**Verified:** 2026-03-02T13:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 04 commits 3286a80 and e1ddda7)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each spawned agent receives a session JWT encoding soul_id, task_id, tool_allowlist, third_party_grants, budget_allocation, and runtime_limit | VERIFIED | `session-jwt.ts` exports `mintSessionJwt` using `jose.SignJWT` with all 7 SPAWN-01 fields. `agent-spawner.ts` line 295 calls `mintSessionJwt` per agent with all required fields including `ringLeaderRunId`. |
| 2 | Each agent's OpenClaw session starts with the full SOUL.md document injected, with inviolable constitution lines verified present and unmodified before execution begins | VERIFIED | `agent-session-builder.ts` exports `verifyConstitution` (verbatim exact-match) and `buildAgentSessionPrompt` (places raw `soulContent` as first section of `fullPrompt`). `agent-spawner.ts` lines 289-323 fetches soul content, calls both functions, and logs WARN on failed constitution check. |
| 3 | Task brief and any available upstream intelligence signals are injected alongside SOUL.md in each session | VERIFIED | Gap closed by Plan 04. `collectUpstreamOutputs()` now queries `tasks WHERE ring_leader_task_id IN (upstreamTaskIds) AND status='completed'` (lines 152-160). `db.insert(tasks)` creates task rows with `ringLeaderTaskId=taskId` after `spawnBot()` (lines 330-337). `buildAgentSessionPrompt` receives `upstreamOutputs` and renders the "## Upstream Intelligence" section when results are present. |
| 4 | Tasks with no DAG dependencies spawn immediately in parallel; tasks with upstream dependencies are held until upstream outputs are available | VERIFIED | `computeSpawnWaves()` builds reverse-dependency map, topologically sorts into waves. Wave 0 (no deps) spawns immediately via `Promise.allSettled`. Outer loop is sequential across waves. Cycle detection prevents infinite loops. |
| 5 | Every spawned agent's session ID is registered in the active session registry, and the pre-flight dashboard shows the full population manifest before the first agent begins executing | VERIFIED | `ActiveSessionRegistry` (module-level `registries` Map keyed by `ringLeaderRunId`) populated per-agent at spawn time (line 350). `GET /ring-leader/runs/:runId/manifest` and `GET /ring-leader/runs/by-execution/:executionId` registered in `app.ts` line 55 with `{ prefix: '/ring-leader' }`. Endpoints return `populationManifest` from `ring_leader_runs` before spawning begins. |

**Score:** 5/5 truths verified

### Re-verification: Gap Closure Evidence

**Gap (previously PARTIAL):** SPAWN-03 — upstream intelligence injection

**Root cause (from previous verification):** `collectUpstreamOutputs()` was a stub always returning `[]` because the `tasks` table lacked a `ring_leader_task_id` column.

**Fix verified:**

1. **Schema artifact** — `packages/db/src/schema/tasks.ts` line 31: `ringLeaderTaskId: varchar('ring_leader_task_id', { length: 255 })` — column present with correct type and nullable constraint.

2. **Index artifact** — `packages/db/src/schema/tasks.ts` line 41: `index('tasks_ring_leader_task_id_idx').on(t.ringLeaderTaskId)` — index present for efficient upstream output queries.

3. **SQL migration** — `packages/db/migrations/0012_add_ring_leader_task_id.sql`:
   ```sql
   ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "ring_leader_task_id" varchar(255);--> statement-breakpoint
   CREATE INDEX IF NOT EXISTS "tasks_ring_leader_task_id_idx" ON "tasks" USING btree ("ring_leader_task_id");
   ```
   Idempotent (`IF NOT EXISTS`). Registered in `_journal.json` at idx 12 with tag `0012_add_ring_leader_task_id`.

4. **`collectUpstreamOutputs` implementation** — `agent-spawner.ts` lines 144-179:
   - Short-circuits on empty `upstreamTaskIds` (line 147-149) to avoid invalid SQL
   - Drizzle query: `inArray(tasks.ringLeaderTaskId, upstreamTaskIds)` + `eq(tasks.status, 'completed')` (lines 152-160)
   - Filters null results (lines 163-167)
   - Maps to `{ taskId, summary }[]` (lines 168-171)
   - Wrapped in try/catch returning `[]` on failure (lines 172-178) — non-fatal

5. **Task row creation** — `agent-spawner.ts` lines 330-337: `db.insert(tasks).values({ executionId, description, status: 'claimed', claimedByBotId: botId, ringLeaderTaskId: taskId, attemptCount: 1 })` — called after `spawnBot()` succeeds, before registry registration.

6. **Stub gone** — The two `return []` instances at lines 148 and 177 are the correct early-return and catch fallback. The unconditional `return []` stub is eliminated.

7. **Commits verified** — `3286a80` (schema + migration) and `e1ddda7` (spawner implementation) exist in git history.

### Regression Check: Previously Passing Items

| Item | Regression Check | Status |
|------|-----------------|--------|
| `session-jwt.ts` exports `mintSessionJwt` with all 7 SPAWN-01 fields | File present, 146 lines, all 7 fields in `SignJWT` call | UNCHANGED |
| `agent-session-builder.ts` exports `buildAgentSessionPrompt` and `verifyConstitution` | Both functions present, `soulContent` placed first in prompt | UNCHANGED |
| `app.ts` registers `ringLeaderRoutes` with `{ prefix: '/ring-leader' }` | Lines 14 and 55 unchanged | UNCHANGED |
| `assemble-population.ts` calls `spawnAgentsForRun` fire-and-forget | Import on line 10, fire-and-forget call present | UNCHANGED |
| `computeSpawnWaves` provides topological wave ordering | Function present, reverse-dep map and wave algorithm intact | UNCHANGED |
| Active session registry populated per-agent | `registry.sessions.set(botId, activeSession)` at line 350 | UNCHANGED |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/execution-service/src/services/session-jwt.ts` | Session JWT minting and verification | VERIFIED | 146 lines. Exports `mintSessionJwt`, `verifySessionJwt`, `SessionJwtPayload`. HS256 via jose. All 7 SPAWN-01 fields. |
| `services/execution-service/src/services/agent-session-builder.ts` | SOUL.md injection, task brief assembly, constitution verification | VERIFIED | Exports `buildAgentSessionPrompt`, `verifyConstitution`. Prompt structure: SOUL.md first, task brief, upstream intelligence block, footer. |
| `services/execution-service/src/services/agent-spawner.ts` | DAG-respecting agent spawner with functional upstream intelligence | VERIFIED | 418 lines. `collectUpstreamOutputs` queries DB. `db.insert(tasks)` creates task rows. All 5 truths wired. |
| `packages/db/src/schema/tasks.ts` | ring_leader_task_id varchar(255) column | VERIFIED | Line 31: `ringLeaderTaskId: varchar('ring_leader_task_id', { length: 255 })`. Index at line 41. `varchar` imported on line 5. |
| `packages/db/migrations/0012_add_ring_leader_task_id.sql` | SQL migration adding ring_leader_task_id column and index | VERIFIED | 2-line idempotent SQL. Registered in `_journal.json` at idx 12. |
| `services/execution-service/src/services/assemble-population.ts` | Triggers spawnAgentsForRun after budget validation | VERIFIED | Import on line 10. Fire-and-forget call with all required params. |
| `services/execution-service/src/routes/ring-leader.ts` | Pre-flight manifest API routes | VERIFIED | Two endpoints. Drizzle query against `ringLeaderRuns`. Handles null `populationManifest`. |
| `services/execution-service/src/app.ts` | Route registration for ring-leader routes | VERIFIED | Line 55: `app.register(ringLeaderRoutes, { prefix: '/ring-leader' })`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agent-spawner.ts` | `session-jwt.ts` | `mintSessionJwt` called per agent | WIRED | Import line 3, call line 295 with all 7 payload fields |
| `agent-spawner.ts` | `agent-session-builder.ts` | `buildAgentSessionPrompt` + `verifyConstitution` | WIRED | Import line 4, calls at lines 306-314 with soulContent, constitutionDirectives, taskDescription, taskId, requiredTools, complexity, upstreamOutputs |
| `agent-spawner.ts` | `bot-orchestrator.ts` | `spawnBot` called per agent | WIRED | Import line 5, call line 327: `spawnBot(executionId, soulId, sessionPrompt.fullPrompt)` |
| `agent-spawner.ts` | `tasks table` | `db.insert(tasks)` with `ringLeaderTaskId` | WIRED | Lines 330-337: inserts task row with `ringLeaderTaskId: taskId` after spawnBot succeeds |
| `collectUpstreamOutputs` | `tasks table` | `db.select WHERE ring_leader_task_id IN (...) AND status=completed` | WIRED | Lines 152-160: `inArray(tasks.ringLeaderTaskId, upstreamTaskIds)` + `eq(tasks.status, 'completed')` |
| `assemble-population.ts` | `agent-spawner.ts` | `spawnAgentsForRun` fire-and-forget | WIRED | Import line 10, call line 319 |
| `ring-leader.ts` | `ring_leader_runs table` | Drizzle query for `populationManifest` | WIRED | `db.select().from(ringLeaderRuns).where(eq(ringLeaderRuns.id, runId))` |
| `app.ts` | `ring-leader.ts` | `fastify.register(ringLeaderRoutes)` | WIRED | Line 55: `{ prefix: '/ring-leader' }` |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| SPAWN-01: Session JWT with 7 agent grant fields | SATISFIED | All 7 fields minted and verified |
| SPAWN-02: SOUL.md injected first in session prompt | SATISFIED | `soulContent` is first section of `fullPrompt` |
| SPAWN-03: Upstream intelligence injected when available | SATISFIED | Gap closed — `collectUpstreamOutputs` queries DB; task rows created during spawning |
| SPAWN-04: INVIOLABLE constitution lines verified verbatim before execution | SATISFIED | `verifyConstitution` does exact-match check; WARN logged on failure |
| SPAWN-05: Active session registry tracks every spawned session | SATISFIED | `registry.sessions.set(botId, activeSession)` per agent |
| SPAWN-06: DAG ordering respected — no-dep tasks spawn immediately, dependent tasks held | SATISFIED | Wave-based topological sort; `Promise.allSettled` per wave |
| SPAWN-07: Pre-flight dashboard endpoint returns full population manifest | SATISFIED | Two endpoints registered under `/ring-leader` prefix |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Notes |
|------|------|---------|----------|-------|
| `services/execution-service/src/services/agent-spawner.ts` | 299 | `thirdPartyGrants: []` with comment "placeholder until external integrations are wired" | Warning (not blocker) | No third-party integrations exist in the system yet — empty array accurately reflects current state. Not a gap for this phase. |

No blocker anti-patterns remain. The previous STUB at `collectUpstreamOutputs` is fully replaced.

### Human Verification Required

None — all checks are verifiable programmatically for this phase.

### Gaps Summary

No gaps. All 5 observable truths are verified. The single gap from the initial verification (SPAWN-03 upstream intelligence stub) was closed by Plan 04 commits `3286a80` and `e1ddda7`.

---

_Verified: 2026-03-02T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
