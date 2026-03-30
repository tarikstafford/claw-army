# Phase 11: Tool Nexus Integration Fixes - Research

**Researched:** 2026-03-30
**Domain:** TypeScript bug fixes — OAuth redirect flow, plugin credential resolution, plugin path resolution, webhook agent dispatch
**Confidence:** HIGH

## Summary

Phase 11 is a targeted bug-fix phase closing 4 precise integration breaks identified by the v6.0 milestone audit. All four bugs are narrow, single-point-of-failure defects — none require architectural changes. The code volume is small: approximately 6 files touched, no new packages required.

The bugs share a common root cause pattern: each was introduced during Phase 6 (Tool Nexus Backend) and Phase 9 (Tool Nexus Wiring) implementation where placeholder values or off-by-one counts were used and never validated against a running system because the E2E path was never tested end-to-end. The phase is an integration correction phase, not a feature phase.

**Primary recommendation:** Fix all four bugs in two plans — Plan A handles the three backend fixes (plugin path, credential resolution, webhook dispatch) and Plan B handles the UI fix (redirectUri) and adds a test for the internal userId endpoint. Do not add new packages; all fixes use existing imports.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Tool Nexus connectors built as Paperclip plugins — each connector registers tools with the plugin tool dispatcher | Fixed by Bug 3 (plugin path): `ensureToolNexusPlugin` will now resolve to the correct path and install the plugin at startup |
| TOOL-02 | OAuth connection flow for SaaS integrations — redirect to provider, callback, encrypted token storage, auto-refresh on expiry | Fixed by Bug 1 (redirectUri): UI must send `/api/akasa/tool-connections/oauth/:toolId/callback` not `/tools` |
| TOOL-03 | API key connection flow as fallback — masked input, test-connection button, clear error on bad credential | Also affected by Bug 1 — OAuth callback path fix unblocks both OAuth and API-key re-auth flows |
| TOOL-05 | Tool Belt view — user's connected tools with status badges, last used, re-auth button on expired | Fixed by Bug 2 (userId mismatch): agent invocations now succeed, enabling status updates |
| TOOL-06 | Starter connectors shipped — HubSpot, Slack, Google Sheets as working Paperclip plugins | Fixed by Bugs 2 and 3: plugin loads (Bug 3) and credential resolution works (Bug 2) |
| TOOL-07 | Webhook receiver — unique URL per user per tool, signature verification, payloads routed to agent/objective | Fixed by Bug 4 (companies/default): heartbeat wakeup now uses `/api/agents/:id/wakeup` |
| TOOL-08 | Webhook routing rules configurable — "when [event] matches [condition] → assign to [agent]" | Currently the routing evaluation works; Bug 4 fix means the resulting agent notification also fires |
</phase_requirements>

---

## Bug Analysis

All four bugs are documented in `.planning/v6.0-MILESTONE-AUDIT.md` under `integration` and `flows` sections. This research confirms each root cause by direct code inspection.

### Bug 1: OAuth redirectUri mismatch (UI)

**Files involved:**
- `services/ui/src/routes/(app)/tools/belt/+page.svelte` — line 28
- `services/ui/src/routes/(app)/tools/catalog/+page.svelte` — line 29

**Root cause (confirmed by code inspection):**
Both `startOAuth()` functions pass `redirectUri = window.location.origin + '/tools'` which is `http://localhost:5173/tools` — a SvelteKit page URL, not an API handler. The OAuth provider redirects the browser to this URL with `?code=XXX`, but SvelteKit's router renders the `/tools` page and ignores the code parameter. The authorization code is silently discarded.

**What the redirectUri must be:**
The actual callback handler lives at `services/akasa-server/src/routes/oauth-flow.ts` route `GET /oauth/:toolId/callback`, mounted via `akasaRouter.use('/akasa/tool-connections', oauthFlowRouter())`, so the full path is `/api/akasa/tool-connections/oauth/:toolId/callback`.

