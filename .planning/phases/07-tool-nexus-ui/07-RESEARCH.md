# Phase 7: Tool Nexus UI — Research

**Researched:** 2026-03-25
**Domain:** SvelteKit UI — Tool catalog, Tool Belt, webhook routing rules, webhook event log
**Confidence:** HIGH

---

## Summary

Phase 7 builds the user-facing interface for the Tool Nexus backend completed in Phase 6. Four requirements cover: a browsable tool catalog (TOOL-04), a "Tool Belt" showing connected tools with live status (TOOL-05), a webhook routing rules builder (TOOL-08), and a webhook event log (TOOL-09).

The backend is already complete: `GET/POST/DELETE /akasa/tool-connections`, OAuth redirect/callback at `/akasa/tool-connections/oauth/:toolId/start` and `/callback`, webhook URL generation at `POST /akasa/webhooks/generate-url`, and invocation logs at `GET /akasa/tool-connections/:id/logs`. All four UI surfaces are pure data-display + form pages — no new backend routes are needed except a missing webhook routing rules CRUD endpoint (TOOL-08 requires "when [event] matches [condition] → assign to [agent]" to persist somewhere).

The critical gap is that no `webhook_routing_rules` DB table or route exists. The planner must include a DB migration + Express route for routing rules as part of this phase, or TOOL-08 cannot be implemented. Everything else calls existing endpoints.

**Primary recommendation:** Build four SvelteKit pages under `/tools` with server-side load functions calling existing `/akasa/*` Express routes through the SvelteKit `/api/[...path]` proxy. Add a `webhook_routing_rules` table + route as the only new backend work.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-04 | Tool catalog UI — browsable by category, shows connection status per tool | Static tool registry client-side + `GET /akasa/tool-connections?userId=...` for live status |
| TOOL-05 | Tool Belt view — connected tools with status badges, last used, re-auth on expired | `GET /akasa/tool-connections?userId=...` returns status, lastUsedAt, connectionType |
| TOOL-08 | Webhook routing rules — "when [event] matches [condition] → assign to [agent]" | Needs new `webhook_routing_rules` table + CRUD route; agent list from `GET /api/companies/:id/agents` |
| TOOL-09 | Webhook event log — all received webhooks with payload, routing decision, resulting action | `GET /akasa/tool-connections/:id/logs` returns tool_invocation_logs rows with requestSummary |
</phase_requirements>

---

## Standard Stack

No new libraries needed. All UI is built on the existing validated stack.

### Core (No New Dependencies)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| UI Framework | SvelteKit v2 + Svelte 5 runes | ^2.52.0 | Pages, routing, load functions |
| Styling | Pure CSS custom properties | — | `--fo-*`, `--bo-*`, `--border`, `--card` tokens from `app.css` |
| Data fetching | SvelteKit `load` (server-side) | — | `+page.server.ts` with `fetch` from `parent()` session |
| API | Existing `/api/[...path]` SvelteKit proxy | — | Forwards to Express at port 3100 |
| Components | Existing design system components | — | `Modal.svelte`, `SlidePanel.svelte`, `MechanicCard.svelte` |

**Installation:** None required.

---

## Architecture Patterns

### Route Structure

```
services/ui/src/routes/(app)/
└── tools/
    ├── +layout.svelte          # Tab bar: CATALOG | MY TOOLS | WEBHOOKS
    ├── +page.server.ts         # Redirect to /tools/catalog
    ├── catalog/
    │   ├── +page.server.ts     # load: GET /akasa/tool-connections?userId
    │   └── +page.svelte        # Tool grid by category, connect buttons
    ├── belt/
    │   ├── +page.server.ts     # load: GET /akasa/tool-connections?userId
    │   └── +page.svelte        # Connected tools list with status badges
    ├── webhooks/
    │   ├── +page.server.ts     # load: routing rules + agents list
    │   └── +page.svelte        # Rule builder + event log tabs
    └── callback/
        └── +page.svelte        # OAuth callback landing (client-only, reads ?connected= or ?error=)
```

The `/tools/callback` route handles OAuth return. The OAuth callback in `oauth-flow.ts` redirects to `AKASA_BASE_URL/tools?connected=:toolId` — the existing route in `oauth-flow.ts` uses `${baseUrl}/tools?connected=${resolvedToolId}` meaning the SvelteKit callback page lives at `/tools` (the root), not `/tools/callback`. The planner should match the redirect target exactly.

