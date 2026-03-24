---
phase: 05-evolution-routes
plan: 01
subsystem: akasa-server / soul-system
tags: [soul-generation, soul-injection, tdd, vitest, evolution]
dependency_graph:
  requires:
    - packages/db botSouls schema
    - packages/shared-types SoulDimension type
    - paperclip/packages/db agents table
  provides:
    - services/akasa-server/src/services/soul-generator.ts
    - services/akasa-server/src/services/soul-injector.ts
    - services/akasa-server/src/routes/souls.ts
    - packages/db bots.paperclipAgentId column + migration
  affects:
    - services/akasa-server routes (adds /api/akasa/souls)
    - packages/db/src/schema/bots.ts (new column)
tech_stack:
  added:
    - "@ai-sdk/anthropic@^3.0.45"
    - "@ai-sdk/openai@^3.0.29"
    - "ai@^6.0.90"
    - "ioredis@^5.9.3"
    - "@paperclipai/db@workspace:*"
    - "vitest@^3.2.4"
    - "supertest@^7.2.2"
  patterns:
    - TDD: RED (test scaffold) → GREEN (implementation) per task
    - Express Router factory pattern for soul CRUD
    - Drizzle ORM for botSouls queries in akasa-server
    - Non-blocking embedding generation (try/catch around embedMany)
key_files:
  created:
    - services/akasa-server/src/services/soul-generator.ts
    - services/akasa-server/src/services/soul-injector.ts
    - services/akasa-server/src/routes/souls.ts
    - services/akasa-server/src/__tests__/souls.test.ts
    - services/akasa-server/src/__tests__/soul-injection.test.ts
    - services/akasa-server/vitest.config.ts
    - packages/db/migrations/akasa/0011_add_paperclip_agent_id.sql
  modified:
    - services/akasa-server/package.json
    - services/akasa-server/src/routes/index.ts
    - packages/db/src/schema/bots.ts
decisions:
  - vitest.config.ts requires both conditions['@claw/source'] AND path aliases — conditions alone insufficient; Vite cannot resolve workspace packages without explicit alias fallbacks
  - soul-injector.ts always writes SOUL.md to disk even for openai_compatible adapters (useful for audit trail and fallback)
  - Embedding generation wrapped in try/catch in soul-generator — pgvector optional in dev environment
  - Migration placed in packages/db/migrations/akasa/ subdirectory per plan spec (distinct from main Drizzle migration journal)
  - POST /inject route creates Paperclip DB connection lazily from DATABASE_URL — avoids startup failure when DB not available
metrics:
  duration: "326s"
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 10
requirements_satisfied:
  - EVO-01
  - EVO-05
---

# Phase 05 Plan 01: Soul Generator + CRUD Routes + Injection Summary

**One-liner:** Soul CRUD API at /api/akasa/souls with generateSoul/generateMutatedSoul from archetypes, soul injection writing SOUL.md to disk and patching Paperclip agent adapterConfig, and bots.paperclipAgentId FK column for linking.

## What Was Built

1. **Soul Generator (`soul-generator.ts`):** Ports `generateSoul(archetypeName, taskCategory, botId?, executionId?)` and `generateMutatedSoul(parentSoulId, mutationStrength?)` from execution-service into akasa-server. Generates SOUL.md content via GPT-4o-mini with 7 behavioral dimensions, computes SHA-256 content hash, persists to botSouls table. Embeddings are non-blocking (try/catch) to tolerate missing pgvector in dev.

2. **Soul Injector (`soul-injector.ts`):** `injectSoulIntoAgent(paperclipDb, agentId, companyId, soulContent, soulId, adapterType?)` writes SOUL.md to `~/.akasa/souls/{soulId}.md`, then PATCHes the Paperclip agent's adapterConfig with either `instructionsFilePath` (default) or `systemPrompt` (for openai_compatible adapters).

3. **Souls Router (`routes/souls.ts`):** Express router factory with GET /, GET /:id, POST /generate, POST /:id/mutate, POST /inject. All routes wrapped in try/catch with next(err) error propagation. Mounted at `/api/akasa/souls`.

4. **DB Schema:** Added `paperclipAgentId: uuid('paperclip_agent_id')` column to bots table with index `bots_paperclip_agent_id_idx`. Migration created at `packages/db/migrations/akasa/0011_add_paperclip_agent_id.sql`.

5. **Vitest Setup:** vitest.config.ts with node environment, `@claw/source` custom condition, and path aliases for `@claw/db`, `@claw/shared-types`, `@paperclipai/db`. All 7 tests pass GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest path aliases required for workspace package resolution**
- **Found during:** Task 2 (GREEN phase — tests failing with "Failed to resolve entry for package @claw/db")
- **Issue:** Vite's conditions array alone (`['@claw/source', ...]`) insufficient to resolve workspace packages. The `@claw/db` package exports `"@claw/source": "./src/index.ts"` but Vite still fails without explicit alias.
- **Fix:** Added path aliases in vitest.config.ts for `@claw/db`, `@claw/shared-types`, and `@paperclipai/db` — same pattern as execution-service vitest config.
- **Files modified:** services/akasa-server/vitest.config.ts
- **Commit:** 869bc3c

**2. [Rule 2 - Missing Functionality] supertest installed for HTTP route testing**
- **Found during:** Task 1 test scaffold creation
- **Issue:** Plan's test behavior required HTTP status assertions (200, 404, 201) which need an HTTP testing library
- **Fix:** Added `supertest@^7.0.0` and `@types/supertest` as dev dependencies
- **Files modified:** services/akasa-server/package.json

## Known Stubs

None — soul generation calls real GPT-4o-mini via Vercel AI SDK. Tests mock the service layer cleanly.

## Self-Check: PASSED

Verified files exist:
- `services/akasa-server/src/services/soul-generator.ts` ✓
- `services/akasa-server/src/services/soul-injector.ts` ✓
- `services/akasa-server/src/routes/souls.ts` ✓
- `services/akasa-server/vitest.config.ts` ✓
- `packages/db/migrations/akasa/0011_add_paperclip_agent_id.sql` ✓

Verified commits:
- 53d7b8d: test(05-01): add failing tests, install dependencies, add bots.paperclipAgentId, set up Vitest ✓
- 869bc3c: feat(05-01): port soul generator, create soul CRUD routes, implement soul injection ✓

Tests: 7/7 passing (`pnpm --filter @claw/akasa-server exec vitest run`)