The fix is a one-line change per file:
```typescript
// BEFORE (wrong — routes to SvelteKit page)
'&redirectUri=' + encodeURIComponent(window.location.origin + '/tools')

// AFTER (correct — routes to Express callback handler)
'&redirectUri=' + encodeURIComponent(window.location.origin + '/api/akasa/tool-connections/oauth/' + toolId + '/callback')
```

Note: `oauth-flow.ts` already decodes `redirectUri` from the `state` parameter in the callback handler and uses it to call `fetch(provider.tokenUrl, { body: tokenParams })` with `redirect_uri: redirectUri`. So the redirect_uri passed to the provider MUST match the callback URL. The fix must be applied to both pages.

**Confidence:** HIGH — confirmed by reading both Svelte files and the oauth-flow.ts callback handler.

---

### Bug 2: resolveCredential receives companyId but tool_connections stores BetterAuth userId

**Files involved:**
- `packages/plugins/akasa-tool-nexus/src/connectors/hubspot.ts` — lines 59, 142, 239
- `packages/plugins/akasa-tool-nexus/src/connectors/slack.ts` — lines 51, 126
- `packages/plugins/akasa-tool-nexus/src/connectors/google-sheets.ts` — lines 50, 125
- `packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts`
- New: `services/akasa-server/src/routes/tool-connections.ts` (add userId lookup endpoint)

**Root cause (confirmed by code inspection):**

The Paperclip plugin SDK's `ToolRunContext` type (in `paperclip/packages/plugins/sdk/src/types.ts` line 177) defines:
```typescript
export interface ToolRunContext {
  agentId: string;
  runId: string;
  companyId: string;  // ← UUID from Paperclip companies table
  projectId: string;
}
```

The `companyId` is the Paperclip company UUID. But `tool_connections.userId` stores the BetterAuth user ID (text, e.g. a session user ID string). These are different identifiers from different systems. The lookup `WHERE userId = companyId` always returns zero rows.

**The mapping:** Paperclip has a `company_memberships` table (in `paperclip/packages/db/src/schema/company_memberships.ts`) linking `companyId` (UUID) → `principalId` (BetterAuth userId, text). This is the correct translation path.

**Plugin worker environment constraint (confirmed):**
The plugin runs as a separate child process. Paperclip's `plugin-worker-manager.ts` (line 610) explicitly does NOT spread `process.env` into the worker — it only passes `PATH`, `NODE_PATH`, `PAPERCLIP_PLUGIN_ID`, `NODE_ENV`, `TZ`. Therefore `DATABASE_URL` is NOT available in the plugin worker.

The plugin's `@claw/db` import (`packages/db/src/client.ts`) calls `drizzle(process.env['DATABASE_URL']!, ...)` — this will fail in the worker context since `DATABASE_URL` is `undefined`.

**Fix strategy — internal HTTP endpoint:**

Add a single new route to akasa-server: `GET /akasa/internal/user-by-company/:companyId`

This endpoint:
1. Queries `company_memberships` from `@paperclipai/db` (Paperclip DB, available in akasa-server process which has `DATABASE_URL`)
2. Returns `{ userId: string }` — the BetterAuth user ID
3. Requires no auth (localhost-only; `local_trusted` mode means all requests from localhost are board-level)

The endpoint needs access to Paperclip's DB connection. In `index.ts`, the Paperclip db is created: `const db = createDb(config.databaseUrl)`. This must be passed to the new route factory, or `@paperclipai/db`'s schema tables can be queried via Akasa's existing db singleton since both use the same PostgreSQL instance and `DATABASE_URL`.

The connector files then change from:
```typescript
const cred = await resolveCredential('hubspot', runCtx.companyId);
```
to:
```typescript
const cred = await resolveCredential('hubspot', runCtx.companyId, runCtx);
```
where `resolveCredential` internally calls the HTTP endpoint to resolve the BetterAuth userId.