### Pattern 1: Server-Side Load with userId from Session

All tool pages need the logged-in user's ID to scope API calls. The `(app)` layout server already provides `session` and `companyId` via `parent()`. Session object contains the user ID.

```typescript
// +page.server.ts pattern (verified from sanctum/+page.server.ts)
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, parent }) => {
  const { session, companyId } = await parent();
  if (!session) throw error(401, 'Not authenticated');

  const userId = session.user?.id;
  if (!userId) throw error(401, 'No user ID in session');

  const [connectionsRes] = await Promise.allSettled([
    fetch(`/api/akasa/tool-connections?userId=${encodeURIComponent(userId)}`),
  ]);

  const connections = connectionsRes.status === 'fulfilled' && connectionsRes.value.ok
    ? await connectionsRes.value.json()
    : [];

  return { connections, userId, companyId };
};
```

Note: The session object shape comes from BetterAuth / Paperclip. Based on Phase 4 patterns, `session.user.id` is the path. Verify against `event.locals.session` in `hooks.server.ts`.

### Pattern 2: Tool Catalog — Static Registry + Live Status Overlay

The tool catalog shows all integrations (including unconnected ones). The available tools are NOT stored in DB — they are the three hardcoded connectors from Phase 6: `hubspot`, `slack`, `google-sheets`. Define a static catalog client-side and merge with live connection status from the API.

```typescript
// Static tool catalog definition (in +page.svelte or lib/tools.ts)
export const TOOL_CATALOG = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM',
    description: 'CRM contacts, deals, companies',
    authType: 'oauth' as const,
    logo: '🟠', // Replace with SVG/icon
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Communication',
    description: 'Send messages to channels',
    authType: 'oauth' as const,
    logo: '🟣',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'Data',
    description: 'Read and write spreadsheet data',
    authType: 'oauth' as const,
    logo: '🟢',
  },
] as const;

export type ToolCatalogEntry = typeof TOOL_CATALOG[number];

// Merge with live connection status
const connectedMap = new Map(connections.map(c => [c.toolId, c]));
const catalogWithStatus = TOOL_CATALOG.map(tool => ({
  ...tool,
  connection: connectedMap.get(tool.id) ?? null,
}));
```

### Pattern 3: OAuth Connect Button

The OAuth flow starts by redirecting the browser to the backend start route. Since this is a redirect (not a fetch), it's a simple anchor or `window.location.href` assignment.

```typescript
// In +page.svelte (catalog page) — initiates OAuth
function startOAuth(toolId: string) {
  const userId = data.userId;
  const redirectUri = `${window.location.origin}/tools`; // matches oauth-flow.ts default
  const url = `/api/akasa/tool-connections/oauth/${toolId}/start?userId=${encodeURIComponent(userId)}&redirectUri=${encodeURIComponent(redirectUri)}`;
  window.location.href = url;
}
```

The callback returns to `/tools?connected=:toolId` or `/tools?error=oauth_failed&tool=:toolId`. The tools root page or layout should read these query params and show a toast/notification.

### Pattern 4: Connection Status Badge

Tool connections have a `status` field: `'connected' | 'expired' | 'rate_limited' | 'errored' | 'disconnected'`. Map to badge colors using existing design system tokens.

```typescript
// Status badge color mapping
function getStatusColor(status: string): string {
  switch (status) {
    case 'connected':    return 'var(--bo-teal)';      // teal = execution/active
    case 'expired':      return 'var(--bo-amber)';     // amber = needs attention
    case 'rate_limited': return 'var(--bo-amber)';
    case 'errored':      return 'var(--error)';
    case 'disconnected': return 'var(--text-muted)';
    default:             return 'var(--text-muted)';
  }
}
```

Rose (`--bo-rose`) is the design-guide color for Tool Nexus. Use it for section headers and tool category accents. Per design guide §3.1: "Rose — contractors, Tool Nexus, temporary."

### Pattern 5: Webhook Routing Rules (New Backend Required)

TOOL-08 requires persisting routing rules. No table or route exists. The planner must include:

1. A `webhook_routing_rules` DB table migration
2. An Express route `GET/POST/DELETE /akasa/webhook-routing-rules`
3. The SvelteKit form to create rules

**Proposed table schema:**

```typescript
// packages/db/src/schema/webhook-routing-rules.ts
export const webhookRoutingRules = pgTable('webhook_routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  connectionId: uuid('connection_id').notNull(), // logical FK to tool_connections
  toolId: text('tool_id').notNull(),
  eventType: text('event_type').notNull(),        // e.g. 'deal.created'
  condition: text('condition'),                   // optional JSON or text condition
  assignToAgentId: text('assign_to_agent_id'),   // logical FK to agents
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('webhook_routing_rules_user_id_idx').on(t.userId),
  index('webhook_routing_rules_connection_id_idx').on(t.connectionId),
]);
```

### Pattern 6: Webhook Event Log

The event log pulls from `tool_invocation_logs` filtered to webhook entries. Webhook receipts are stored with `action: 'webhook:{toolId}'` per `webhooks.ts`. The existing `GET /akasa/tool-connections/:id/logs` endpoint returns all logs for a connection — the UI can filter by action prefix.

```typescript
// Filter webhook logs from invocation logs
const webhookLogs = logs.filter(log => log.action.startsWith('webhook:'));
```

For a global webhook log (not per-connection), a new endpoint `GET /akasa/webhooks/logs?userId=...` would be cleaner — the planner should decide whether to add it or aggregate per-connection.

### Pattern 7: NavBar Tab Addition

The NavBar currently has four tabs: INDRA, OFFICE, CHAT, SANCTUM. Tool Nexus needs a tab. The `tabs` array in `NavBar.svelte` must be extended:

```typescript
// Add to NavBar.svelte tabs array
{ href: '/tools', label: 'TOOLS', key: 'tools' },
```

The `activeTab` prop type union also needs `'tools'` added. The planner must verify whether to add TOOLS as a 5th nav tab or surface it within an existing section (OFFICE is the most natural parent, but `/tools` as its own top-level is cleaner given the feature scope).

### Anti-Patterns to Avoid

- **Fetching tool list from backend:** The tool catalog is static (3 connectors). Don't create a `/api/tools/catalog` endpoint — define the catalog in the UI and overlay live connection status.
- **Client-side credential handling:** The connect flow is a server redirect, not a client-side API call. Never pass OAuth codes or tokens through the SvelteKit client.
- **Direct backend calls from browser:** All calls go through `/api/[...path]` proxy to Express at port 3100, never direct to `http://localhost:3100`.
- **Inline form actions for OAuth:** Use `window.location.href = url` (redirect) not `fetch()` for the OAuth start — providers don't support CORS for browser-initiated token exchanges.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status badge styling | Custom CSS per status | Design token mapping function | 5 status values, consistent with existing token usage |
| OAuth flow | Client-side OAuth library | Existing `oauth-flow.ts` backend | All token handling is server-side by design |
| Clipboard copy (webhook URL) | Custom selection + execCommand | `navigator.clipboard.writeText()` | Modern browsers, no library needed |
| Date formatting | date-fns / dayjs | `Intl.DateTimeFormat` (built-in) | Already used in other pages (`toLocaleDateString`) |
| Agent list fetch | Custom endpoint | Existing Paperclip `GET /api/companies/:id/agents` | Returns agent name + id for the routing rule dropdown |

---

## Runtime State Inventory

Step 2.5 SKIPPED — this is a greenfield UI phase, not a rename/refactor/migration.

---

## Environment Availability

Step 2.6 — no new external dependencies. All dependencies are the existing running stack:

| Dependency | Available | Notes |
|------------|-----------|-------|
| Express backend (port 3100) | Must be running | Existing Phase 6 routes |
| SvelteKit proxy (`/api/[...path]`) | Existing | Passes through to port 3100 |
| PostgreSQL (tool_connections, tool_invocation_logs) | Existing | Phase 6 migrations applied |

Missing: `webhook_routing_rules` table does not yet exist. The planner must add a migration task.

---

## Common Pitfalls

### Pitfall 1: userId vs companyId Confusion

**What goes wrong:** Tool connections are scoped by `userId` (not `companyId`). The `tool_connections` table has a `userId` column. The `(app)` layout provides `companyId` but you need `userId` from session.

