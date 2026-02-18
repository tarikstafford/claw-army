---
phase: 01-data-foundation
plan: 02
subsystem: shared-types
tags: [zod, zod-v4, typescript, shared-types, event-schemas, tool-contracts, monorepo, internal-packages]

# Dependency graph
requires:
  - phase: 01-data-foundation/01-01
    provides: pnpm monorepo workspace, tsconfig.base.json, internal packages strategy pattern
provides:
  - "@claw/shared-types package: pure TypeScript domain entity types (no runtime deps)"
  - "@claw/event-schemas package: Zod v4 schemas for all Pub/Sub event payloads"
  - "@claw/tool-contracts package: Zod v4 schemas for Tool Gateway request/response contracts"
  - "ExecutionStatus, TaskStatus, BotStatus, BillingEventType enums as TS types and const arrays"
  - "Zod v4 runtime validation: botStartedEventSchema, taskClaimedEventSchema, guardrailTriggeredEventSchema, budgetExceededEventSchema"
  - "Zod v4 tool contracts: llmCallRequestSchema, fetchUrlRequestSchema, writeFileRequestSchema and corresponding response schemas"
affects: [02-orchestration, 03-tool-gateway, 04-metering, 05-frontend, 06-dna]

# Tech tracking
tech-stack:
  added:
    - zod@4.3.6 (runtime validation in event-schemas and tool-contracts)
  patterns:
    - "Internal packages strategy for all three new packages (main/types → .ts source, no build step)"
    - "ESNext+Bundler moduleResolution for packages using Zod (same pattern as packages/db)"
    - "Zod v4 exclusive API usage: z.uuid(), z.iso.datetime(), z.url(), error.issues, z.record(z.string(), z.unknown())"
    - "Schema extension pattern: specific schemas use .extend() on base schemas for DRY request/response contracts"
    - "Inferred types pattern: export type X = z.infer<typeof xSchema> alongside each schema"
    - "Result field is optional on response schemas to accommodate error cases (success: false)"

key-files:
  created:
    - packages/shared-types/package.json (@claw/shared-types workspace package)
    - packages/shared-types/tsconfig.json (ESNext+Bundler, extends tsconfig.base.json)
    - packages/shared-types/src/common.ts (UUID, Cents, ISOTimestamp type aliases)
    - packages/shared-types/src/execution.ts (ExecutionStatus, EXECUTION_STATUSES, Execution, NewExecution)
    - packages/shared-types/src/task.ts (TaskStatus, TASK_STATUSES, Task, NewTask)
    - packages/shared-types/src/bot.ts (BotStatus, BOT_STATUSES, Bot, NewBot)
    - packages/shared-types/src/billing.ts (BillingEventType, BILLING_EVENT_TYPES, BillingEvent, DnaPayload, PerformanceTier)
    - packages/shared-types/src/index.ts (barrel export of all types)
    - packages/event-schemas/package.json (@claw/event-schemas workspace package, zod dependency)
    - packages/event-schemas/tsconfig.json (ESNext+Bundler)
    - packages/event-schemas/src/bot-events.ts (botStartedEventSchema, botStoppedEventSchema, botHeartbeatEventSchema)
    - packages/event-schemas/src/execution-events.ts (executionCreatedEventSchema, executionStatusChangedEventSchema, taskClaimedEventSchema, taskCompletedEventSchema)
    - packages/event-schemas/src/guardrail-events.ts (guardrailTriggeredEventSchema with reason+action enums)
    - packages/event-schemas/src/billing-events.ts (billingEventSchema, budgetExceededEventSchema)
    - packages/event-schemas/src/index.ts (barrel export)
    - packages/tool-contracts/package.json (@claw/tool-contracts workspace package, zod dependency)
    - packages/tool-contracts/tsconfig.json (ESNext+Bundler)
    - packages/tool-contracts/src/common.ts (toolInvocationRequestBaseSchema, toolInvocationResponseBaseSchema, ToolName, TOOL_NAMES)
    - packages/tool-contracts/src/llm-call.ts (llmCallRequestSchema, llmCallResponseSchema)
    - packages/tool-contracts/src/fetch-url.ts (fetchUrlRequestSchema, fetchUrlResponseSchema, z.url() validation)
    - packages/tool-contracts/src/write-file.ts (writeFileRequestSchema, writeFileResponseSchema, encoding enum with default)
    - packages/tool-contracts/src/index.ts (barrel export)
  modified:
    - pnpm-lock.yaml (zod@4.3.6 added for event-schemas and tool-contracts)

