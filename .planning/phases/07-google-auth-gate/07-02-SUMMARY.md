---
phase: 07-google-auth-gate
plan: "02"
subsystem: auth
tags: [jose, jwe, hkdf, auth-js, fastify, typescript]

# Dependency graph
requires:
  - phase: 07-google-auth-gate/07-01
    provides: adapter-vercel migration enabling server-side execution of auth logic
provides:
  - Auth.js JWE token verification via HKDF+compactDecrypt (verifyAuthToken)
  - POST /executions protected with 401 preHandler auth guard
affects: [07-google-auth-gate/07-05, future plans forwarding Auth.js session tokens to execution-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "jose compactDecrypt for JWE decryption (not jwt.verify — Auth.js v5 uses JWE not plain JWT)"
    - "HKDF salt = cookie name string, info = 'Auth.js Generated Encryption Key ({salt})'"
    - "Try both cookie salts (dev: authjs.session-token, prod: __Secure-authjs.session-token)"
    - "Fastify preHandler array for auth gates before business logic"
    - "TypeBox 401 response schema required for strict type-provider compatibility"

key-files:
  created:
    - services/execution-service/src/lib/verify-auth-token.ts
  modified:
    - services/execution-service/src/routes/executions.ts

key-decisions:
  - "jose compactDecrypt (not jwt.verify) — Auth.js v5 sessions are JWE encrypted tokens, not signed JWTs"
  - "Try both HKDF salts — cookie name differs between HTTP dev (authjs.session-token) and HTTPS prod (__Secure-authjs.session-token); backend cannot know which env the UI runs in"
  - "64-byte HKDF key — A256CBC-HS512 requires 512-bit key"
  - "401 added to TypeBox response schema — @fastify/type-provider-typebox strict mode rejects reply.code(401) if 401 not declared in schema"

patterns-established:
  - "AUTH_SECRET: always read from process.env.AUTH_SECRET, throws Error if not configured (never hardcoded, never fallback)"
  - "preHandler array on protected routes: verifyAuthToken returns false → reply.code(401).send; no throw needed"
  - "GET routes remain unprotected — read-only execution status data"

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 07 Plan 02: Auth Token Verification for POST /executions Summary

**Auth.js JWE session token verification on POST /executions using jose compactDecrypt + crypto.hkdfSync, rejecting unauthenticated requests with 401**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T08:29:18Z
- **Completed:** 2026-02-19T08:31:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `verify-auth-token.ts` that decrypts Auth.js JWE tokens using HKDF key derivation and jose compactDecrypt
- Both dev (HTTP) and prod (HTTPS) cookie name salts tried for full environment compatibility
- POST /executions now rejects requests without a valid Auth.js session token with `401 { error: 'Unauthorized' }`
- GET routes remain unprotected — no breaking change to status/monitoring endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Create verify-auth-token.ts with HKDF + JWE decryption** - `5d8d752` (feat)
2. **Task 2: Add preHandler auth check to POST /executions** - `8697b62` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `services/execution-service/src/lib/verify-auth-token.ts` - Exports verifyAuthToken(); uses jose compactDecrypt + crypto.hkdfSync with both Auth.js cookie salts
- `services/execution-service/src/routes/executions.ts` - Added verifyAuthToken import, preHandler on POST /, 401 response schema

## Decisions Made
- **jose compactDecrypt not jwt.verify:** Auth.js v5 stores sessions as JWE (JSON Web Encryption) using A256CBC-HS512. jwt.verify only handles signed JWTs and would fail. compactDecrypt decrypts the encrypted payload.
- **Try both HKDF salts:** Auth.js uses different cookie names (and therefore different HKDF salts) for HTTP dev vs HTTPS prod. The backend cannot know which environment the UI is running in, so both are attempted sequentially.
- **64-byte key length:** A256CBC-HS512 requires a 512-bit (64-byte) symmetric key.
- **401 added to TypeBox schema:** @fastify/type-provider-typebox strict type checking requires all reply codes used in preHandlers to be declared in the route schema. Without the 401 entry, TypeScript fails with TS2345.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 401 response to TypeBox schema**
- **Found during:** Task 2 (Add preHandler auth check to POST /executions)
- **Issue:** TypeScript compilation failed with TS2345 — `reply.code(401).send({ error: 'Unauthorized' })` in the preHandler was not assignable because 401 was not declared in the route's TypeBox response schema. @fastify/type-provider-typebox enforces strict reply type matching.
- **Fix:** Added `401: Type.Object({ error: Type.String() })` to the POST / route's response schema.
- **Files modified:** services/execution-service/src/routes/executions.ts
- **Verification:** `npx tsc --noEmit` exits 0 after adding 401 schema.
- **Committed in:** `8697b62` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript compilation error)
**Impact on plan:** Required for correctness; the 401 schema entry is semantically correct (the route does return 401) and enables TypeScript to verify the response shape. No scope creep.

## Issues Encountered
None beyond the TypeBox strict typing deviation above.

## User Setup Required
None — no external service configuration required for this plan. AUTH_SECRET must be set in execution-service environment (pre-existing requirement from Phase 02).

## Next Phase Readiness
- POST /executions now rejects unauthenticated requests — backend auth gate is complete
- SvelteKit form action (Plan 05) can forward Auth.js session cookie as Bearer token to execution-service
- verifyAuthToken is importable from '../lib/verify-auth-token.js' in any execution-service route that needs auth

---
*Phase: 07-google-auth-gate*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: services/execution-service/src/lib/verify-auth-token.ts
- FOUND: services/execution-service/src/routes/executions.ts
- FOUND: .planning/phases/07-google-auth-gate/07-02-SUMMARY.md
- FOUND commit: 5d8d752 (Task 1)
- FOUND commit: 8697b62 (Task 2)