**Why it happens:** Most Paperclip-facing API calls use `companyId`. Tool Nexus was built on Akasa's own user ID scoping.

**How to avoid:** Always use `session.user.id` (or the BetterAuth session user ID field) for tool connection queries. Verify the exact field path from `locals.session` in `hooks.server.ts`.

**Warning signs:** Empty tool belt even when connections exist; 400 errors from `/akasa/tool-connections?userId=`.

### Pitfall 2: OAuth Callback URL Mismatch

**What goes wrong:** `oauth-flow.ts` redirects to `${baseUrl}/tools?connected=...` after success. If the SvelteKit route for `/tools` doesn't exist or doesn't read the query param, the user sees a blank page with no feedback.

**Why it happens:** The callback URL is hardcoded in the backend; the frontend must have a matching route.

**How to avoid:** Create `/tools/+page.server.ts` (or `+page.svelte`) that reads `url.searchParams.get('connected')` and shows a success toast. Make the root `/tools` redirect to `/tools/catalog` but process the OAuth query params first.

**Warning signs:** User completes OAuth on provider side, returns to blank or error page.

### Pitfall 3: Re-auth Flow for Expired Tokens

**What goes wrong:** The TOOL-05 success criterion requires a "re-auth button" for expired connections. The re-auth needs to start a fresh OAuth flow — which is the same as the initial connect flow. Don't build separate re-auth logic.

**Why it happens:** Treating re-auth as a special case adds complexity.

**How to avoid:** The "re-auth" button is identical to the "connect" button — both call `startOAuth(toolId)`. The backend's OAuth callback does an upsert (update existing connection). Wire them to the same function.

### Pitfall 4: Webhook Routing Rules — No Backend Route Exists

**What goes wrong:** TOOL-08 requires saving routing rules. If the planner skips the backend route creation, the UI has no endpoint to POST to.

**Why it happens:** Assuming all backend work was done in Phase 6.

**How to avoid:** Plan must include: (1) `webhook_routing_rules` DB migration, (2) `webhookRoutingRulesRouter()` Express route, (3) export from `akasaRouter` in `routes/index.ts`.

### Pitfall 5: Tool Nexus Uses Back Office World

**What goes wrong:** Building the Tool Nexus UI in Front Office (light) world when the design guide says "Director's Cut — integrations" uses the Back Office.

**Why it happens:** The default is Front Office; easy to forget the override.

**How to avoid:** The design guide §2 states Director's Cut is "Used for: ... integrations." Tool Nexus pages should default to Back Office (`body.back-office`) or at minimum support it without breaking. Use `--bo-rose` for Tool Nexus accent color. Per design guide color table: "Rose — contractors, Tool Nexus."

### Pitfall 6: Webhook Log Needs aggregation across Connections

**What goes wrong:** TOOL-09 requires showing "all received webhooks" but `GET /akasa/tool-connections/:id/logs` is scoped per connection. To show a combined log, the UI must either fetch all connections then all their logs (N+1), or a new endpoint is needed.

**Why it happens:** Phase 6 only added per-connection logs, not a global webhook log view.

**How to avoid:** For the initial implementation, render per-connection tabs in the webhook log view (one tab per connected tool that has webhook support). Alternatively, plan a `GET /akasa/webhooks/logs?userId=...` endpoint that queries `tool_invocation_logs` with `action LIKE 'webhook:%'` filtered by `userId`.

---

## Code Examples

### Verified: Existing API Route Paths (from akasa-server/src/routes/index.ts)

```
GET  /akasa/tool-connections?userId=:userId          — list connections (no auth on endpoint)
POST /akasa/tool-connections                          — create connection
DELETE /akasa/tool-connections/:id                    — remove connection
PATCH /akasa/tool-connections/:id/refresh            — refresh OAuth tokens
POST /akasa/tool-connections/:id/test                — test connection
GET  /akasa/tool-connections/:id/logs                — get invocation logs
GET  /akasa/tool-connections/oauth/:toolId/start     — start OAuth (redirect)
GET  /akasa/tool-connections/oauth/:toolId/callback  — OAuth callback (redirect)
POST /akasa/webhooks/generate-url                     — generate webhook URL for connection
POST /akasa/webhooks/:toolId/:token                  — receive webhook (from provider)
```