key-decisions:
  - "ESNext+Bundler moduleResolution for event-schemas and tool-contracts (same as packages/db) — avoids .js extension issues with pnpm/tsx resolution and keeps tsconfig consistent across all packages"
  - "result field is optional on all response schemas to support error case (success: false, error: '...') without requiring a result object"
  - "executionStatusSchema defined inline in execution-events.ts (not imported from @claw/shared-types) to keep event-schemas dependency-free from shared-types, avoiding potential circular dep"
  - "Zod v4 z.record(z.string(), z.unknown()) for metadata fields (not z.record alone) — Zod v4 requires explicit key/value types for record"

patterns-established:
  - "Shared package pattern: all three packages use @claw/source customCondition export for internal packages strategy"
  - "Zod v4 pattern: use z.uuid(), z.iso.datetime(), z.url() — never z.string().uuid() (v3 style)"
  - "Schema extension pattern: .extend() on base schema for per-tool request/response contracts"
  - "Status const arrays: all enum types have a corresponding STATUSES/EVENT_TYPES const array for runtime iteration"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 1 Plan 02: Shared Contract Packages Summary

**Three contract packages — @claw/shared-types (pure TS types), @claw/event-schemas (Pub/Sub Zod v4 schemas), @claw/tool-contracts (Tool Gateway Zod v4 schemas) — providing runtime-validated domain contracts across all monorepo services**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T07:36:53Z
- **Completed:** 2026-02-18T07:40:54Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- @claw/shared-types: zero-dependency package with ExecutionStatus, TaskStatus, BotStatus, BillingEventType enums + 4 domain entity interfaces (Execution, Task, Bot, BillingEvent) + DnaPayload + common type aliases — compiles in strict mode, importable without a build step
- @claw/event-schemas: 9 Zod v4 schemas covering all Pub/Sub event types (bot lifecycle, execution lifecycle, task lifecycle, guardrails, billing) — runtime-validated with 8 smoke test assertions passing
- @claw/tool-contracts: 6 Zod v4 schemas for Tool Gateway contracts (base request/response + llm_call, fetch_url, write_file per-tool schemas) — runtime-validated with 8 smoke test assertions passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create @claw/shared-types package with domain entity types** - `5ed21b3` (feat)
2. **Task 2: Create @claw/event-schemas and @claw/tool-contracts packages with Zod v4 schemas** - `22d8b61` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/shared-types/package.json` - @claw/shared-types workspace package (no runtime deps, internal packages strategy)
- `packages/shared-types/tsconfig.json` - ESNext+Bundler moduleResolution extending tsconfig.base.json
- `packages/shared-types/src/common.ts` - UUID, Cents, ISOTimestamp type aliases
- `packages/shared-types/src/execution.ts` - ExecutionStatus union type, EXECUTION_STATUSES const array, Execution/NewExecution interfaces
- `packages/shared-types/src/task.ts` - TaskStatus, Task, NewTask
- `packages/shared-types/src/bot.ts` - BotStatus, Bot, NewBot
- `packages/shared-types/src/billing.ts` - BillingEventType, BillingEvent, DnaPayload, PerformanceTier
- `packages/shared-types/src/index.ts` - Barrel export of all type modules
- `packages/event-schemas/package.json` - @claw/event-schemas workspace package (zod@4.3.6 runtime dep)
- `packages/event-schemas/tsconfig.json` - ESNext+Bundler, same pattern as db and shared-types
- `packages/event-schemas/src/bot-events.ts` - botStartedEventSchema, botStoppedEventSchema, botHeartbeatEventSchema
- `packages/event-schemas/src/execution-events.ts` - executionCreatedEventSchema, executionStatusChangedEventSchema, taskClaimedEventSchema, taskCompletedEventSchema
- `packages/event-schemas/src/guardrail-events.ts` - guardrailTriggeredEventSchema (reason/action enums, optional metadata record)
- `packages/event-schemas/src/billing-events.ts` - billingEventSchema, budgetExceededEventSchema
- `packages/event-schemas/src/index.ts` - Barrel export
- `packages/tool-contracts/package.json` - @claw/tool-contracts workspace package (zod@4.3.6 runtime dep)
- `packages/tool-contracts/tsconfig.json` - ESNext+Bundler
- `packages/tool-contracts/src/common.ts` - toolInvocationRequestBaseSchema, toolInvocationResponseBaseSchema, ToolName, TOOL_NAMES
- `packages/tool-contracts/src/llm-call.ts` - llmCallRequestSchema (model/messages/maxTokens/temperature), llmCallResponseSchema
- `packages/tool-contracts/src/fetch-url.ts` - fetchUrlRequestSchema (z.url() validation, method enum), fetchUrlResponseSchema
- `packages/tool-contracts/src/write-file.ts` - writeFileRequestSchema (encoding enum with utf-8 default), writeFileResponseSchema (artifactId)
- `packages/tool-contracts/src/index.ts` - Barrel export
- `pnpm-lock.yaml` - Updated with zod@4.3.6 added for both new packages

## Decisions Made

- **ESNext+Bundler for new packages**: Applied the same moduleResolution pattern established in 01-01 (packages/db). This ensures consistency across all packages and avoids tsx/resolution issues. Alternative was to use NodeNext but that would require explicit `.js` extension imports and break pnpm workspace resolution for internal imports.
- **result field optional on response schemas**: Both success and error responses share the same schema type. Making `result` optional allows a single type to cover both `{ success: true, result: {...} }` and `{ success: false, error: 'message' }` without needing a discriminated union.
- **executionStatusSchema inlined in execution-events.ts**: Avoids a dependency from @claw/event-schemas on @claw/shared-types. Keeping event-schemas only dependent on Zod makes it lighter and prevents potential circular imports as the codebase grows.
- **z.record(z.string(), z.unknown()) for metadata**: Zod v4 changed the record API to require explicit key and value type arguments. Using `z.record(z.string(), z.unknown())` correctly types arbitrary JSONB-like metadata fields.

## Deviations from Plan

None — plan executed exactly as written. All specified schemas, types, and exports were created as described.

## Issues Encountered

None. The ESNext+Bundler pattern from 01-01 applied cleanly to all three new packages. Zod v4.3.6 was available and all API patterns worked as expected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three shared packages are importable from any workspace via `@claw/shared-types`, `@claw/event-schemas`, `@claw/tool-contracts` with the `@claw/source` custom condition
- Services in Phase 2 can import `ExecutionStatus`, `BotStatus`, `Task` etc. without a build step
- Event-driven services can use event-schemas Zod schemas to validate Pub/Sub message payloads at the consumer boundary
- Tool Gateway service (Phase 3) can use tool-contracts schemas to validate incoming tool invocation requests from bots
- Watch: When @claw/event-schemas or @claw/tool-contracts are imported by services, those services will also need Zod as a runtime dependency

## Self-Check: PASSED

All 22 files verified. Both task commits (5ed21b3, 22d8b61) verified in git log. All three packages compile with zero TypeScript errors. 16 Zod v4 smoke test assertions pass (8 event-schemas, 8 tool-contracts).

---
*Phase: 01-data-foundation*
*Completed: 2026-02-18*