**Plugin config plumbing (required):**
The credential-bridge in the plugin worker needs to know which port akasa-server is listening on to call the internal endpoint. The solution:
1. Add `instanceConfigSchema` to the plugin manifest: `{ port: { type: 'string' } }`
2. In `ensureToolNexusPlugin`, after a successful install, POST plugin config: `{ port: String(config.port) }`
3. In `worker.ts` `setup()`, read `const { port } = await ctx.config.get()` and store as module-level var
4. `credential-bridge.ts` reads the stored port to build the endpoint URL

**Confidence:** HIGH — all types verified from source, worker spawn code confirmed, company_memberships schema confirmed as exported from `@paperclipai/db`.

---

### Bug 3: ensureToolNexusPlugin uses 4x ../ instead of 3x

**Files involved:**
- `services/akasa-server/src/index.ts` — line 17

**Root cause (confirmed by code inspection):**

Current code:
```typescript
const pluginPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/plugins/akasa-tool-nexus'
);
```

`import.meta.url` resolves to `services/akasa-server/src/index.ts`. `path.dirname()` gives `services/akasa-server/src`. Then:
- `../` × 1 = `services/akasa-server`
- `../` × 2 = `services`
- `../` × 3 = project root (`claw-army/`)
- `../` × 4 = **parent of project root** (one level too high)

Verified: `packages/plugins/akasa-tool-nexus` exists at `claw-army/packages/plugins/akasa-tool-nexus`. Therefore 3x `../` is correct.

Fix:
```typescript
'../../../packages/plugins/akasa-tool-nexus'
```

This is a one-line fix. After this fix, `accessSync(distWorker)` will succeed (plugin is built), and `fetch('/api/plugins/install', ...)` will install the plugin into Paperclip.

**Note on dist:** The plugin dist must exist at `packages/plugins/akasa-tool-nexus/dist/worker.js`. The Phase 9 build produced a working 22KB bundle. No rebuild needed unless sources changed.

**Confidence:** HIGH — confirmed by path arithmetic and verified plugin directory location on disk.

---

### Bug 4: Webhook agent dispatch hardcodes `companies/default`

**Files involved:**
- `services/akasa-server/src/routes/webhooks.ts` — lines 258-275

**Root cause (confirmed by code inspection):**

Current code:
```typescript
const heartbeatRes = await fetch(
  `http://localhost:${port}/api/companies/default/agents/${matchedRule.assignToAgentId}/heartbeat`,
  ...
);
```

Two problems:
1. `companies/default` is not a valid company ID — this route doesn't exist in Paperclip
2. The correct Paperclip endpoint (confirmed from `paperclip/server/src/routes/agents.ts` line 1296) is:
   `POST /api/agents/:id/wakeup` — there is no companies-scoped heartbeat path in the current Paperclip API

The `/api/agents/:id/wakeup` endpoint is mounted at `api.use(agentRoutes(db))` (confirmed in `paperclip/server/src/app.ts` line 134 — `agentRoutes` mounts directly on the `api` router, not under `/companies`).

In `local_trusted` mode, `req.actor.source === 'local_implicit'`, which means `assertCompanyAccess()` passes for any company ID — so no auth token is needed for the wakeup call from webhooks.ts.

**Request body change:** The `wakeup` endpoint expects `{ source, triggerDetail, reason, payload }`. The current code sends `{ context, payload }`. Fix:
```typescript
body: JSON.stringify({
  source: 'webhook',
  triggerDetail: `webhook:${toolId}:event_type=${eventType}`,
  payload: parsedPayload,
})
```

**Port availability:** `webhooks.ts` already reads `process.env['PORT']` (line 259). This is correct since webhooks.ts runs in the akasa-server process (not the plugin worker), where all env vars are available.

**Confidence:** HIGH — endpoint path confirmed from Paperclip source, local_trusted auth bypass confirmed.

---

## Standard Stack

No new packages required. All fixes use existing imports.

### Existing Stack (relevant to this phase)
| Component | Location | Relevant to |
|-----------|----------|-------------|
| Express Router | `services/akasa-server/src/routes/` | New internal endpoint |
| `@paperclipai/db` (`companyMemberships`) | Already imported in `akasa-server/src/index.ts` indirectly | New endpoint uses Paperclip DB |
| `@claw/db` (`toolConnections`) | Already used in credential-bridge | Unchanged |
| Vitest | `services/akasa-server/vitest.config.ts` | Tests for new endpoint |

### Key Import Available
`@paperclipai/db` exports `companyMemberships` (confirmed). The akasa-server `index.ts` already has access to the Paperclip DB `db` object created from `config.databaseUrl`. The new endpoint must receive this db instance via its router factory.

However, the simplest path: the new `/akasa/internal/user-by-company/:companyId` route can query via `@paperclipai/db`'s schema + the Paperclip db singleton already created in index.ts. Pass the Paperclip `db` to `akasaRouter` as a parameter, or make the internal endpoint a direct route that imports from index-level state.

Alternative (simpler): Import `createDb` from `@paperclipai/db`, call it lazily with `process.env['DATABASE_URL']`, and cache the connection.

## Architecture Patterns

### Pattern 1: Express Router Factory
All akasa-server routes follow the factory pattern:
```typescript
export function internalRouter(): Router {
  const router = Router();
  router.get('/user-by-company/:companyId', async (req, res, next) => { ... });
  return router;
}
```
Mount in `routes/index.ts` as `akasaRouter.use('/akasa/internal', internalRouter())`.

### Pattern 2: Paperclip DB in akasa-server routes
The existing `evolution-dashboard.ts` pattern — it receives no db parameter, imports from `@claw/db` directly. For the new endpoint we need `companyMemberships` from `@paperclipai/db`. Use lazy singleton pattern:
```typescript
import { createDb, companyMemberships } from '@paperclipai/db';
import { eq, and } from 'drizzle-orm';

