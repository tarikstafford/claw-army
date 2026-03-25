---
phase: 07-tool-nexus-ui
plan: "02"
subsystem: tool-nexus

tags: [tool-nexus, catalog, tool-belt, oauth, svelte5, back-office]

# Dependency graph
requires:
  - phase: 07-01
    provides: tools layout, TOOL_CATALOG, Back Office world enforcement, tool-connections backend routes
provides:
  - ToolCatalog.svelte component (grid grouped by category)
  - ToolCard.svelte component (connect/disconnect/re-auth with hover lift)
  - StatusBadge.svelte component (Press Start 2P 7px, status-to-color mapping)
  - ToolBelt.svelte component (connected tools list with last-used timestamps)
  - /tools/catalog page with server load and OAuth connect flow
  - /tools/belt page with server load and re-auth/disconnect flows
affects:
  - 07-03 (webhooks page is the remaining tab in the tools layout)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for tool-connections fetch in server load functions"
    - "OAuth callback query params read in server load, displayed as dismissible banners via onMount"
    - "window.location.href redirect for OAuth connect flow (full-page redirect, not popup)"
    - "invalidateAll() after successful DELETE for data refresh without full navigation"
    - "Disconnect confirmation via Modal.svelte with handleDisconnect async function"
    - "$derived Map keyed by toolId for O(1) connection lookup in ToolCatalog"

key-files:
  created:
    - services/ui/src/lib/components/tools/StatusBadge.svelte
    - services/ui/src/lib/components/tools/ToolCard.svelte
    - services/ui/src/lib/components/tools/ToolCatalog.svelte
    - services/ui/src/lib/components/tools/ToolBelt.svelte
    - services/ui/src/routes/(app)/tools/catalog/+page.server.ts
    - services/ui/src/routes/(app)/tools/catalog/+page.svelte
    - services/ui/src/routes/(app)/tools/belt/+page.server.ts
    - services/ui/src/routes/(app)/tools/belt/+page.svelte
  modified: []

key-decisions:
  - "StatusBadge uses inline style attribute for border/color from $derived colorMap — avoids dynamic class names, keeps scoped CSS simple"
  - "ToolCard renders Re-authorise button only when status === 'expired' (not generic 'Connect Tool') per UI-SPEC copywriting contract"
  - "OAuth success banner uses data.tool query param for tool name lookup — matches what oauth-flow.ts sends in redirect"
  - "Disconnect error shows inline banner on the page rather than throwing — non-critical operation, user stays on page"

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 07 Plan 02: Tool Catalog Page and Tool Belt Page Summary

**Built Tool Catalog and Tool Belt pages with StatusBadge, ToolCard, ToolCatalog, and ToolBelt Svelte 5 components — OAuth connect flow, disconnect confirmation modal, re-auth for expired connections, and live status badges.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 2/2
- **Files created:** 8
- **Files modified:** 0

## Accomplishments

### Task 1: Components
- Created `StatusBadge.svelte` — Press Start 2P 7px, inline color from `$derived` colorMap, 5 status states (connected/expired/rate_limited/errored/disconnected) mapped to bo-teal/bo-amber/bo-amber/error/bo-faint
- Created `ToolCard.svelte` — bo-card background, border radius-lg, hover lift `translateY(-2px)` at 0.15s ease, three button states (Connect Tool with bo-rose border, Disconnect Tool with error border, Re-authorise for expired), StatusBadge in top-right absolute corner
- Created `ToolCatalog.svelte` — iterates TOOL_CATEGORIES, renders ToolCard grid per category with `repeat(auto-fill, minmax(280px, 1fr))` CSS grid, `$derived` Map for O(1) connection lookup by toolId
- Created `ToolBelt.svelte` — filters disconnected connections, empty state "No tools connected", vertical list with belt rows showing tool name, display label, last-used timestamp (Intl.DateTimeFormat en-GB), StatusBadge, Re-authorise/Disconnect buttons

### Task 2: Pages
- Created `catalog/+page.server.ts` — Promise.allSettled fetch for `/api/akasa/tool-connections`, reads `connected`/`error`/`tool` OAuth callback params from URL
- Created `catalog/+page.svelte` — renders ToolCatalog, disconnect Modal, success/error dismissible banners with 4s auto-dismiss on mount, `startOAuth` with `window.location.href` redirect, `handleDisconnect` with `invalidateAll()` on success
- Created `belt/+page.server.ts` — same pattern as catalog, reads `connected`/`error` OAuth callback params
- Created `belt/+page.svelte` — renders ToolBelt, same Modal/banner/OAuth pattern as catalog page

## Task Commits

1. **Task 1: Components** - `97422e0` (feat)
2. **Task 2: Pages** - `13d8ed5` (feat)

## Files Created/Modified

- `services/ui/src/lib/components/tools/StatusBadge.svelte` — colored pill badge with Press Start 2P 7px
- `services/ui/src/lib/components/tools/ToolCard.svelte` — tool card with connect/disconnect/re-auth actions
- `services/ui/src/lib/components/tools/ToolCatalog.svelte` — category-grouped tool grid
- `services/ui/src/lib/components/tools/ToolBelt.svelte` — connected tools list with status and actions
- `services/ui/src/routes/(app)/tools/catalog/+page.server.ts` — server load with connection fetch and OAuth params
- `services/ui/src/routes/(app)/tools/catalog/+page.svelte` — catalog page with OAuth flow and disconnect
- `services/ui/src/routes/(app)/tools/belt/+page.server.ts` — server load with connection fetch and OAuth params
- `services/ui/src/routes/(app)/tools/belt/+page.svelte` — belt page with re-auth and disconnect

## Decisions Made

- StatusBadge uses inline `style` attribute for border/color from `$derived` colorMap — avoids dynamic class names, scoped CSS stays clean
- ToolCard renders "Re-authorise" label only for `expired` status per UI-SPEC copywriting contract (not a generic "Connect Tool")
- OAuth success banner uses `data.tool` query param for tool name when available, falls back to `data.connected` (toolId)
- Disconnect errors shown as inline page banner — non-critical, user stays on page to retry

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components receive live data from server load functions. Connection data comes from the `/api/akasa/tool-connections` endpoint established in Plan 01.

## Self-Check: PASSED

- FOUND: services/ui/src/lib/components/tools/StatusBadge.svelte
- FOUND: services/ui/src/lib/components/tools/ToolCard.svelte
- FOUND: services/ui/src/lib/components/tools/ToolCatalog.svelte
- FOUND: services/ui/src/lib/components/tools/ToolBelt.svelte
- FOUND: services/ui/src/routes/(app)/tools/catalog/+page.server.ts
- FOUND: services/ui/src/routes/(app)/tools/catalog/+page.svelte
- FOUND: services/ui/src/routes/(app)/tools/belt/+page.server.ts
- FOUND: services/ui/src/routes/(app)/tools/belt/+page.svelte
- FOUND commit: 97422e0 (feat(07-02): StatusBadge, ToolCard, ToolCatalog, ToolBelt components)
- FOUND commit: 13d8ed5 (feat(07-02): Tool Catalog page and Tool Belt page with server load functions)