These mount on Paperclip's Express server. In SvelteKit, they're accessed via `/api/akasa/...` (through the `[...path]` proxy).

### Verified: Connection Status Type (from tool-connections.ts schema)

```typescript
type ConnectionStatus = 'connected' | 'expired' | 'rate_limited' | 'errored' | 'disconnected';
```

### Verified: Safe Connection Response Fields (from stripEncryptedFields in tool-connections.ts)

The API response omits all encrypted fields. Safe fields returned:
- `id`, `userId`, `toolId`, `connectionType`, `status`, `displayLabel`
- `keyVersion`, `tokenExpiresAt`, `scopes`, `rateLimitResetAt`
- `lastUsedAt`, `createdAt`, `updatedAt`

### Verified: Existing Load Pattern (from sanctum/+page.server.ts)

```typescript
// Promise.allSettled is the established pattern for parallel data fetching
const [connectionsRes, agentsRes] = await Promise.allSettled([
  fetch(`/api/akasa/tool-connections?userId=${userId}`),
  fetch(`/api/companies/${companyId}/agents`),
]);
const connections = connectionsRes.status === 'fulfilled' && connectionsRes.value.ok
  ? await connectionsRes.value.json() as ToolConnectionSafe[]
  : [];
```

### Verified: CSS Token Usage for Tool Nexus (from app.css + design guide)

```css
/* Tool Nexus accent — rose per design guide §3.1 */
.tool-nexus-accent { color: var(--bo-rose, #F472B6); }

/* Status badge tokens */
.status-connected    { color: var(--bo-teal, #2DD4BF); }
.status-expired      { color: var(--bo-amber, #FBBF24); }
.status-errored      { color: var(--error, #f87171); }
.status-disconnected { color: var(--text-muted); }
.status-rate_limited { color: var(--bo-amber, #FBBF24); }
```

### Verified: OAuth Providers Available (from oauth-providers.ts)

Only three tools support OAuth: `hubspot`, `slack`, `google-sheets`.
These are the only tools with a `getOAuthProvider()` registration.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tool Nexus as separate Fastify service | Mounted on Paperclip's Express via `akasaRouter` | Phase 6 (v6.0) | All routes under `/akasa/` prefix |
| BetterAuth session via `auth()` | `event.locals.session` via GET /api/auth/get-session | Phase 4 (v6.0) | `session.user.id` for userId scoping |

---

## Open Questions

1. **Session userId field path**
   - What we know: `locals.session` is populated via BetterAuth in `hooks.server.ts`. Phase 4 decision: "Cookie forwarding replaces Bearer token."
   - What's unclear: Exact field path for the user's ID — is it `session.user.id`, `session.userId`, or `session.user?.email`?
   - Recommendation: Read `services/ui/src/hooks.server.ts` and `services/akasa-server/src/routes/tool-connections.ts` at plan time to confirm the user ID field. If email is used as the userId, the tool-connections query must use email not UUID.

2. **NavBar — 5th tab or sub-nav of OFFICE?**
   - What we know: NavBar has 4 tabs (INDRA, OFFICE, CHAT, SANCTUM). Tool Nexus is a peer feature.
   - What's unclear: Whether to add a 5th top-level tab or nest under `/office/tools`.
   - Recommendation: Add `/tools` as a 5th top-level nav tab labeled "TOOLS". This matches the product naming convention and keeps the route clean. The NavBar `tabs` array and `activeTab` type union need updating.

3. **Webhook log aggregation endpoint**
   - What we know: Per-connection logs exist at `GET /akasa/tool-connections/:id/logs`. No global webhook log endpoint.
   - What's unclear: Whether TOOL-09 intends a global log or per-connection log.
   - Recommendation: Implement a `GET /akasa/webhooks/logs?userId=...` endpoint that queries `tool_invocation_logs WHERE userId = ? AND action LIKE 'webhook:%' ORDER BY createdAt DESC LIMIT 100`. Include this as the first task in the webhook plan.

4. **Webhook routing rules event type vocabulary**
   - What we know: The routing rule needs `eventType` (e.g., `deal.created`). This is provider-specific.
   - What's unclear: Where the canonical list of event types per tool is defined.
   - Recommendation: Hard-code a small static event type map per tool (e.g., HubSpot: deal.created, contact.created; Slack: message). Users can also free-type. Don't build a dynamic event type discovery system for v6.0.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from config.json — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `services/akasa-server/vitest.config.ts` (no UI-specific config found) |
