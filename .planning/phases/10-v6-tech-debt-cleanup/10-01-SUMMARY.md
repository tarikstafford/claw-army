---
phase: 10-v6-tech-debt-cleanup
plan: 01
subsystem: akasa-server, ui
tags: [security, tech-debt, pioneer-tracker, webhook, auth-guard, env-docs]
dependency_graph:
  requires: []
  provides:
    - WEBHOOK_URL_SECRET fail-fast startup guard
    - /evolution authentication protection
    - executionId data fidelity in pioneer tracking
    - .env.example documentation for akasa-server
  affects:
    - services/akasa-server/src/index.ts
    - services/akasa-server/src/routes/webhooks.ts
    - services/akasa-server/src/god-layer/pioneer-tracker.ts
    - services/akasa-server/src/god-layer/god-layer-handler.ts
    - services/ui/src/hooks.server.ts
    - services/ui/src/routes/(marketing)/+page.server.ts
tech_stack:
  added: []
  patterns:
    - fail-fast env var guard pattern (consistent with databaseUrl guard)
    - non-null assertion for required env vars (no predictable fallbacks)
key_files:
  created:
    - services/akasa-server/.env.example
  modified:
    - services/akasa-server/src/index.ts
    - services/akasa-server/src/routes/webhooks.ts
    - services/akasa-server/src/god-layer/pioneer-tracker.ts
    - services/akasa-server/src/god-layer/god-layer-handler.ts
    - services/akasa-server/src/__tests__/god-layer.test.ts
    - services/ui/src/hooks.server.ts
    - services/ui/src/routes/(marketing)/+page.server.ts
decisions:
  - WEBHOOK_URL_SECRET uses non-null assertion (!) not fallback — no predictable secrets in production
  - WEBHOOK_URL_SECRET fail-fast guard inserted after databaseUrl guard, before migrations — consistent with existing pattern
  - executionId added as 5th parameter to checkAndRecordPioneer — call sites updated including tests
  - Marketing page waitlist action logs email via console.log and returns success — no DB write, no stale API call
  - /evolution added to isProtected in hooks.server.ts — consistent with existing route guard pattern
metrics:
  duration: 5 min
  completed: "2026-03-30"
  tasks_completed: 2
  files_changed: 8
---

# Phase 10 Plan 01: v6.0 Tech Debt Cleanup Summary

**One-liner:** Eliminated 6 v6.0 audit defects: WEBHOOK_URL_SECRET fail-fast guard, dev fallback removal, executionId data fidelity fix in pioneer tracker, stale EXECUTION_SERVICE_URL removal, /evolution auth protection, and .env.example documentation.

## What Was Built

A focused surgical cleanup of 6 specific defects from the v6.0 milestone audit:

1. **`.env.example` created** — Documents all required and optional env vars for `services/akasa-server` with generation hints for secrets and production notes for `AKASA_BASE_URL` OAuth callback behavior.

2. **WEBHOOK_URL_SECRET fail-fast guard** — `services/akasa-server/src/index.ts` now throws immediately at startup if `WEBHOOK_URL_SECRET` is not set (after the existing `databaseUrl` guard, before migrations). Consistent with established project pattern.

3. **dev-webhook-secret fallback removed** — `services/akasa-server/src/routes/webhooks.ts` `deriveWebhookToken()` now uses `process.env['WEBHOOK_URL_SECRET']!` (non-null assertion). No predictable fallback means no silent security regression in production.

4. **Pioneer tracker data fidelity fix** — `checkAndRecordPioneer` gains a 5th `executionId: string` parameter. The `pioneerExecutionId` column now receives the actual execution ID, not `botId` as a placeholder. Call site in `god-layer-handler.ts` passes `verdict.executionId`. Test files updated to pass `'exec-1'` as 5th arg.

5. **Stale EXECUTION_SERVICE_URL removed** — `services/ui/src/routes/(marketing)/+page.server.ts` waitlist action no longer references the v5-era `EXECUTION_SERVICE_URL` env var or calls the stale `/admin/waitlist` endpoint. The action now validates email, logs it, and returns `{ success: true }`.

6. **`/evolution` auth protection** — `services/ui/src/hooks.server.ts` `isProtected` now includes `/evolution` routes. Unauthenticated users are redirected to `/auth`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All 6 ROADMAP Phase 10 success criteria satisfied:

1. `grep -r "EXECUTION_SERVICE_URL" services/ui/src/routes/` — returns no results
2. `grep "pioneerExecutionId: executionId" services/akasa-server/src/god-layer/pioneer-tracker.ts` — match found
3. `grep -r "dev-webhook-secret" services/akasa-server/src/` — returns no results
4. `grep "WEBHOOK_URL_SECRET must be set" services/akasa-server/src/index.ts` — match found
5. `grep "evolution" services/ui/src/hooks.server.ts` — match found in isProtected
6. `test -f services/akasa-server/.env.example` && `grep "AKASA_BASE_URL" services/akasa-server/.env.example` — both pass

Unit tests: `WEBHOOK_URL_SECRET=test pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` — 22/22 tests pass.

## Self-Check: PASSED

- `services/akasa-server/.env.example` — FOUND
- `services/akasa-server/src/index.ts` contains WEBHOOK_URL_SECRET guard — FOUND
- `services/akasa-server/src/routes/webhooks.ts` has no dev-webhook-secret — VERIFIED
- `services/akasa-server/src/god-layer/pioneer-tracker.ts` has executionId param — FOUND
- `services/ui/src/hooks.server.ts` has /evolution in isProtected — FOUND
- Commits d9677ef and 2e13eb3 — FOUND in git log
