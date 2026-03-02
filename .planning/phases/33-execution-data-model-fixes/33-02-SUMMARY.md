---
phase: 33-execution-data-model-fixes
plan: "02"
subsystem: infra
tags: [proxy, domain-allowlist, tool-gateway, caching, security]

# Dependency graph
requires:
  - phase: 33-01
    provides: allowedDomains column on executions table (text[]) — queried by domain-allowlist service
provides:
  - Per-execution domain allowlist enforcement in HTTPS CONNECT and HTTP forward proxy paths
  - In-memory 60s TTL cache for execution domain lookups
  - Graceful fallback to global PROXY_DOMAIN_ALLOWLIST when X-Execution-Id header absent
affects:
  - phase-35 (bot launcher wiring — X-Execution-Id header injection into HTTP_PROXY)
  - tool-gateway proxy security posture

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-execution TTL cache pattern: Map<id, {value, expiresAt}> with Date.now() comparison"
    - "Async event handler safety: wrap with .catch() when registering with server.on() or setNotFoundHandler"
    - "Duplex vs net.Socket: server 'connect' event provides Duplex; use Duplex type in handler signature"

key-files:
  created:
    - services/tool-gateway/src/services/domain-allowlist.ts
  modified:
    - services/tool-gateway/src/routes/proxy.ts

key-decisions:
  - "Duplex type used for CONNECT socket parameter — Node.js server 'connect' event emits Duplex not net.Socket"
  - "handleConnect and handleHttpForwardProxy both made async with explicit .catch() wrappers at call sites"
  - "X-Execution-Id header injection deferred to Phase 35 — gateway ready but not yet activated"

patterns-established:
  - "Domain allowlist precedence: perExecutionDomains ?? PROXY_DOMAIN_ALLOWLIST (null signals 'use global')"
  - "Fail-open on cache miss or DB error — falls back to global allowlist rather than blocking all traffic"

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 33 Plan 02: Per-Execution Domain Filtering in Tool Gateway Proxy Summary

**Per-execution domain allowlist enforcement in both CONNECT (HTTPS) and HTTP forward proxy paths, with 60s TTL in-memory cache and graceful global-allowlist fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T18:09:06Z
- **Completed:** 2026-03-02T18:11:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `domain-allowlist.ts` service: queries `executions.allowedDomains` from DB with 60s TTL in-memory cache
- Updated `proxy.ts` CONNECT handler to be async, read `X-Execution-Id` header, and enforce per-execution domains
- Updated `proxy.ts` HTTP forward handler identically — both handlers log which allowlist source (per-execution vs global) was applied
- Wrapped both async handlers with `.catch()` at their call sites to prevent silent error swallowing in event-based registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create per-execution domain allowlist service with TTL cache** - `ed2475c` (feat)
2. **Task 2: Wire per-execution domain filtering into CONNECT and HTTP proxy handlers** - `1eb9904` (feat)

## Files Created/Modified

- `services/tool-gateway/src/services/domain-allowlist.ts` - New service: getExecutionAllowedDomains() with 60s TTL cache
- `services/tool-gateway/src/routes/proxy.ts` - Updated: async handlers, per-execution domain lookup, .catch() wrappers

## Decisions Made

- Used `Duplex` type for the CONNECT socket parameter — Node.js `server.on('connect')` emits `stream.Duplex`, not `net.Socket`. The original synchronous handler compiled successfully because type checking of the closure argument was deferred; making it async exposed the mismatch.
- Both async handlers wrapped with `.catch()` at call sites rather than inside the handlers — this ensures errors that escape the handler body (including promise rejections from `getExecutionAllowedDomains`) are caught and produce clean 502/socket.destroy() responses.
- X-Execution-Id header injection into bot VM HTTP_PROXY deferred to Phase 35+ as planned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Duplex vs net.Socket type mismatch in CONNECT handler**
- **Found during:** Task 2 (wiring per-execution domains into proxy handlers)
- **Issue:** Wrapping `handleConnect` in a closure to add `.catch()` exposed a TypeScript error: `server.on('connect')` passes `stream.Duplex` but the function signature declared `net.Socket`. The original non-async handler compiled because TS inferred void return and didn't surface the argument type mismatch via the `.on()` overload.
- **Fix:** Added `import type { Duplex } from 'node:stream'` and changed the socket parameter type in `handleConnect` to `Duplex`.
- **Files modified:** `services/tool-gateway/src/routes/proxy.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly after fix.
- **Committed in:** `1eb9904` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for correctness — the original type was technically wrong even in the synchronous version. No scope creep.

## Issues Encountered

None beyond the auto-fixed type error above.

## User Setup Required

None - no external service configuration required. The `X-Execution-Id` header injection that activates per-execution filtering is deferred to Phase 35.

## Next Phase Readiness

- Tool Gateway per-execution domain filtering is fully implemented and ready.
- Phase 35 (bot launcher) can inject `X-Execution-Id: <executionId>` into `HTTP_PROXY` to activate per-execution filtering for that bot's traffic.
- Until Phase 35, the gateway operates on the global `PROXY_DOMAIN_ALLOWLIST` for all requests — safe, correct fallback.

---
*Phase: 33-execution-data-model-fixes*
*Completed: 2026-03-02*
