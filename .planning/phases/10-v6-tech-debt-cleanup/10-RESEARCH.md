# Phase 10: v6.0 Tech Debt Cleanup - Research

**Researched:** 2026-03-30
**Domain:** Security hardening, stale reference removal, data fidelity fixes, env documentation
**Confidence:** HIGH — all items traced directly to live source files; no speculative findings

## Summary

Phase 10 is a focused cleanup pass against 6 specific defects identified in the v6.0 milestone audit. The items fall into four categories: (1) a stale v5 env var reference in the marketing page, (2) a data fidelity bug where `pioneer-tracker.ts` stores `botId` instead of `executionId` in the `pioneerExecutionId` column, (3) a security issue where `WEBHOOK_URL_SECRET` has a predictable fallback that must be replaced with a hard startup failure, and (4) missing documentation and route guard gaps (`/evolution` not in `isProtected`, no `.env.example`, `AKASA_BASE_URL` undocumented).

Each item has been verified by reading the actual file. The changes are small, surgical, and self-contained — no new dependencies, no new architecture. The most consequential change is the `WEBHOOK_URL_SECRET` fail-fast guard, which needs to slot into `services/akasa-server/src/index.ts` (the startup sequence), before any router factory that calls `deriveWebhookToken()` executes.

**Primary recommendation:** Address all 6 success criteria in one plan (they are all small), ordered so the `.env.example` creation comes first — that file documents the env var before the code is changed to require it.

## Standard Stack

This phase uses only existing project infrastructure. No new packages.

### Core
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Server startup | `services/akasa-server/src/index.ts` | Location to insert env var fail-fast guard |
| Route guard | `services/ui/src/hooks.server.ts` | Location to add `/evolution` to `isProtected` |
| Pioneer tracker | `services/akasa-server/src/god-layer/pioneer-tracker.ts` | Bug fix site — `botId` → `executionId` parameter |
| Marketing page | `services/ui/src/routes/(marketing)/+page.server.ts` | Remove `EXECUTION_SERVICE_URL` reference |
| Webhook token | `services/akasa-server/src/routes/webhooks.ts` | Remove fallback from `deriveWebhookToken()` |
| Env documentation | `services/akasa-server/.env.example` | New file to create |

**Installation:** None required.

## Architecture Patterns

### Pattern 1: Fail-Fast Env Var Guards in `index.ts`

The project already has this pattern established — `services/akasa-server/src/index.ts` line 67 throws early if `DATABASE_URL` is not set:

```typescript
// Source: services/akasa-server/src/index.ts (existing pattern)
if (!config.databaseUrl) {
  throw new Error(
    '[akasa-server] DATABASE_URL must be set. ...',
  );
}
```

Apply the same pattern for `WEBHOOK_URL_SECRET` immediately after the existing DATABASE_URL guard. The check must happen at module load time (top level of `index.ts`), before any router factory is called, so that developers get an immediate loud failure rather than a silent security regression.

```typescript
// Pattern to apply for WEBHOOK_URL_SECRET
if (!process.env['WEBHOOK_URL_SECRET']) {
  throw new Error(
    '[akasa-server] WEBHOOK_URL_SECRET must be set. ' +
    'Generate with: openssl rand -hex 32',
  );
}
```

### Pattern 2: isProtected List in `hooks.server.ts`

The `isProtected` check is a single boolean expression joining `startsWith()` calls. Adding `/evolution` requires appending one more condition:

```typescript
// Source: services/ui/src/hooks.server.ts (current state)
const isProtected = event.url.pathname.startsWith('/indra') ||
  event.url.pathname.startsWith('/office') ||
  event.url.pathname.startsWith('/chat') ||
  event.url.pathname.startsWith('/sanctum') ||
  event.url.pathname.startsWith('/tools');

// Target state — add /evolution
const isProtected = event.url.pathname.startsWith('/indra') ||
  event.url.pathname.startsWith('/office') ||
  event.url.pathname.startsWith('/chat') ||
  event.url.pathname.startsWith('/sanctum') ||
  event.url.pathname.startsWith('/tools') ||
  event.url.pathname.startsWith('/evolution');
```

### Pattern 3: Fix `checkAndRecordPioneer` Signature

The function currently takes `botId` as first arg and uses it as a placeholder for `pioneerExecutionId`. The correct fix is to add `executionId` as a parameter (5th arg after compositeScore, or replace the 1st arg position — see call site below). Looking at the call site in `god-layer-handler.ts`, `verdict.executionId` is available:

```typescript
// Current (wrong) call site — god-layer-handler.ts line 216
const isPioneer = await checkAndRecordPioneer(
  verdict.botId,
  verdict.soulId,
  taskCategory,
  compositeScore,
);

// Target: add executionId parameter
const isPioneer = await checkAndRecordPioneer(
  verdict.botId,
  verdict.soulId,
  taskCategory,
  compositeScore,
  verdict.executionId,
);
```

And the function signature must be updated to accept and use it:

```typescript
// Target signature
export async function checkAndRecordPioneer(
  botId: string,
  soulId: string | null | undefined,
  taskCategory: string,
  compositeScore: string,
  executionId: string,
): Promise<boolean> {
  // ...
  await db.insert(categoryBenchmarks).values({
    // ...
    pioneerExecutionId: executionId,  // was: botId (placeholder)
    // ...
  });
}
```

The test file (`src/__tests__/god-layer.test.ts` lines 265 and 288) calls `checkAndRecordPioneer('bot-1', 'soul-1', 'new-category', '0.80')` with 4 args — both call sites must be updated to pass a 5th `executionId` arg (e.g. `'exec-1'`).

### Pattern 4: Marketing Page Waitlist Endpoint

The marketing page `(marketing)/+page.server.ts` references `EXECUTION_SERVICE_URL` (a v5 concept). In v6 there is no separate execution service — the waitlist endpoint, if it exists, would be on `akasa-server` at `/api/akasa/...`. However the success criterion only requires removing the stale reference, not rewiring the waitlist to a new backend. The correct action is to remove the feature gracefully: if `EXECUTION_SERVICE_URL` is unset, the form submission should return a friendly error rather than failing with a server config error. Given that this is a v5 stale reference and no `/admin/waitlist` route exists in akasa-server, the cleanest fix is to remove the server action body and replace it with a stub that returns `{ success: true }` (no-op / feature flag off), or remove the action entirely and disable form submission. The success criterion says "stale v5 env var removed" — the env var read and the `fetch()` to `executionServiceUrl` must go.

### Pattern 5: `.env.example` for `akasa-server`

Based on audit of all `process.env` accesses in `services/akasa-server/src/`:

Required/security-critical vars:
- `DATABASE_URL` — Postgres connection (already checked in index.ts)
- `WEBHOOK_URL_SECRET` — Webhook token derivation (will be required after fix)
- `TOOL_ENCRYPTION_KEY` — AES-256-GCM key for credential encryption (falls back to PAPERCLIP_SECRETS_MASTER_KEY)
- `PAPERCLIP_SECRETS_MASTER_KEY` — Paperclip master key (fallback for TOOL_ENCRYPTION_KEY)
- `AKASA_BASE_URL` — OAuth callback base URL (must be documented with explanation)

OAuth provider vars (required for Tool Nexus OAuth to function):
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Optional/defaults:
- `REDIS_URL` (defaults to `redis://localhost:6379`)
- `PORT` (Paperclip config.ts default: 3100)

### Anti-Patterns to Avoid

- **Removing the `WEBHOOK_URL_SECRET` check from `webhooks.ts` only:** The fallback is in `deriveWebhookToken()` which is called per-request. The fail-fast must happen in `index.ts` at startup — otherwise the check is per-request and the fallback string still exists somewhere.
- **Changing `checkAndRecordPioneer` signature in a breaking way:** The function is called in one place in production code (`god-layer-handler.ts`) and two places in tests. Add the parameter at the end to minimize test churn.
- **Adding `AKASA_BASE_URL` as required (fail-fast):** The audit notes it as undocumented, not as a required guard. Its localhost default is acceptable in dev. Document it, do not make it a startup requirement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Env var validation | Custom validation framework | Simple `if (!process.env[...]) throw` pattern already in codebase |
| Secure random secret | Custom entropy source | `openssl rand -hex 32` (document in .env.example) |

## Common Pitfalls

### Pitfall 1: Forgetting the Test File for `checkAndRecordPioneer`

**What goes wrong:** The function signature is updated in `pioneer-tracker.ts` and the call site in `god-layer-handler.ts`, but the test file (`src/__tests__/god-layer.test.ts` lines 265 and 288) is not updated. Tests fail with "Expected 4 arguments, but got 5" or TypeScript errors.

**How to avoid:** Search for all callsites before changing the signature: `grep -rn "checkAndRecordPioneer"`.

**Files to update:** `pioneer-tracker.ts`, `god-layer-handler.ts`, `god-layer.test.ts` (2 call sites).

### Pitfall 2: WEBHOOK_URL_SECRET Guard Placement

**What goes wrong:** The guard is placed inside the router factory function body (`webhooksRouter()`) rather than in `index.ts`. This means the error only surfaces when a request hits the webhook routes, not at startup.

**How to avoid:** Place the guard in `index.ts` top-level startup sequence, after the `config.databaseUrl` check. The startup sequence throws synchronously before the HTTP server is created.

### Pitfall 3: Marketing Page — No Replacement Endpoint

**What goes wrong:** Developer removes the `EXECUTION_SERVICE_URL` read and the fetch but doesn't account for what the form does now. The form action returns `undefined` (no action body), which SvelteKit interprets as missing action, causing a 405.

**How to avoid:** The action must still exist and return a valid ActionResult. Replace the body with a no-op stub (`return { success: true }`) or log the submission somewhere accessible. Do not delete the `export const actions` object — only the body that references the stale URL.

### Pitfall 4: `.env.example` Drift

**What goes wrong:** The `.env.example` lists variables that no longer exist in the code, or misses new ones added after the file is created.

**How to avoid:** Cross-reference against the `grep -rn "process.env\[" services/akasa-server/src/` output (already run during research). The complete list is documented in the Code Examples section below.

## Code Examples

