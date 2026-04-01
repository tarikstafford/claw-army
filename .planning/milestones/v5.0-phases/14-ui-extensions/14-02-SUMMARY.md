---
phase: 14-ui-extensions
plan: 02
subsystem: api
tags: [pubsub, sse, zod, soul-lifecycle, god-layer, events]

requires:
  - phase: 13-god-layer-and-agent-class-system
    provides: God Layer worker with class transition logic, ClassTransition type, computeClassTransition function
  - phase: 14-ui-extensions-01
    provides: Leaderboard SOUL data endpoint (context for UIEX-03 backend continuation)

provides:
  - Zod v4 schemas for soul_promoted, soul_demoted, soul_retired, pioneer_detected events in @claw/event-schemas
  - publishSoulLifecycleEvent() function in execution-service publisher.ts
  - God Layer worker hooks publishing lifecycle events post-transaction for promote/demote/retire/pioneer
  - GET /events/lifecycle SSE endpoint streaming soul lifecycle events globally (not execution-scoped)

affects:
  - 14-ui-extensions-03
  - Any future phase consuming soul lifecycle Pub/Sub topic
  - Frontend SSE client connecting to /events/lifecycle

tech-stack:
  added: []
  patterns:
    - Discriminated union Zod schemas (z.discriminatedUnion) for event routing
    - Fire-and-forget publish calls via .catch() — event emission never crashes the worker
    - Per-connection ephemeral Pub/Sub subscriptions with cleanup guards for SSE endpoints
    - Outer-scope variable hoisting (transition, previousClass) to bridge async closure mutation across DB transaction boundary
    - ClassTransition re-cast after async closure to restore TypeScript discriminated union narrowing

key-files:
  created:
    - packages/event-schemas/src/soul-lifecycle-events.ts
  modified:
    - packages/event-schemas/src/index.ts
    - services/execution-service/src/events/publisher.ts
    - services/execution-service/src/queue/god-layer-worker.ts
    - services/execution-service/src/routes/sse.ts
    - services/execution-service/src/app.ts

key-decisions:
  - "transition variable hoisted to outer scope and re-cast as ClassTransition after db.transaction() async closure — TypeScript loses discriminated union narrowing when a variable is mutated inside an async closure (closure mutation issue), so re-casting via 'const resolvedTransition = transition as ClassTransition' restores type narrowing for the if-else publish chain"
  - "lifecycleSseRoutes registered at /events prefix (not /executions) to avoid /:id=events routing ambiguity with the existing /:id/events pattern"
  - "Artisan graduation publish uses artisanGraduated flag (set before general transition publish block) rather than checking transition.type === promote + from === Understudy, avoiding duplicate events for Understudy->Artisan promotions"
  - "previousClass hoisted before transaction to capture currentClass before mutation for use in soul_retired event (ClassTransition.retire has no from/to fields)"

patterns-established:
  - "Global SSE endpoints (not execution-scoped) registered at /events prefix, not /executions"
  - "Post-transaction lifecycle event publishing uses fire-and-forget .catch() — matches existing orchestrator event emission style"

duration: 8min
completed: 2026-02-22
---

# Phase 14 Plan 02: Soul Lifecycle Event Infrastructure Summary

**Zod v4 schemas, Pub/Sub publisher, and God Layer hooks for soul promotion/demotion/retirement/pioneer events streamed via SSE at /events/lifecycle**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T04:40:06Z
- **Completed:** 2026-02-22T04:48:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created soul-lifecycle-events.ts with 4 Zod v4 event schemas (soul_promoted, soul_demoted, soul_retired, pioneer_detected) and a discriminated union for SSE type routing
- Added publishSoulLifecycleEvent() to the execution-service publisher following the existing fire-and-forget pattern
- Hooked God Layer worker post-transaction block to publish lifecycle events for all 4 transition types (Novice→Understudy promotion, Understudy→Artisan graduation, demotion, retirement, pioneer detection)
- Added global SSE endpoint GET /events/lifecycle subscribed to the soul-lifecycle Pub/Sub topic with per-connection ephemeral subscriptions and cleanup guards

