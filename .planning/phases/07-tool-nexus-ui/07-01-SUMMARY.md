---
phase: 07-tool-nexus-ui
plan: "01"
subsystem: tool-nexus

tags: [tool-nexus, webhook-routing-rules, backend, sveltekit, back-office, auth-protection]

# Dependency graph
requires:
  - phase: 06-tool-nexus-backend
    provides: tool_connections table, tool_invocation_logs table, Express akasaRouter, OAuth flow routes
provides:
  - webhook_routing_rules DB table and migration
  - GET/POST/DELETE /akasa/webhook-routing-rules Express routes
  - GET /akasa/webhooks/logs aggregated webhook log endpoint
  - /tools route auth protection in hooks.server.ts
  - NavBar TOOLS tab (5th tab)
  - tools layout with CATALOG / MY TOOLS / WEBHOOKS tab bar enforcing Back Office world
  - Static tool catalog (TOOL_CATALOG, TOOL_EVENT_TYPES) exported from tool-catalog.ts
  - /tools root redirects OAuth callback params to /tools/belt
affects:
  - 07-02 (catalog page depends on tools layout and TOOL_CATALOG)
  - 07-03 (belt and webhook pages depend on this layout and backend routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Logical FK for webhook_routing_rules.connectionId — no references() to avoid circular TypeScript inference"
    - "Router factory pattern for Express routes (webhookRoutingRulesRouter, webhookLogsRouter)"
    - "Back Office world enforced in tools layout via onMount setMode + cleanup restore"
    - "Static tool catalog array + TOOL_EVENT_TYPES map for webhook routing rule dropdowns"
    - "OAuth callback query param forwarding in +page.server.ts redirect chain"

key-files:
  created:
    - packages/db/src/schema/webhook-routing-rules.ts
    - packages/db/migrations/akasa/0013_webhook_routing_rules.sql
    - services/akasa-server/src/routes/webhook-routing-rules.ts
    - services/akasa-server/src/routes/webhook-logs.ts
    - services/ui/src/lib/tool-catalog.ts
    - services/ui/src/routes/(app)/tools/+layout.svelte
    - services/ui/src/routes/(app)/tools/+page.server.ts
  modified:
    - packages/db/src/schema/index.ts
    - services/akasa-server/src/routes/index.ts
    - services/ui/src/hooks.server.ts
    - services/ui/src/lib/components/NavBar.svelte

key-decisions:
  - "Logical FK for connectionId in webhook_routing_rules — no references() call, consistent with CLAUDE.md note about circular TypeScript inference"
  - "webhookLogsRouter mounted at /akasa/webhooks alongside webhooksRouter — shares prefix, GET /logs route is distinct from webhook receiver routes"
  - "Back Office world enforced via onMount/cleanup in tools layout — captures previousMode before forcing back-office, restores on unmount"
  - "/tools root page.server.ts forwards OAuth success/error params to /tools/belt before defaulting to /tools/catalog — matches oauth-flow.ts redirect target"
  - "TOOL_CATALOG is static (3 tools: hubspot, slack, google-sheets) — no backend catalog endpoint needed, live status overlaid from API"

patterns-established:
  - "Tool Nexus pages enforce Back Office world via layout onMount"
  - "Static catalog + live status overlay pattern for tool discovery"
  - "TOOL_EVENT_TYPES per-tool static map for webhook event type dropdowns"

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 07 Plan 01: Tool Nexus UI Backend Gap Closure and Scaffolding Summary

**Closed the webhook_routing_rules backend gap (new DB table + CRUD routes + aggregated log endpoint) and scaffolded the /tools UI surface with auth protection, NavBar TOOLS tab, Back Office world enforcement, and a 3-tab layout shell.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 2/2
- **Files created:** 7
- **Files modified:** 4

## Accomplishments

### Task 1: Backend
- Created `packages/db/src/schema/webhook-routing-rules.ts` — `webhook_routing_rules` pgTable with logical FK, indexes, and exported `WebhookRoutingRule` / `NewWebhookRoutingRule` types
- Added `export * from './webhook-routing-rules'` to `packages/db/src/schema/index.ts`
- Created `packages/db/migrations/akasa/0013_webhook_routing_rules.sql` — idempotent `CREATE TABLE IF NOT EXISTS` with two indexes
- Created `services/akasa-server/src/routes/webhook-routing-rules.ts` — `webhookRoutingRulesRouter()` factory with `GET /`, `POST /`, `DELETE /:id`
- Created `services/akasa-server/src/routes/webhook-logs.ts` — `webhookLogsRouter()` factory with `GET /logs?userId=` querying `tool_invocation_logs WHERE action LIKE 'webhook:%'`
- Mounted both routers on `akasaRouter` in `services/akasa-server/src/routes/index.ts`

### Task 2: UI Scaffolding
- Updated `services/ui/src/hooks.server.ts` to add `event.url.pathname.startsWith('/tools')` to the `isProtected` check
- Extended `NavBar.svelte` `activeTab` type to include `'tools'` and added 5th TOOLS tab (`{ href: '/tools', label: 'TOOLS', key: 'tools' }`)
- Created `services/ui/src/lib/tool-catalog.ts` with `TOOL_CATALOG` (3 entries), `TOOL_EVENT_TYPES`, `ToolCatalogEntry`, `TOOL_CATEGORIES`
- Created `services/ui/src/routes/(app)/tools/+page.server.ts` — reads `connected`/`error` OAuth callback params, redirects to `/tools/belt` or `/tools/catalog`
- Created `services/ui/src/routes/(app)/tools/+layout.svelte` — enforces Back Office world on mount (with cleanup restore), renders CATALOG / MY TOOLS / WEBHOOKS tab bar with `--bo-rose` active indicator

## Task Commits

1. **Task 1: Backend** - `794b4f4` (feat)
2. **Task 2: UI scaffolding** - `02ec527` (feat)

## Files Created/Modified

- `packages/db/src/schema/webhook-routing-rules.ts` — new schema with indexes and exported types
- `packages/db/src/schema/index.ts` — added webhook-routing-rules barrel export
- `packages/db/migrations/akasa/0013_webhook_routing_rules.sql` — idempotent migration
- `services/akasa-server/src/routes/webhook-routing-rules.ts` — GET/POST/DELETE CRUD router
- `services/akasa-server/src/routes/webhook-logs.ts` — GET /logs aggregated webhook log router
- `services/akasa-server/src/routes/index.ts` — added imports and mounts for both new routers
- `services/ui/src/hooks.server.ts` — added /tools to auth protection
- `services/ui/src/lib/components/NavBar.svelte` — added TOOLS tab and type extension
- `services/ui/src/lib/tool-catalog.ts` — static catalog and event type map
- `services/ui/src/routes/(app)/tools/+page.server.ts` — OAuth callback redirect handler
- `services/ui/src/routes/(app)/tools/+layout.svelte` — Back Office world + 3-tab layout shell

## Decisions Made

- `webhook_routing_rules.connectionId` uses plain `uuid()` without `references()` — consistent with CLAUDE.md's documented "logical FK" pattern to avoid circular TypeScript inference
- `webhookLogsRouter` mounted at `/akasa/webhooks` (same prefix as `webhooksRouter`) — the `GET /logs` path is distinct from the webhook receiver routes (`POST /:toolId/:token`)
- Back Office world enforcement in tools layout uses `onMount` with captured `previousMode` — allows the layout to restore the previous mode when unmounting (user navigates away from /tools)
- `/tools` root page reads OAuth callback params and forwards to `/tools/belt` — matches the `oauth-flow.ts` redirect target `${baseUrl}/tools?connected=${toolId}`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all scaffolding is functional. Downstream pages (catalog, belt, webhooks) will be built in Plans 02 and 03.

## Self-Check: PASSED

- FOUND: packages/db/src/schema/webhook-routing-rules.ts
- FOUND: packages/db/migrations/akasa/0013_webhook_routing_rules.sql
- FOUND: services/akasa-server/src/routes/webhook-routing-rules.ts
- FOUND: services/akasa-server/src/routes/webhook-logs.ts
- FOUND: services/ui/src/lib/tool-catalog.ts
- FOUND: services/ui/src/routes/(app)/tools/+layout.svelte
- FOUND: services/ui/src/routes/(app)/tools/+page.server.ts
- FOUND commit: 794b4f4 (feat(07-01): webhook_routing_rules schema...)
- FOUND commit: 02ec527 (feat(07-01): UI scaffolding...)