### Complete akasa-server env var inventory (from source audit)

Verified by `grep -rn "process.env\["` on `services/akasa-server/src/`:

| Variable | Location | Required? | Default |
|----------|----------|-----------|---------|
| `DATABASE_URL` | `index.ts` (via config) | YES — fails now | — |
| `WEBHOOK_URL_SECRET` | `routes/webhooks.ts:44` | Will be required after fix | `'dev-webhook-secret'` (insecure) |
| `TOOL_ENCRYPTION_KEY` | `services/credential-encryption.ts:6` | One of the two is required | — |
| `PAPERCLIP_SECRETS_MASTER_KEY` | `services/credential-encryption.ts:20` | Fallback for above | — |
| `AKASA_BASE_URL` | `routes/oauth-flow.ts:25,74` | Recommended for prod | `'http://localhost:5173'` |
| `REDIS_URL` | `god-layer/dna-writer.ts:30` | NO | `'redis://localhost:6379'` |
| `PORT` | `index.ts` (via config) | NO | `3100` |
| `HUBSPOT_CLIENT_ID` | `routes/oauth-flow.ts:38` | For HubSpot OAuth | — |
| `HUBSPOT_CLIENT_SECRET` | `routes/oauth-flow.ts:106`, `webhooks.ts:149` | For HubSpot OAuth + verification | — |
| `SLACK_CLIENT_ID` | `services/token-manager.ts:231` | For Slack OAuth | — |
| `SLACK_CLIENT_SECRET` | `services/token-manager.ts:232` | For Slack OAuth | — |
| `SLACK_SIGNING_SECRET` | `routes/webhooks.ts:162` | For Slack webhook verification | — |
| `GOOGLE_CLIENT_ID` | `services/token-manager.ts:188` | For Google Sheets OAuth | — |
| `GOOGLE_CLIENT_SECRET` | `services/token-manager.ts:189` | For Google Sheets OAuth | — |

### Startup guard for WEBHOOK_URL_SECRET (in `index.ts`)

```typescript
// Source: modeled on existing DATABASE_URL guard at line 67 of index.ts
if (!process.env['WEBHOOK_URL_SECRET']) {
  throw new Error(
    '[akasa-server] WEBHOOK_URL_SECRET must be set. ' +
    'Generate with: openssl rand -hex 32',
  );
}
```

Place immediately after the `config.databaseUrl` guard (line 72 in current file), before any router is instantiated.

### Remove fallback in `deriveWebhookToken()`

```typescript
// Before (insecure)
const webhookSecret = process.env['WEBHOOK_URL_SECRET'] ?? 'dev-webhook-secret';

// After (startup guard ensures env var is set)
const webhookSecret = process.env['WEBHOOK_URL_SECRET']!;
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `services/akasa-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` |
| Full suite command | `pnpm --filter @claw/akasa-server exec vitest run` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs. Each success criterion maps to a targeted test or manual verification:

| Success Criterion | Test Type | Automated Command | File Exists? |
|------------------|-----------|-------------------|-------------|
| Marketing page no longer reads `EXECUTION_SERVICE_URL` | grep audit | `grep -r "EXECUTION_SERVICE_URL" services/ui/src/routes/` | N/A (negative grep) |
| `pioneer-tracker.ts` uses `executionId` | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts` | Yes (needs update) |
| `WEBHOOK_URL_SECRET` no fallback | unit/startup | Manual: start server without env var set — should throw | Manual |
| `/evolution` in `isProtected` | grep audit | `grep -n "isProtected" services/ui/src/hooks.server.ts` | N/A (manual verify) |
| `.env.example` exists | file existence | `ls services/akasa-server/.env.example` | No — Wave 0 gap |
| `AKASA_BASE_URL` documented | content audit | `grep "AKASA_BASE_URL" services/akasa-server/.env.example` | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/god-layer.test.ts`
- **Per wave merge:** `pnpm --filter @claw/akasa-server exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `services/akasa-server/.env.example` — new file documenting all env vars (covers success criteria 5 and 6)

*(All other test infrastructure exists — the existing `god-layer.test.ts` covers the pioneer-tracker fix after call-site updates)*

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are source code edits and file creation within existing services)

## Sources

### Primary (HIGH confidence)
- Direct source code audit of `services/akasa-server/src/` — all file contents read
- Direct source code audit of `services/ui/src/hooks.server.ts` — read
- Direct source code audit of `services/ui/src/routes/(marketing)/+page.server.ts` — read
- `.planning/v6.0-MILESTONE-AUDIT.md` — authoritative list of tech debt items

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated architectural decisions, confirms single-tenant acceptable for session middleware gap
- `.planning/REQUIREMENTS.md` — confirms no new requirements are added by this phase

## Metadata

**Confidence breakdown:**
- Defect locations: HIGH — all 6 success criteria traced to specific lines in specific files
- Fix approach: HIGH — patterns are established in existing codebase (fail-fast guard, isProtected list)
- Test impact: HIGH — god-layer.test.ts call sites identified; 2 test lines need updating

**Research date:** 2026-03-30
**Valid until:** N/A — this research targets specific live file contents; re-verify if files changed since research
