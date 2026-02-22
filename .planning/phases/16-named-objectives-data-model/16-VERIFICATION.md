---
phase: 16-named-objectives-data-model
verified: 2026-02-22T08:28:46Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 16: Named Objectives Data Model — Verification Report

**Phase Goal:** Users can save, launch from, list, and archive named objectives — objectives persist across runs and accumulate history
**Verified:** 2026-02-22T08:28:46Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                   | Status     | Evidence                                                                                    |
|----|------------------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| 1  | objectives table exists in PostgreSQL with uuid PK, name, description, default settings columns, isArchived, timestamps | VERIFIED  | `packages/db/src/schema/objectives.ts`: 10 columns, 2 btree indexes, `packages/db/migrations/0009_objectives.sql` present |
| 2  | executions table has nullable objective_id UUID FK with ON DELETE SET NULL                                              | VERIFIED  | `packages/db/src/schema/executions.ts` line 22: `.references(() => objectives.id, { onDelete: 'set null' })`; `0010_executions_objective_id.sql` present |
| 3  | shared-types exports Objective interface and NewObjective type from @claw/shared-types                                  | VERIFIED  | `packages/shared-types/src/objective.ts`: full 10-field interface; `packages/shared-types/src/index.ts` line 7: `export * from './objective'` |
| 4  | POST /objectives creates a new objective and returns 201 with the created record                                        | VERIFIED  | `services/execution-service/src/routes/objectives.ts` lines 41–92: INSERT with .returning(), reply.code(201), verifyAuthToken guard |
| 5  | GET /objectives returns all non-archived objectives with lastRunStatus, runCount, totalSpendCents, bestBotClass         | VERIFIED  | `objectives.ts` lines 94–154: WHERE isArchived=false, 4 correlated sql<T> subqueries, ORDER BY createdAt DESC |
| 6  | GET /objectives/:id returns a single objective by ID or 404                                                             | VERIFIED  | `objectives.ts` lines 156–180: SELECT by PK, 404 if not found |
| 7  | DELETE /objectives/:id deletes the objective and returns 200, or 404 if not found                                       | VERIFIED  | `objectives.ts` lines 182–216: DELETE with .returning(), 404 on empty result, verifyAuthToken |
| 8  | PATCH /objectives/:id updates only provided fields (including isArchived for archive) and returns the updated record    | VERIFIED  | `objectives.ts` lines 218–285: selective updates object pattern, always sets updatedAt, verifyAuthToken |
| 9  | POST /executions accepts an optional objectiveId field                                                                  | VERIFIED  | `routes/executions.ts` line 37: `objectiveId: Type.Optional(Type.String({ format: 'uuid' }))` |
| 10 | When objectiveId is provided, execution row has objective_id set to that UUID; invalid/archived → 400                  | VERIFIED  | `execution.service.ts` lines 26–39: FK pre-validation query; routes/executions.ts lines 91–97: catch + 400 |
| 11 | Executions created without objectiveId continue to work with objective_id as NULL                                       | VERIFIED  | `execution.service.ts` line 49: `objectiveId: input.objectiveId ?? null` |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact                                                           | Expected                                              | Status     | Details                                                                             |
|--------------------------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------------------------------------|
| `packages/db/src/schema/objectives.ts`                            | Drizzle pgTable with 10 columns and 2 indexes         | VERIFIED   | All 10 columns present; btree indexes on isArchived + createdAt; exports Objective, NewObjective |
| `packages/db/src/schema/executions.ts`                            | Nullable objectiveId UUID FK referencing objectives.id | VERIFIED  | Line 2 imports objectives; line 22 adds FK column with onDelete: 'set null' |
| `packages/db/migrations/0009_objectives.sql`                      | CREATE TABLE IF NOT EXISTS objectives                  | VERIFIED   | Full idempotent DDL with 10 columns, 2 btree indexes                               |
| `packages/db/migrations/0010_executions_objective_id.sql`         | ALTER TABLE + idempotent FK constraint via DO $$ block | VERIFIED  | ADD COLUMN IF NOT EXISTS + DO $$ with information_schema check                     |
| `packages/shared-types/src/objective.ts`                          | Objective interface (10 fields), NewObjective type     | VERIFIED   | Full interface with branded types (UUID, Cents, ISOTimestamp); NewObjective omits 4 server-assigned fields |
| `services/execution-service/src/routes/objectives.ts`             | FastifyPluginAsyncTypebox with 5 route handlers        | VERIFIED   | objectivesRoutes exported; POST, GET /, GET /:id, DELETE /:id, PATCH /:id all present and fully typed |
| `services/execution-service/src/app.ts`                           | Registration of objectivesRoutes with /objectives prefix | VERIFIED | Line 13: import; line 51: register with prefix + comment; CORS includes PATCH, DELETE |
| `services/execution-service/src/routes/executions.ts`             | Optional objectiveId in POST body schema               | VERIFIED   | Line 37: Type.Optional(Type.String({ format: 'uuid' })); destructured and passed to createExecution |
| `services/execution-service/src/services/execution.service.ts`    | objectiveId in CreateExecutionInput + FK validation    | VERIFIED   | Interface line 20: objectiveId?: string; lines 26–39: validation query; line 49: ?? null in INSERT |

