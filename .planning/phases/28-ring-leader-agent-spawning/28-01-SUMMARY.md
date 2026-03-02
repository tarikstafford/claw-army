---
phase: 28-ring-leader-agent-spawning
plan: 01
subsystem: api
tags: [jwt, jose, ring-leader, session, constitution, soul, agent-spawning]

# Dependency graph
requires:
  - phase: 27-budget-validation-and-population-sizing
    provides: assembled population manifests with soul assignments per task
  - phase: 25-orchestrator-demotion-and-ring-leader-core
    provides: RingLeaderMissionBrief, TaskComplexity types from @claw/shared-types
  - phase: 24-ring-leader-schema-and-shared-types
    provides: bot_souls schema with constitutionDirectives column
provides:
  - session-jwt.ts: mints and verifies per-agent HS256 JWTs encoding all 7 SPAWN-01 fields
  - agent-session-builder.ts: assembles SOUL.md + task brief + upstream intelligence into full session prompt with INVIOLABLE constitution verification
affects:
  - 28-02 (DAG spawner will call mintSessionJwt and buildAgentSessionPrompt for each agent assignment)
  - 28-03 and beyond (any spawning or coordination phase consuming session JWTs or session prompts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session JWT module is independent from orchestrator/jwt.ts (different concern, separate evolution path)"
    - "Constitution verification uses exact verbatim string match — no regex, no normalization"
    - "Prompt assembly: SOUL.md first (unmodified), then task brief, then upstream intelligence, then footer"
    - "Non-fatal constitution failures: log WARN, return constitutionVerified=false, caller decides whether to abort"

key-files:
  created:
    - services/execution-service/src/services/session-jwt.ts
    - services/execution-service/src/services/agent-session-builder.ts
  modified: []

key-decisions:
  - "Session JWT module is intentionally independent from orchestrator/jwt.ts — different concern (agent grants vs bot identity), kept separate so either can evolve without coupling"
  - "Constitution verification non-fatal: log WARN but do not throw on missing INVIOLABLE directives — spawner has full context to decide abort vs proceed"
  - "Empty constitutionDirectives passes verification (pioneer souls may have no constitution yet — they are bound by footer reminder only)"
  - "JWT subject format: session:{soulId}:{taskId} — unique and traceable per agent assignment within a run"
  - "Expiration = runtimeLimitSeconds + 300s buffer — JWT stays valid for cleanup/callback operations after agent completes"

patterns-established:
  - "AgentSessionPrompt.constitutionVerified: boolean flag returned to caller rather than throwing — verification result is data, not control flow"
  - "Prompt section separator: bare '---' string between SOUL.md, task brief, upstream intelligence, footer"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 28 Plan 01: Session JWT and Agent Session Builder Summary

**HS256 session JWTs encoding 7 SPAWN-01 agent grants plus SOUL.md-first session prompt assembly with verbatim INVIOLABLE constitution verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T11:52:04Z
- **Completed:** 2026-03-02T11:53:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `session-jwt.ts`: `mintSessionJwt` encodes all 7 SPAWN-01 fields (soulId, taskId, toolAllowlist, thirdPartyGrants, budgetAllocationCents, runtimeLimitSeconds, ringLeaderRunId) in an HS256 JWT; `verifySessionJwt` round-trips with per-field presence checks
- `agent-session-builder.ts`: `verifyConstitution` checks all INVIOLABLE directives are present verbatim in SOUL.md (SPAWN-04); `buildAgentSessionPrompt` assembles SOUL.md (SPAWN-02) + task brief + upstream intelligence (SPAWN-03) + constitution footer into a single structured prompt
- Both modules compile without TypeScript errors; no changes to existing files

## Task Commits

Each task was committed atomically:

1. **Task 1: Session JWT generator for Ring Leader agents** - `10f7acc` (feat)
2. **Task 2: Agent session prompt builder with constitution verification** - `7745442` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `services/execution-service/src/services/session-jwt.ts` - HS256 JWT mint/verify for Ring Leader agent sessions encoding all 7 SPAWN-01 claims
- `services/execution-service/src/services/agent-session-builder.ts` - SOUL.md injection, constitution verification, task brief assembly, upstream intelligence integration

## Decisions Made
- Session JWT module intentionally independent from `orchestrator/jwt.ts` — different concern (per-agent grants vs bot identity); separate modules prevent coupling
- Constitution verification is non-fatal: missing INVIOLABLE directives log a WARN and set `constitutionVerified=false` but do not throw — the spawner in Plan 02 has full context to decide whether to abort
- Empty `constitutionDirectives` passes verification — pioneer souls may have no constitution yet and are bound only by the footer reminder
- JWT subject `session:{soulId}:{taskId}` is unique and traceable per agent assignment within a run
- Expiry = `runtimeLimitSeconds + 300s` so the JWT remains valid during cleanup/callback after agent completes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `mintSessionJwt` and `buildAgentSessionPrompt` are ready for Plan 02 (DAG spawner) to consume for each agent assignment
- `verifyConstitution` is independently callable for pre-spawn validation gates
- No blockers for Plan 02

---
*Phase: 28-ring-leader-agent-spawning*
*Completed: 2026-03-02*

## Self-Check: PASSED

- FOUND: services/execution-service/src/services/session-jwt.ts
- FOUND: services/execution-service/src/services/agent-session-builder.ts
- FOUND: .planning/phases/28-ring-leader-agent-spawning/28-01-SUMMARY.md
- FOUND commit 10f7acc (feat(28-01): session JWT generator)
- FOUND commit 7745442 (feat(28-01): agent session prompt builder)