let _pcDb: ReturnType<typeof createDb> | null = null;
function getPaperclipDb() {
  if (!_pcDb) _pcDb = createDb(process.env['DATABASE_URL']!);
  return _pcDb;
}
```

### Pattern 3: Plugin config passing in ensureToolNexusPlugin
After install succeeds, set plugin config via HTTP:
```typescript
await fetch(`http://localhost:${port}/api/plugins/${pluginId}/config`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ configJson: { akasaPort: String(port) } }),
});
```
The plugin key is `akasa.tool-nexus` (from manifest id). The plugins route returns the plugin record including `id` (DB UUID) and `pluginKey`. Use `pluginKey` in the config path.

### Pattern 4: Plugin config consumption in worker
```typescript
// In worker.ts setup():
let akasaPort = '3100'; // default fallback
export function setAkasaPort(port: string) { akasaPort = port; }
export function getAkasaPort() { return akasaPort; }

// setup():
const config = await ctx.config.get() as { akasaPort?: string };
if (config.akasaPort) setAkasaPort(config.akasaPort);
```
`credential-bridge.ts` imports `getAkasaPort()` and uses it:
```typescript
const resp = await fetch(`http://localhost:${getAkasaPort()}/api/akasa/internal/user-by-company/${companyId}`);
const { userId } = await resp.json() as { userId: string };
```

### Anti-Patterns to Avoid
- **Do not use `companies/default`**: There is no such route in Paperclip's API
- **Do not pass `DATABASE_URL` or `TOOL_ENCRYPTION_KEY` to plugin worker env**: Paperclip's plugin spawn explicitly excludes process.env for security; circumventing this would require modifying Paperclip core
- **Do not add auth to the internal endpoint**: It's localhost-only in local_trusted mode; adding JWT auth creates circular bootstrap dependency

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Company-to-user mapping | Custom table or in-memory cache | Query existing `company_memberships` from `@paperclipai/db` |
| Plugin env injection | Modifying Paperclip's spawn code | Plugin config via `POST /api/plugins/:pluginId/config` |
| OAuth token exchange | Custom HTTP client | Existing `oauth-flow.ts` already handles this correctly once redirectUri is fixed |

## Common Pitfalls

### Pitfall 1: redirectUri must match the provider's registered callback URL
**What goes wrong:** If the OAuth provider has `http://localhost:5173/api/akasa/...` registered as an allowed redirect URI but the developer passes a different URL, the provider rejects the authorization request before returning the code.
**How to avoid:** The `redirectUri` in the fix must match whatever is registered in HubSpot/Slack/Google developer console. For local dev this is typically `http://localhost:5173/api/akasa/tool-connections/oauth/:toolId/callback`. The `AKASA_BASE_URL` env var controls the fallback in `oauth-flow.ts`. Document this in `.env.example`.
**Warning signs:** Provider returns `redirect_uri_mismatch` or similar error in the OAuth callback.

