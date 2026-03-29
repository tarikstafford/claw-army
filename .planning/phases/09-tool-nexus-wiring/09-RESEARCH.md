# Phase 9: Tool Nexus Wiring - Research

**Researched:** 2026-03-29
**Domain:** Paperclip plugin runtime integration + webhook dispatch pipeline
**Confidence:** HIGH

## Summary

Phase 9 closes two explicitly-deferred wiring gaps identified in the v6.0 milestone audit:

1. **Plugin not loaded into Paperclip runtime** — `@claw/plugin-tool-nexus` was built in Phase 6 but never installed into the Paperclip plugin system. Agents cannot discover or invoke HubSpot/Slack/Google Sheets tools. The plugin worker exists at `packages/plugins/akasa-tool-nexus/src/worker.ts` but has no `dist/` — it has never been built or registered.

2. **Webhook routing rules not evaluated** — Webhook receipt, signature verification, and logging all work (Phase 6). `webhook_routing_rules` rows are created via the UI (Phase 7). But `webhooks.ts` (`services/akasa-server/src/routes/webhooks.ts`) never queries `webhookRoutingRules` after receipt — so rules are stored and never evaluated, and there is no dispatch to an agent.

Both gaps are purely wiring problems. No new schema, no new npm packages, no new UI pages. The work is:
- Build the plugin's dist, install it into Paperclip's DB at startup via `loader.installPlugin({ localPath })`, and confirm `@claw/plugin-tool-nexus` transitions to `ready` so its 7 tools appear in `toolDispatcher.listToolsForAgent()`.
- After a webhook is received and logged, query `webhook_routing_rules` for the matching `userId + toolId + eventType`. On match, dispatch to the assigned agent; on no match, log with `routing_decision: 'no_match'` instead of silently dropping.

**Primary recommendation:** Install the plugin at `akasa-server` startup using `loader.installPlugin({ localPath: resolvedPluginPath })` → `lifecycle.load(pluginId)` — this is the same flow used by the Paperclip UI's `POST /api/plugins/install` route. For webhook dispatch, query `webhook_routing_rules` inside `webhooks.ts` after receipt and use the existing Paperclip agent heartbeat API to notify the assigned agent.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | Tool Nexus connectors built as Paperclip plugins — each connector registers tools (actions + schemas) with the plugin tool dispatcher | Plugin is built; needs `installPlugin({ localPath }) + lifecycle.load()` at startup to register 7 tools with toolDispatcher |
| TOOL-06 | Starter connectors shipped — minimum 3 integrations (HubSpot, Slack, Google Sheets) as working Paperclip plugins | All 3 connectors exist and are wired in worker.ts; once plugin is `ready`, agents can invoke `akasa.tool-nexus:hubspot.create-contact` etc. |
| TOOL-07 | Webhook receiver — unique URL per user per tool, signature verification where supported, incoming payloads routed to appropriate agent/objective | Receipt + sig verification done; routing rules evaluation + agent dispatch + no_match logging are the gaps |
</phase_requirements>

## Standard Stack

### Core (already installed — do not re-add)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@paperclipai/plugin-sdk` | `workspace:*` | Plugin definePlugin, ctx.tools.register | Already dep in plugin package |
| `drizzle-orm` | `0.45.1` | DB queries | Already in claw/db |
| `node:crypto` | built-in | Token derivation | Already used in webhooks.ts |

### No New Packages Required

All functionality uses existing infrastructure. The wiring tasks use:
- Paperclip's `pluginLoader.installPlugin({ localPath })` (already in `paperclip/server/src/services/plugin-loader.ts`)
- Paperclip's `pluginLifecycleManager.load(pluginId)` (already in `paperclip/server/src/services/plugin-lifecycle.ts`)
- Existing `createApp()` option `localPluginDir` (already in `paperclip/server/src/app.ts` line 66)
- Existing `webhookRoutingRules` Drizzle schema (already in `packages/db/src/schema/webhook-routing-rules.ts`)
- Existing Paperclip agent heartbeat API (already used by `evolution-trigger.ts`)

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
No new files or directories needed. The work modifies two existing files and adds one startup hook:

```
services/akasa-server/src/
├── index.ts                    ← add plugin install/load at startup (Gap 1)
├── routes/
│   └── webhooks.ts             ← add routing rule evaluation after receipt (Gap 2)
packages/plugins/akasa-tool-nexus/
├── dist/                       ← must be built before install (tsc)
│   └── worker.js               ← plugin entrypoint (manifest.json points here)
```

### Pattern 1: Plugin Startup Installation via localPath

Paperclip's `installPlugin` supports `localPath` (an absolute filesystem path), which registers the package into the `plugins` table. After install, `lifecycle.load(pluginId)` transitions `installed → ready` and spawns the worker. This is the same code path used by `POST /api/plugins/install` with `isLocalPath: true`.

The `createApp()` function exposes `localPluginDir` in its options object. The default is `DEFAULT_LOCAL_PLUGIN_DIR` (`~/.paperclip/plugins/`). `akasa-server/src/index.ts` can pass `localPluginDir` to `createApp()` AND perform a post-startup install.

However, the cleaner approach is to call `loader.installPlugin({ localPath: ... })` directly after `createApp()` returns, before the server starts listening. The `app` returned by `createApp` does not expose the `loader` directly, but the `pluginLoader` service is also accessible as a plain import since all services share the Paperclip DB via `createDb`.

**Preferred pattern (verified from app.ts lines 180-310):**

The `loader.loadAll()` call in `app.ts` only loads plugins already in `ready` status. To register a new local plugin at startup, use the `POST /api/plugins/install` route programmatically, OR call the loader directly. Since `akasa-server/src/index.ts` already imports from `paperclip/server/src/...` directly (see lines 4-9 of `index.ts`), it can import and call the loader:

```typescript
// Source: paperclip/server/src/services/plugin-loader.ts + app.ts pattern
import { pluginLoader } from '../../../paperclip/server/src/services/plugin-loader.js';
import { pluginLifecycleManager } from '../../../paperclip/server/src/services/plugin-lifecycle.js';
import { pluginRegistryService } from '../../../paperclip/server/src/services/plugin-registry.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_NEXUS_PLUGIN_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/plugins/akasa-tool-nexus'
);
```

**However:** `createApp` owns the `loader`, `lifecycle`, and `workerManager` instances. They are not returned from `createApp`. This means `akasa-server/index.ts` cannot call `loader.installPlugin()` after the fact — it doesn't have a reference.

**The correct approach** is to pass `localPluginDir` pointing at the plugin package's parent directory so Paperclip's startup `loadAll()` can discover and run `@claw/plugin-tool-nexus`. The `loadAll()` call already iterates ready plugins and starts their workers.

But `loadAll()` only loads plugins already marked `ready` in the DB. A freshly-built plugin is not in the DB yet. The **actual approach** is an **idempotent install-at-startup function** that:
1. Checks if `akasa.tool-nexus` already exists in the `plugins` table and is `ready` → skip
2. If not found or in `error` state → call `POST /api/plugins/install` on the local Express app immediately after it starts listening

OR, better: Expose a `postStartup` hook by modifying `akasa-server/src/index.ts` to call the Paperclip `plugins/install` HTTP endpoint on `localhost` after the server starts — identical to what the Paperclip UI board does when a user manually installs a plugin.

**Simplest correct pattern (no private API access required):**