## Task Commits

Each task was committed atomically:

1. **Task 1: Create soul lifecycle event schemas, publisher function, and God Layer worker hooks** - `82c5cc2` (feat)
2. **Task 2: Add global lifecycle SSE endpoint and register at /events prefix** - `05b28e9` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `packages/event-schemas/src/soul-lifecycle-events.ts` - 4 Zod v4 schemas (soul_promoted, soul_demoted, soul_retired, pioneer_detected) and discriminated union SoulLifecycleEvent
- `packages/event-schemas/src/index.ts` - Added export for soul-lifecycle-events
- `services/execution-service/src/events/publisher.ts` - Added SOUL_LIFECYCLE_TOPIC constant and publishSoulLifecycleEvent() function
- `services/execution-service/src/queue/god-layer-worker.ts` - Added import for ClassTransition type and publishSoulLifecycleEvent; hoisted transition/previousClass variables; renamed inner-transaction transition to transitionResult; added post-transaction publish calls for all lifecycle events
- `services/execution-service/src/routes/sse.ts` - Added SOUL_LIFECYCLE_TOPIC constant and lifecycleSseRoutes plugin with GET /lifecycle handler
- `services/execution-service/src/app.ts` - Imported lifecycleSseRoutes and registered at /events prefix

## Decisions Made
- TypeScript loses discriminated union narrowing for `ClassTransition` when the variable is mutated inside an `async` closure (the `db.transaction()` callback). Fixed by re-casting: `const resolvedTransition = transition as ClassTransition` to restore narrowing for the post-transaction if-else publish chain.
- `lifecycleSseRoutes` registered at `/events` prefix (not `/executions`) to avoid the `/:id=events` routing ambiguity with the existing execution-scoped SSE route `/:id/events`.
- Artisan graduation is handled in its own `if (artisanGraduated)` block first (before the general `resolvedTransition.type === 'promote'` check), so the general promote block only fires for Novice→Understudy — preventing duplicate soul_promoted events for Artisan graduations.
- `previousClass` hoisted before the transaction to capture the bot's class before any mutation, required for the `soul_retired` event payload since `ClassTransition.retire` has no `from`/`to` fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript discriminated union narrowing lost through async closure**
- **Found during:** Task 1 verification (TypeScript check)
- **Issue:** `let transition: ClassTransition = { type: 'none' }` initialized with literal type `{ type: 'none' }`. TypeScript's control-flow narrowing doesn't track mutations through async closures, so the post-transaction `if (transition.type === 'promote')` checks produced TS2367 errors ("comparison appears unintentional, types have no overlap").
- **Fix:** Added `const resolvedTransition = transition as ClassTransition` immediately before the publish if-else chain to restore the union type for narrowing
- **Files modified:** services/execution-service/src/queue/god-layer-worker.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** `82c5cc2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type narrowing bug)
**Impact on plan:** Essential fix for TypeScript correctness. No scope creep.

## Issues Encountered
None beyond the TypeScript narrowing issue documented in deviations above.

## User Setup Required
None — no external service configuration required. The `soul-lifecycle` Pub/Sub topic is auto-created by the Pub/Sub emulator on first publish (local dev) and will need Terraform provisioning for production (consistent with existing topics).

## Next Phase Readiness
- UIEX-03 backend is complete: soul lifecycle events are published from God Layer and streamable via GET /events/lifecycle
- Plan 03 can now implement the frontend SSE client that connects to this endpoint and renders real-time soul lifecycle notifications in the UI

## Self-Check: PASSED

All created files found on disk. Both task commits (82c5cc2, 05b28e9) verified in git log.

---
*Phase: 14-ui-extensions*
*Completed: 2026-02-22*