### Pitfall 2: Plugin config is only available AFTER the plugin finishes loading
**What goes wrong:** Calling `POST /api/plugins/:pluginId/config` immediately after `POST /api/plugins/install` may race with the plugin's `setup()` call — if `configChanged` fires before `setup()` reads initial config, the port may not be set in time.
**How to avoid:** `credential-bridge.ts` should use a default fallback port (`3100`) if plugin config has not yet been initialized. The `getAkasaPort()` function should default to `'3100'` before any `configChanged` fires. The install sequence in `ensureToolNexusPlugin` should POST config after a short wait OR the bridge should gracefully retry.
**Warning signs:** First invocation fails with "fetch failed" then subsequent calls work.

### Pitfall 3: assertCompanyAccess requires at minimum actor.type !== 'none'
**What goes wrong:** In `local_trusted` mode, `req.actor = { type: 'board', source: 'local_implicit', ... }` — this is set unconditionally at the start of `actorMiddleware`. So all local calls pass `assertCompanyAccess`. However, if `PAPERCLIP_DEPLOYMENT_MODE` is not `local_trusted`, the wakeup endpoint will require real auth.
**How to avoid:** In the webhook dispatch, do not add a bearer token — in `local_trusted` mode no token is needed. Document that webhook-to-agent dispatch only works in `local_trusted` mode for now.

### Pitfall 4: Plugin pluginKey vs pluginId in the config endpoint
**What goes wrong:** `POST /api/plugins/:pluginId/config` expects the DB UUID (`id`) not the string key (`pluginKey`). The plugins list response returns both. After install, the GET `/api/plugins` response includes `{ id: UUID, pluginKey: 'akasa.tool-nexus' }`. Use `id` in the config POST.
**How to avoid:** In `ensureToolNexusPlugin`, after install, fetch the plugin list, find `pluginKey === 'akasa.tool-nexus'`, use its `id` field for the config POST.

### Pitfall 5: esbuild externals mean @claw/db resolves at runtime
**What goes wrong:** If `credential-bridge.ts` imports `@claw/db` at module-level and `DATABASE_URL` is undefined in worker env, `drizzle()` is called with `undefined` which causes a connection error on first query attempt (not at import time). This silently fails.
**How to avoid:** After the credential-bridge fix (using HTTP instead of direct DB), the `@claw/db` import in `credential-bridge.ts` can be removed entirely. The HTTP approach is the correct fix.

## Code Examples

### Fix 1: redirectUri in UI (both pages)
```typescript
// Source: services/ui/src/routes/(app)/tools/belt/+page.svelte
// Source: services/ui/src/routes/(app)/tools/catalog/+page.svelte

function startOAuth(toolId: string) {
  window.location.href =
    '/api/akasa/tool-connections/oauth/' + toolId +
    '/start?userId=' + encodeURIComponent(data.userId) +
    '&redirectUri=' + encodeURIComponent(
      window.location.origin + '/api/akasa/tool-connections/oauth/' + toolId + '/callback'
    );
}
```