| Quick run command | `pnpm --filter @claw/execution-service exec vitest run` (backend tests) |
| Full suite command | `pnpm --filter @claw/execution-service exec vitest run` |

Note: Phase 7 is a pure UI phase. SvelteKit pages are primarily validated manually (browser-based). No automated test setup for the UI package was detected. Backend tests cover the existing tool-connections routes from Phase 6.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-04 | Tool catalog loads with correct status overlay | manual | — | N/A |
| TOOL-05 | Tool belt shows connected tools with status badges | manual | — | N/A |
| TOOL-08 | Routing rule POST persists to DB and returns 201 | manual API test | `curl -X POST /akasa/webhook-routing-rules` | N/A |
| TOOL-09 | Webhook event log renders log entries | manual | — | N/A |

### Wave 0 Gaps

The UI package has no detected test infrastructure for Svelte components. For this phase, acceptance criteria are validated manually via browser. The backend `webhook_routing_rules` route can be verified with a Vitest integration test if desired — but this is new backend code added within Phase 7.

---

## Project Constraints (from CLAUDE.md)

- **ESM everywhere:** `"type": "module"` in all package.json files
- **Strict mode:** `strict: true`, `noUncheckedIndexedAccess: true` — array access returns `T | undefined`, always null-check
- **Named exports only:** never `export default` in `.ts` files
- **Svelte 5 runes:** `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}`
- **No Tailwind, no CSS modules, no component library:** Pure CSS with custom properties and scoped `<style>` blocks
- **Two worlds:** Front Office default; Back Office via `body.back-office`. Tool Nexus = Back Office world per design guide
- **File naming:** `kebab-case.ts` for TS, `PascalCase.svelte` for Svelte components
- **No custom error classes:** plain `Error` with descriptive messages
- **`import type`** for type-only imports
- **No `.then()` chains:** `async/await` everywhere
- **`Promise.allSettled`** for parallel fetches where individual failures shouldn't break the page
- **`node:` prefix** for Node.js builtins (only relevant if new backend code is added)
- **Logical FKs:** The `webhook_routing_rules.connectionId` should NOT use `references()` if it would cause circular TypeScript inference — use logical FK with a plain `uuid()` column
- **Press Start 2P:** 6-8px max for labels/tags only; exceptions require explicit design guide citation
- **Design system colors:** Rose `#F472B6` / `--bo-rose` is the canonical Tool Nexus color per design guide §3.1

---

## Sources

### Primary (HIGH confidence)
- `services/akasa-server/src/routes/tool-connections.ts` — verified API endpoints, response shape, status types
- `services/akasa-server/src/routes/oauth-flow.ts` — verified OAuth start/callback routes, redirect targets
- `services/akasa-server/src/routes/webhooks.ts` — verified webhook URL generation and receipt routes
- `services/akasa-server/src/services/oauth-providers.ts` — verified three OAuth providers: hubspot, slack, google-sheets
- `packages/db/src/schema/tool-connections.ts` — verified schema, status field values, encrypted field stripping
- `packages/db/src/schema/tool-invocation-logs.ts` — verified log schema, action field format
- `services/ui/src/lib/components/NavBar.svelte` — verified tab structure, world toggle pattern
- `services/ui/src/routes/(app)/+layout.server.ts` — verified session + companyId load pattern
- `services/ui/src/routes/(app)/sanctum/+page.server.ts` — verified Promise.allSettled fetch pattern
- `services/akasa-server/src/routes/index.ts` — verified all akasa route mount points
- `tasks/akasa-design-guide.md` — verified Tool Nexus = rose color, Director's Cut = integrations

### Secondary (MEDIUM confidence)
- `tasks/prd-akasa-mvp.md` §US-013–015 — product intent for routing rules and event log
- `.planning/STATE.md` accumulated decisions — Phase 6 design decisions (upsert pattern, token derivation)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — verified from actual source files
- Pitfalls: HIGH — discovered from reading Phase 6 implementation directly
- Backend gap (webhook_routing_rules): HIGH — grep confirmed table does not exist

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable stack, no fast-moving dependencies)