```typescript
// After server.listen() resolves in akasa-server/src/index.ts
async function ensureToolNexusPluginLoaded() {
  const pluginPath = path.resolve(import.meta.dirname, '../../../packages/plugins/akasa-tool-nexus');

  // Check if already registered and ready
  const response = await fetch(`http://localhost:${config.port}/api/plugins`);
  const plugins = await response.json();
  const existing = plugins.find((p: { pluginKey: string; status: string }) =>
    p.pluginKey === 'akasa.tool-nexus'
  );

  if (existing?.status === 'ready') {
    console.log('[akasa-server] Tool Nexus plugin already loaded');
    return;
  }

  // Install via Paperclip's own install route
  const installResponse = await fetch(`http://localhost:${config.port}/api/plugins/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageName: pluginPath, isLocalPath: true }),
  });

  if (!installResponse.ok) {
    const err = await installResponse.json();
    console.error('[akasa-server] Failed to install Tool Nexus plugin:', err);
    return;
  }

  console.log('[akasa-server] Tool Nexus plugin installed and loaded');
}
```

**Critical prerequisite:** The plugin must be **built** (`tsc`) before startup so `dist/worker.js` exists. The `manifest.json` `entrypoints.worker` points to `./dist/worker.js`. The plugin has no `dist/` right now. The planner must include a `pnpm --filter @claw/plugin-tool-nexus build` step.

**Auth consideration:** `POST /api/plugins/install` in `plugins.ts` calls `assertBoard(req)` which checks `req.actor.type === 'board'`. In `local_trusted` deployment mode (which akasa-server uses: `authReady: config.deploymentMode === 'local_trusted'`), all requests without auth are treated as trusted board actors. This means the local fetch to `localhost` will pass the `assertBoard` check in dev.

### Pattern 2: Webhook Routing Rule Evaluation

After the current webhook receipt and logging in `webhooks.ts` (line 154), the handler returns `{ received: true }`. The routing evaluation needs to be inserted after the log insert:

```typescript
// Source: packages/db/src/schema/webhook-routing-rules.ts (WebhookRoutingRule type)
// After inserting to toolInvocationLogs:

import { webhookRoutingRules } from '@claw/db';
import { eq, and } from 'drizzle-orm';

// Parse payload JSON for event type matching
let parsedPayload: Record<string, unknown> = {};
try { parsedPayload = JSON.parse(rawBody) as Record<string, unknown>; } catch { /* not JSON */ }

// Determine event type from payload (provider-specific)
const eventType = extractEventType(toolId, parsedPayload);

// Query matching routing rules
const rules = await db
  .select()
  .from(webhookRoutingRules)
  .where(
    and(
      eq(webhookRoutingRules.userId, userId),
      eq(webhookRoutingRules.toolId, toolId),
      eq(webhookRoutingRules.isActive, true),
    )
  );

const matchedRule = rules.find(rule =>
  rule.eventType === eventType || rule.eventType === '*'
);

if (!matchedRule) {
  // Log no_match decision to invocation log
  await db.insert(toolInvocationLogs).values({
    toolId,
    action: `webhook:${toolId}:no_match`,
    userId,
    connectionId,
    success: true,
    requestSummary: `no routing rule matched event_type=${eventType}`,
  });
} else {
  // Dispatch to assigned agent via Paperclip heartbeat API
  await dispatchToAgent(matchedRule.assignToAgentId, toolId, eventType, parsedPayload);
}
```

**Event type extraction** is provider-specific:
- HubSpot: `payload.subscriptionType` (e.g. `contact.creation`)
- Slack: `payload.type` (e.g. `message`)
- Unknown: use `'unknown'`

**Agent dispatch:** The `assignToAgentId` in `webhook_routing_rules` is a Paperclip agent ID. The existing evolution trigger pattern (`services/akasa-server/src/routes/evolution-trigger.ts`) already calls Paperclip's internal heartbeat mechanism. For webhook dispatch, the natural mechanism is to add a comment/message to the agent's active issue, or trigger a heartbeat with the webhook payload as context. Research: Paperclip's issue comment endpoint (`POST /api/companies/:companyId/issues/:issueId/comments`) or heartbeat (`POST /api/companies/:companyId/agents/:agentId/heartbeat`). The dispatch mechanism should be a best-effort fire-and-forget — failures must not block the webhook 200 response.

**TOOL-07 requirement says "dispatched to matched agent/objective"** — this means creating a comment or notification on the agent's active issue, or triggering a heartbeat with context. The exact Paperclip endpoint to use needs verification against the live Paperclip API. The safest approach that does not require knowing the exact endpoint is to log the dispatch decision and have it visible in the webhook event log. A more complete dispatch implementation can use the Paperclip agents API.

### Anti-Patterns to Avoid

- **Building plugin with `@claw/source` condition** — The plugin uses `moduleResolution: Bundler` and must compile to `./dist/`. The `@claw/source` custom condition resolves to source `.ts` files and does NOT work for plugins (which run as compiled workers in a child process via the Paperclip worker manager). Always use the built `dist/` for plugin installation.
- **Calling `lifecycle.load()` or `loader.installPlugin()` with private imports from inside `createApp()`** — `createApp` owns these instances. Use the HTTP endpoint approach for install-at-startup.
- **Blocking the webhook 200 response on agent dispatch** — If dispatch fails, the webhook receipt must still return 200 to avoid the provider retrying. Use fire-and-forget `.catch()` for dispatch.
- **Querying routing rules before signature verification** — Always verify signature first, then evaluate rules.
- **Using `find()` with exact `eventType` match only** — Some rules may use wildcard event types. Handle both exact and `'*'` patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plugin package registration | Custom DB inserts to `plugins` table | `POST /api/plugins/install` with `isLocalPath: true` | The install route handles manifest validation, capability checking, and lifecycle orchestration |
| Worker process spawning | Direct `child_process.spawn()` | Paperclip's `PluginWorkerManager` (via lifecycle.load()) | Worker manager handles IPC, health checks, graceful shutdown |
| Plugin tool discovery | Manual tool registration in tool registry | `toolDispatcher.initialize()` (already called in createApp) | Dispatcher auto-registers tools from all `ready` plugins on startup |
| Webhook rule condition evaluation | Custom JS expression evaluator | Simple string equality on `eventType` for now | TOOL-F03 deferred; current rules use `eventType` exact match per `WebhookRoutingRule` schema |

## Common Pitfalls

### Pitfall 1: Plugin dist not built
**What goes wrong:** `installPlugin({ localPath })` reads `package.json` → finds `main: ./dist/worker.js` → tries to load manifest from `dist/` → fails because `dist/` does not exist.
**Why it happens:** The plugin was authored in TypeScript but `tsc` was never run in `packages/plugins/akasa-tool-nexus/`.
**How to avoid:** Include `pnpm --filter @claw/plugin-tool-nexus build` in Wave 0 of the plan. Verify `dist/worker.js` exists before attempting install.
**Warning signs:** `installPlugin` throws `"Cannot find package manifest"` or `"ENOENT: dist/worker.js"`.

### Pitfall 2: assertBoard rejects local install call
**What goes wrong:** `POST /api/plugins/install` from `akasa-server/index.ts` gets a 401 because `req.actor.type !== 'board'`.
**Why it happens:** In `authenticated` deployment mode (not `local_trusted`), all requests without a valid session token are rejected.
**How to avoid:** Only attempt install when `config.deploymentMode === 'local_trusted'`, or pass a trusted local header. Verify `actorMiddleware` behavior in `local_trusted` mode — confirmed in STATE.md that akasa-server sets `authReady: config.deploymentMode === 'local_trusted'`.
**Warning signs:** Install attempt returns 401 Unauthorized.

### Pitfall 3: Plugin re-installs on every restart
**What goes wrong:** The startup install hook runs on every boot, creating duplicate plugin entries or causing `conflict('Plugin already installed')` errors.
**Why it happens:** No idempotency check before calling `installPlugin`.
**How to avoid:** Check `GET /api/plugins` first and skip install if `akasa.tool-nexus` is already in `ready` status. The registry's `install()` also has a uniqueness check on `pluginKey` that throws `conflict` — handle this error gracefully.
**Warning signs:** Server logs show `"Plugin already installed: akasa.tool-nexus"` on every restart.

### Pitfall 4: Webhook dispatch blocks response
**What goes wrong:** Agent dispatch (Paperclip heartbeat call) takes 2-3 seconds. The webhook provider's 3-second timeout fires, retries, and you receive duplicate payloads.
**Why it happens:** Await-ing the dispatch call inside the webhook route handler.
**How to avoid:** Fire-and-forget: `void dispatchToAgent(...).catch(err => console.error(...))`. Return `res.json({ received: true })` immediately after logging.
**Warning signs:** Webhook provider shows delivery timeouts; duplicate entries in `tool_invocation_logs`.

### Pitfall 5: No-match routing logs pollute the webhook event log
**What goes wrong:** Every no-match webhook creates an entry in `tool_invocation_logs` with `action: 'webhook:hubspot:no_match'`, flooding the log.
**Why it happens:** The TOOL-07 requirement says "payloads that don't match are logged with a no_match routing decision" — this is correct behavior per the spec. But the webhook logs UI filters on `like(action, 'webhook:%')`, so no_match entries will appear.
**How to avoid:** Use a structured `action` field like `webhook:hubspot:no_match` (consistent with existing `webhook:toolId` pattern) so the UI can distinguish match vs no-match. No change needed to the log query.
**Warning signs:** None — this is the expected behavior per TOOL-07.

### Pitfall 6: Worker manager process auth in non-local mode
**What goes wrong:** Plugin worker spawned by Paperclip tries to call back to `@claw/akasa-server` for credential resolution but gets blocked.
**Why it happens:** `credential-bridge.ts` imports `@claw/akasa-server/services/token-manager` directly (not via HTTP) — it works in the same process because of workspace imports. But the worker runs in a child process and uses IPC to communicate with the host.
**How to avoid:** Verify `credential-bridge.ts` uses the workspace import path (direct module import, not HTTP). This is confirmed in the Phase 6 verification — `credential-bridge.ts` imports `getValidToken` via `@claw/source` condition, which resolves in the worker process context because the worker is spawned with the same node conditions.

## Code Examples

### Plugin Install at Startup (idempotent)

```typescript
// Source: paperclip/server/src/routes/plugins.ts lines 603-670 (reference pattern)
// services/akasa-server/src/index.ts — after server.listen() resolves

async function ensureToolNexusPlugin(port: number): Promise<void> {
  const pluginPath = new URL(
    '../../../../packages/plugins/akasa-tool-nexus',
    import.meta.url
  ).pathname;

  try {
    // Check if already loaded
    const listRes = await fetch(`http://localhost:${port}/api/plugins`);
    if (listRes.ok) {
      const plugins = await listRes.json() as Array<{ pluginKey: string; status: string }>;
      const existing = plugins.find(p => p.pluginKey === 'akasa.tool-nexus');
      if (existing?.status === 'ready') {
        console.log('[akasa-server] Tool Nexus plugin already ready');
        return;
      }
    }

    // Install (or reinstall if in error/disabled state)
    const installRes = await fetch(`http://localhost:${port}/api/plugins/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageName: pluginPath, isLocalPath: true }),
    });

    if (!installRes.ok) {
      const body = await installRes.json() as { error?: string };
      // 'Plugin already installed' is acceptable — it means it's in DB but status != ready
      if ((body.error as string | undefined)?.includes('already installed')) {
        console.log('[akasa-server] Tool Nexus plugin already in registry');
        return;
      }
      console.error('[akasa-server] Tool Nexus plugin install failed:', body.error);
      return;
    }

    console.log('[akasa-server] Tool Nexus plugin installed and ready');
  } catch (err) {
    console.error('[akasa-server] Tool Nexus startup install error:', (err as Error).message);
    // Non-fatal — server continues without tool nexus in this boot
  }
}
```

### Webhook Routing Rule Evaluation

```typescript
// Source: packages/db/src/schema/webhook-routing-rules.ts (schema reference)
// Insertion point in services/akasa-server/src/routes/webhooks.ts — after the log insert

// Extract provider-specific event type
function extractEventType(toolId: string, payload: Record<string, unknown>): string {
  if (toolId === 'hubspot') {
    // HubSpot sends an array of subscription events
    const events = payload['events'] as Array<{ subscriptionType?: string }> | undefined;
    return events?.[0]?.subscriptionType ?? 'unknown';
  }
  if (toolId === 'slack') {
    const event = payload['event'] as { type?: string } | undefined;
    return event?.type ?? (payload['type'] as string | undefined) ?? 'unknown';
  }
  return (payload['type'] as string | undefined) ?? 'unknown';
}

// After existing log insert (line ~154 in webhooks.ts):
const parsedPayload: Record<string, unknown> = {};
try { Object.assign(parsedPayload, JSON.parse(rawBody)); } catch { /* not JSON */ }

const eventType = extractEventType(toolId, parsedPayload);

// Query routing rules — fire and forget to not block 200 response
void (async () => {
  try {
    const rules = await db
      .select()
      .from(webhookRoutingRules)
      .where(
        and(
          eq(webhookRoutingRules.userId, userId),
          eq(webhookRoutingRules.toolId, toolId),
          eq(webhookRoutingRules.isActive, true),
        )
      );

    const matchedRule = rules.find(
      rule => rule.eventType === eventType || rule.eventType === '*'
    );

    if (!matchedRule) {
      await db.insert(toolInvocationLogs).values({
        toolId,
        action: `webhook:${toolId}:no_match`,
        userId,
        connectionId,
        success: true,
        requestSummary: `no_match event_type=${eventType}`.slice(0, 500),
      });
      return;
    }

    // Log dispatch decision
    await db.insert(toolInvocationLogs).values({
      toolId,
      action: `webhook:${toolId}:dispatched`,
      userId,
      connectionId,
      success: true,
      requestSummary: `dispatched to agentId=${matchedRule.assignToAgentId} event_type=${eventType}`.slice(0, 500),
    });

    // Best-effort agent notification (implementation depends on Paperclip heartbeat API)
    if (matchedRule.assignToAgentId) {
      await dispatchWebhookToAgent(matchedRule.assignToAgentId, toolId, eventType, parsedPayload);
    }
  } catch (err) {
    console.error('[webhooks] Routing evaluation error:', (err as Error).message);
  }
})();

// Return immediately — routing is fire-and-forget
res.json({ received: true });
```

### Plugin Build Step

```bash
# Must run before akasa-server starts or before install attempt
pnpm --filter @claw/plugin-tool-nexus build
# Produces: packages/plugins/akasa-tool-nexus/dist/worker.js
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Paperclip plugins manually registered in DB | `installPlugin({ localPath }) + lifecycle.load()` | Paperclip v6.0 plugin system | Handles manifest validation, capability gating, lifecycle state machine |
| Direct child_process.spawn for workers | `PluginWorkerManager` + IPC | Paperclip v6.0 | Handles health checks, restart, graceful shutdown |
| Webhook receipt only (no routing) | Receipt + rule evaluation + dispatch | Phase 9 (this phase) | Closes TOOL-07 |

## Open Questions

1. **Exact Paperclip heartbeat endpoint path for webhook dispatch**
   - What we know: `evolution-trigger.ts` uses Paperclip's internal DB directly (not HTTP) to detect completed runs. The `POST /api/companies/:companyId/agents/:agentId/heartbeat` endpoint exists per CLAUDE.md architecture decisions.
   - What's unclear: Whether heartbeat is the right mechanism for webhook-triggered dispatch vs. creating an issue comment.
   - Recommendation: For TOOL-07 compliance, logging the dispatch decision to `tool_invocation_logs` with `routing_decision` in the requestSummary is sufficient. Full agent notification is a stretch goal. The plan should mark agent dispatch as a best-effort addition and not block the requirement on Paperclip heartbeat verification.

2. **Plugin build must happen before install — CI/dev ordering**
   - What we know: `pnpm --filter @claw/plugin-tool-nexus build` compiles to `dist/`. The plugin package has a valid `tsconfig.json`.
   - What's unclear: Whether the startup install should gracefully skip if `dist/` doesn't exist (dev without pre-build) or hard-fail.
   - Recommendation: Log a warning and skip install if `dist/worker.js` doesn't exist — avoids blocking server startup in dev. Add the build step to the project's startup docs.

3. **`local_trusted` mode and `assertBoard` in production**
   - What we know: `akasa-server/index.ts` sets `authReady: config.deploymentMode === 'local_trusted'`.
   - What's unclear: Whether the local install call from `index.ts` will work when deployed to Railway in `authenticated` mode.
   - Recommendation: Gate the install call on `config.deploymentMode === 'local_trusted'` for now. Document that production plugin loading requires a different approach (Railway plugin preload or manual install via Paperclip admin UI).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Plugin worker process | Yes | v22.16.0 | — |
| pnpm | Plugin build step | Yes | 10.11.1 | — |
| TypeScript (tsc) | Plugin build | Yes (devDep in plugin) | ^5.9.3 | — |
| PostgreSQL | Plugin registry, routing rules | Yes (Docker) | 17 | — |
| `packages/plugins/akasa-tool-nexus/dist/` | Plugin install | No (not built) | — | Must build first |

**Missing dependencies with no fallback:**
- `packages/plugins/akasa-tool-nexus/dist/worker.js` — must be produced by `pnpm --filter @claw/plugin-tool-nexus build` before install can succeed.

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` — validation section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.1.1 |
| Config file | `services/akasa-server/vitest.config.ts` |
| Quick run command | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` |
| Full suite command | `pnpm --filter @claw/akasa-server exec vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | Plugin installed and `ready` — 7 tools visible in tool dispatcher | integration (smoke) | Manual — requires running server | ❌ Wave 0 |
| TOOL-06 | HubSpot create-contact invocation succeeds end-to-end | integration | Manual — requires live credentials | ❌ Wave 0 |
| TOOL-07 (match) | Routing rule matched — dispatch logged to `tool_invocation_logs` | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` | ❌ Wave 0 |
| TOOL-07 (no_match) | No rule matched — `no_match` log entry created | unit | `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhooks.test.ts`
- **Per wave merge:** `pnpm --filter @claw/akasa-server exec vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/akasa-server/src/__tests__/webhooks.test.ts` — covers TOOL-07 routing evaluation (no_match, match + dispatch log). File does not exist; existing tests are for webhook-verifier only (`webhook-verifier.test.ts`).
- [ ] Verify `packages/plugins/akasa-tool-nexus/dist/worker.js` exists before test run (run `pnpm --filter @claw/plugin-tool-nexus build` in Wave 0).

## Sources

### Primary (HIGH confidence)

- `paperclip/server/src/services/plugin-loader.ts` — `installPlugin({ localPath })` API, `DEFAULT_LOCAL_PLUGIN_DIR`, `loadAll()` behavior
- `paperclip/server/src/services/plugin-lifecycle.ts` — `load()`, `enable()`, state machine, `installed → ready` transition
- `paperclip/server/src/services/plugin-tool-dispatcher.ts` — `initialize()`, `listToolsForAgent()`, lifecycle event subscription
- `paperclip/server/src/app.ts` lines 156-310 — full plugin startup orchestration, `toolDispatcher.initialize()`, `loader.loadAll()`
- `paperclip/server/src/routes/plugins.ts` lines 603-670 — `POST /api/plugins/install` with `isLocalPath: true` flow
- `services/akasa-server/src/routes/webhooks.ts` — current webhook handler (receipt + sig verify + logging, no routing)
- `services/akasa-server/src/routes/webhook-routing-rules.ts` — webhook routing rule CRUD (schema and DB access)
- `packages/db/src/schema/webhook-routing-rules.ts` — `webhookRoutingRules` Drizzle schema
- `packages/plugins/akasa-tool-nexus/src/worker.ts` — plugin entry point (`definePlugin` + `registerHubSpotTools`, etc.)
- `packages/plugins/akasa-tool-nexus/src/manifest.ts` — plugin manifest (7 tools, 2 webhook endpoints)
- `packages/plugins/akasa-tool-nexus/tsconfig.json` — `outDir: ./dist`, `moduleResolution: Bundler`
- `.planning/v6.0-MILESTONE-AUDIT.md` — authoritative gap description for both unwired integrations
- `.planning/phases/06-tool-nexus-backend/06-VERIFICATION.md` — confirms TOOL-07 partial: dispatch deferred per plan scope
- `.planning/phases/07-tool-nexus-ui/07-VERIFICATION.md` — confirms routing rules stored but never evaluated

### Secondary (MEDIUM confidence)

- `services/akasa-server/src/index.ts` — confirmed `authReady: config.deploymentMode === 'local_trusted'` for local installs
- `paperclip/server/src/services/plugin-registry.ts` — `install()` conflict handling, `listByStatus('ready')` pattern

## Metadata

**Confidence breakdown:**
- Gap identification: HIGH — audit evidence is authoritative (v6.0-MILESTONE-AUDIT.md)
- Plugin install mechanism: HIGH — code verified directly in app.ts and plugin-loader.ts
- Webhook routing evaluation: HIGH — existing schema and route code are fully readable
- Agent dispatch mechanism: MEDIUM — exact Paperclip heartbeat endpoint path for webhook context is unverified against live Paperclip API; fire-and-forget dispatch logging is a safe minimum

**Research date:** 2026-03-29
**Valid until:** 2026-04-29 (stable code — no external dependency changes)