### Fix 2: Internal user-by-company endpoint
```typescript
// Source: new file services/akasa-server/src/routes/internal.ts
import { Router } from 'express';
import { companyMemberships } from '@paperclipai/db';
import { eq, and } from 'drizzle-orm';
import { createDb } from '@paperclipai/db';

let _pcDb: ReturnType<typeof createDb> | null = null;
function getPaperclipDb() {
  if (!_pcDb) _pcDb = createDb(process.env['DATABASE_URL']!);
  return _pcDb;
}

export function internalRouter(): Router {
  const router = Router();
  router.get('/user-by-company/:companyId', async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      const pcDb = getPaperclipDb();
      const rows = await pcDb
        .select({ userId: companyMemberships.principalId })
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.principalType, 'user'),
            eq(companyMemberships.status, 'active'),
          )
        )
        .limit(1);
      const userId = rows[0]?.userId;
      if (!userId) {
        res.status(404).json({ error: `No user found for company ${companyId}` });
        return;
      }
      res.json({ userId });
    } catch (err) {
      next(err);
    }
  });
  return router;
}
```

### Fix 3: Plugin path in index.ts
```typescript
// Source: services/akasa-server/src/index.ts
const pluginPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/plugins/akasa-tool-nexus'  // was ../../../../
);
```

### Fix 4: Webhook wakeup endpoint
```typescript
// Source: services/akasa-server/src/routes/webhooks.ts
const wakeupRes = await fetch(
  `http://localhost:${port}/api/agents/${matchedRule.assignToAgentId}/wakeup`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'webhook',
      triggerDetail: `webhook:${toolId}:event_type=${eventType}`,
      payload: parsedPayload,
    }),
  },
);
```

### Fix 2b: credential-bridge using HTTP instead of direct DB
```typescript
// Source: packages/plugins/akasa-tool-nexus/src/services/credential-bridge.ts
import { db, toolConnections } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { getValidToken, ... } from '@claw/akasa-server/services/token-manager';

let _akasaPort = '3100';
export function setAkasaPort(port: string) { _akasaPort = port; }

async function resolveUserId(companyId: string): Promise<string> {
  const resp = await fetch(
    `http://localhost:${_akasaPort}/api/akasa/internal/user-by-company/${companyId}`
  );
  if (!resp.ok) {
    throw new Error(`Failed to resolve userId for company ${companyId}: ${resp.status}`);
  }
  const data = await resp.json() as { userId: string };
  return data.userId;
}