---

## Key Link Verification

| From                               | To                              | Via                                    | Status   | Details                                                                                        |
|------------------------------------|---------------------------------|----------------------------------------|----------|------------------------------------------------------------------------------------------------|
| `executions.ts` (schema)           | `objectives.ts` (schema)        | FK reference import                    | WIRED    | Line 2: `import { objectives } from './objectives'`; line 22: `.references(() => objectives.id, ...)` |
| `db/src/schema/index.ts`           | `objectives.ts`                 | barrel export                          | WIRED    | Line 14: `export * from './objectives'` |
| `shared-types/src/index.ts`        | `objective.ts`                  | barrel export                          | WIRED    | Line 7: `export * from './objective'` |
| `routes/objectives.ts`             | `@claw/db`                      | import objectives + executions tables  | WIRED    | Line 4: `import { db, objectives, executions } from '@claw/db'` |
| `app.ts`                           | `routes/objectives.ts`          | plugin registration                    | WIRED    | Line 13: import; line 51: `app.register(objectivesRoutes, { prefix: '/objectives' })` |
| `routes/executions.ts`             | `execution.service.ts`          | objectiveId passed through             | WIRED    | Line 89: `objectiveId` in createExecution call; lines 91–97: catch for 400 |
| `execution.service.ts`             | `@claw/db objectives table`     | FK validation query before insert      | WIRED    | Lines 26–39: `db.select().from(objectives).where(and(eq...isArchived, false))` |

---

## Requirements Coverage

| Requirement                                                   | Status    | Notes                                                                    |
|---------------------------------------------------------------|-----------|--------------------------------------------------------------------------|
| OBJ-01: Users can save named objectives                       | SATISFIED | POST /objectives creates and persists named objectives                    |
| OBJ-02: Users can launch executions from a saved objective    | SATISFIED | GET /objectives/:id pre-fills; POST /executions accepts objectiveId      |
| OBJ-03: Users can list objectives with run history/aggregation| SATISFIED | GET /objectives returns lastRunStatus, runCount, totalSpendCents, bestBotClass |
| OBJ-04: Users can archive and delete objectives               | SATISFIED | PATCH /:id sets isArchived=true; DELETE /:id removes with FK cascade     |
| Objectives persist across runs                                | SATISFIED | Drizzle schema + SQL migrations create durable PostgreSQL storage         |
| Execution history accumulates per objective                   | SATISFIED | executions.objective_id FK + correlated subqueries in GET /objectives     |

---

## Anti-Patterns Found

None detected. Files checked:
- No TODO/FIXME/placeholder comments in any artifact
- No `return null` / `return {}` stub implementations
- No console.log-only handlers
- No empty function bodies

---

## TypeScript Compilation

All three packages compile with zero errors:
- `packages/db`: `tsc --noEmit` — PASS
- `packages/shared-types`: `tsc --noEmit` — PASS
- `services/execution-service`: `tsc --noEmit` — PASS

---

## Human Verification Required

### 1. Database Migration Application

**Test:** Apply `0009_objectives.sql` then `0010_executions_objective_id.sql` to the PostgreSQL instance.
**Expected:** Tables created, indexes created, FK constraint added — no errors.
**Why human:** Requires a running PostgreSQL instance; cannot verify migration execution programmatically from the codebase alone.

### 2. API Integration: POST /objectives → GET /objectives round-trip

**Test:** POST to /objectives with valid body and auth token, then GET /objectives.
**Expected:** Created objective appears in GET list with runCount=0, totalSpendCents=0, lastRunStatus=null, bestBotClass=null.
**Why human:** Requires a running execution-service with DB connection; runtime behavior cannot be verified from static analysis.

### 3. Launch-from-objective flow with objectiveId

**Test:** Create an objective, then POST /executions with `objectiveId` set to its ID.
**Expected:** Execution created with 201, execution row in DB has objective_id set; re-running GET /objectives shows runCount=1.
**Why human:** End-to-end FK persistence requires a live DB + execution service to confirm.

### 4. Archive flow: PATCH isArchived → excluded from GET list

**Test:** Create objective, PATCH it with `{ "isArchived": true }`, then GET /objectives.
**Expected:** Archived objective does not appear in GET /objectives list.
**Why human:** Requires running service to confirm the WHERE isArchived=false filter works at runtime.

---

## Gaps Summary

No gaps. All 11 observable truths are verified. All artifacts exist with substantive implementations and correct wiring. Both data-layer packages and the execution service compile cleanly. Four items are flagged for human verification as they require a running database and server.

---

_Verified: 2026-02-22T08:28:46Z_
_Verifier: Claude (gsd-verifier)_