export async function resolveCredential(toolId: string, companyId: string): Promise<ResolvedCredential> {
  const userId = await resolveUserId(companyId);
  const rows = await db
    .select()
    .from(toolConnections)
    .where(and(eq(toolConnections.userId, userId), eq(toolConnections.toolId, toolId)))
    .limit(1);
  // ... rest unchanged
}
```

## Environment Availability

Step 2.6 is relevant because the Paperclip API must be reachable for the wakeup call.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Paperclip Express server (localhost) | Webhook agent dispatch | ✓ (same process) | — | — |
| `@paperclipai/db` companyMemberships | Internal user-by-company endpoint | ✓ (workspace dep) | in workspace | — |
| Plugin dist/worker.js | Plugin install | ✓ (built in Phase 9) | 22KB bundle | Rebuild: `pnpm --filter @claw/plugin-tool-nexus build` |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.1.1 |
| Config file | `services/akasa-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @claw/execution-service exec vitest run` |
| Full suite command | `pnpm --filter @claw/execution-service exec vitest run` |

Note: The CLAUDE.md specifies `pnpm --filter @claw/execution-service exec vitest run`. The akasa-server package does not appear to have its own script. Verify the actual filter name against the akasa-server package.json.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-02 | OAuth redirectUri fix | unit | `vitest run src/__tests__/oauth-flow.test.ts` | ✅ exists |
| TOOL-01 | Plugin path resolves to correct location | unit | New test in `oauth-flow.test.ts` or `plugin-path.test.ts` | ❌ Wave 0 |
| TOOL-05/06 | resolveCredential uses userId (via HTTP) | unit (mock fetch) | New test in `credential-bridge.test.ts` | ❌ Wave 0 |
| TOOL-07 | Webhook dispatch calls `/api/agents/:id/wakeup` | unit (mock fetch) | Extend `webhook-routing.test.ts` | ✅ exists (extend) |
| TOOL-03 | API key test-connection still works | smoke | Manual browser test | N/A |

### Sampling Rate
- Per task commit: `vitest run src/__tests__/webhook-routing.test.ts src/__tests__/oauth-flow.test.ts`
- Per wave merge: full Vitest suite
- Phase gate: All existing tests green before VERIFICATION.md

### Wave 0 Gaps
- [ ] `packages/plugins/akasa-tool-nexus/src/__tests__/credential-bridge.test.ts` — covers TOOL-05/06, mocks internal HTTP endpoint
- [ ] Test for plugin path correctness in `ensureToolNexusPlugin` — covers TOOL-01

*(Existing `webhook-routing.test.ts` and `oauth-flow.test.ts` need extension, not new files)*

## Open Questions

1. **Does @claw/db successfully connect in the plugin worker process?**
   - What we know: `DATABASE_URL` is not in worker env per Paperclip's spawn code; `@claw/db` calls `drizzle(process.env['DATABASE_URL']!, ...)` at module load; node-postgres defers connection until first query
   - What's unclear: Whether dotenv loading from a `.env` file in cwd could supply `DATABASE_URL` even without it being in spawn env (not relevant since no `.env` files exist in prod)
   - Recommendation: The HTTP approach removes this dependency entirely — credential-bridge should NOT rely on `@claw/db` for DB access

2. **Plugin config availability timing**
   - What we know: `ensureToolNexusPlugin` calls install then config POST; the plugin's `setup()` calls `ctx.config.get()`
   - What's unclear: Whether config is available on first call to `setup()` or only after `configChanged` notification
   - Recommendation: Use `'3100'` as a hardcoded default fallback port in `credential-bridge.ts`; only override from plugin config. This handles both cases.

3. **OAuth provider redirect URI registration**
   - What we know: The redirectUri in the fix points to the correct callback handler
   - What's unclear: Whether HubSpot/Slack/Google OAuth apps in the dev environment have this URL registered
   - Recommendation: Document the required redirect URI in `.env.example` and in VERIFICATION.md. Human tester must verify the callback URL matches the registered URI.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `services/ui/src/routes/(app)/tools/belt/+page.svelte` — confirmed redirectUri bug
- Direct code inspection: `services/ui/src/routes/(app)/tools/catalog/+page.svelte` — confirmed redirectUri bug
- Direct code inspection: `services/akasa-server/src/index.ts` — confirmed 4x `../` path
- Direct code inspection: `services/akasa-server/src/routes/webhooks.ts` — confirmed `companies/default` hardcode
- Direct code inspection: `packages/plugins/akasa-tool-nexus/src/connectors/hubspot.ts`, `slack.ts`, `google-sheets.ts` — confirmed `runCtx.companyId` usage
- Direct code inspection: `paperclip/packages/plugins/sdk/src/types.ts` line 177 — confirmed `ToolRunContext.companyId` type
- Direct code inspection: `paperclip/server/src/services/plugin-worker-manager.ts` lines 606-628 — confirmed worker env restrictions
- Direct code inspection: `paperclip/server/src/routes/agents.ts` line 1296 — confirmed `POST /agents/:id/wakeup` endpoint
- Direct code inspection: `paperclip/server/src/app.ts` line 134 — confirmed agents mount at `/api` not `/api/companies`
- Direct code inspection: `paperclip/server/src/routes/authz.ts` — confirmed `local_trusted` bypasses company access check
- Direct code inspection: `paperclip/packages/db/src/schema/company_memberships.ts` — confirmed table structure and exports
- Direct code inspection: `.planning/v6.0-MILESTONE-AUDIT.md` — confirmed all 4 gap descriptions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 9 decision log confirms plugin install approach and local_trusted mode

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all four confirmed by code inspection, not inference
- Fix approach for Bugs 1, 3, 4: HIGH — minimal changes, clear target lines
- Fix approach for Bug 2 (credential-bridge): MEDIUM — HTTP approach is correct but plugin config plumbing (manifest schema + config POST + worker setup) involves 5 files and introduces an ordering dependency; careful implementation required
- Test coverage: MEDIUM — existing tests cover most cases; credential-bridge test is new

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — Express/Paperclip API paths unlikely to change)
