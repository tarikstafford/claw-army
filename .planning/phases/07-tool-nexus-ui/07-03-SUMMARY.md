---
phase: 07-tool-nexus-ui
plan: "03"
subsystem: tool-nexus

tags: [tool-nexus, webhooks, routing-rules, event-log, sveltekit, back-office, svelte5]

# Dependency graph
requires:
  - phase: 07-01
    provides: webhook_routing_rules routes, webhook logs route, tool-catalog.ts, tools layout
provides:
  - Webhooks page (routing rules CRUD + event log)
  - WebhookRuleForm component (event-type/connection/agent dropdowns)
  - WebhookLogEntry component (accordion-expandable log rows)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled for parallel data fetches in page.server.ts — consistent with Phase 07-01 pattern"
    - "invalidateAll() from $app/navigation for client-side data refresh after mutations"
    - "Svelte 5 $derived for computed values (selectedToolId, availableEventTypes, isSubmitDisabled)"
    - "$effect for resetting selectedEventType when selectedConnectionId changes"
    - "Accordion-style expansion without Accordion component — inline expand/collapse for log entries"

key-files:
  created:
    - services/ui/src/lib/components/tools/WebhookRuleForm.svelte
    - services/ui/src/lib/components/tools/WebhookLogEntry.svelte
    - services/ui/src/routes/(app)/tools/webhooks/+page.server.ts
    - services/ui/src/routes/(app)/tools/webhooks/+page.svelte

key-decisions:
  - "WebhookLogEntry uses inline expand/collapse state rather than importing Accordion.svelte — Accordion component requires label/color/children props designed for council-style usage; webhook log rows need a simpler header-only toggle pattern"
  - "SlidePanel title prop used for 'New Routing Rule' heading — component already renders a panel-title, no need for h3 inside panel body"
  - "formError inline state for both create and delete failures — simple string display above rules list"

patterns-established:
  - "Webhook routing rule form: dynamic event-type options derived from selected connection's toolId via TOOL_EVENT_TYPES map"
  - "Webhook log entry: success/failure indicated by colored dot (--bo-teal / --error) alongside latency"

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 07 Plan 03: Webhooks Page — Routing Rules and Event Log Summary

**Built the Webhooks page with routing rule management (CRUD via SlidePanel form and Modal confirmation) and a scrollable webhook event log with accordion-expandable payload details.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-25
- **Completed:** 2026-03-25
- **Tasks:** 2/2
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

### Task 1: WebhookRuleForm and WebhookLogEntry components

- Created `services/ui/src/lib/components/tools/WebhookRuleForm.svelte`:
  - Connection select filtered to non-disconnected connections, displaying "ToolName (status)"
  - Event type select dynamically populated from `TOOL_EVENT_TYPES[selectedToolId]` — resets on connection change via `$effect`
  - Optional condition text input with placeholder "e.g. payload.amount > 1000"
  - Agent select for assignment
  - "Add Rule" submit button with `--bo-rose` border, disabled until all required fields filled or while submitting
  - Full Back Office CSS token usage

- Created `services/ui/src/lib/components/tools/WebhookLogEntry.svelte`:
  - Header row: tool name, event action (stripped `webhook:` prefix), timestamp (Intl.DateTimeFormat en-GB)
  - Right side: latency in ms, success dot (--bo-teal / --error)
  - Inline expand/collapse for payload, response, error, and routed-agent details
  - `<pre>` blocks for requestSummary / responseSummary with scroll capping at 200px

### Task 2: Webhooks page

- Created `services/ui/src/routes/(app)/tools/webhooks/+page.server.ts`:
  - `Promise.allSettled` for webhook-routing-rules, webhooks/logs, tool-connections, and companies/:id/agents
  - Falls back to empty arrays on partial failure; returns `{ rules, logs, connections, agents, userId }`

- Created `services/ui/src/routes/(app)/tools/webhooks/+page.svelte`:
  - "Routing Rules" section with "Add Rule" button (`--bo-rose` border) opening `SlidePanel`
  - `WebhookRuleForm` mounted inside `SlidePanel` — POSTs to `/api/akasa/webhook-routing-rules`, calls `invalidateAll()` on success
  - Rule rows show: event type + tool name (left), assigned agent (middle), "Delete" button (right)
  - Delete opens `Modal` with "Delete this rule?" title and exact UI-SPEC body copy, then DELETEs and refreshes
  - "Event Log" section (margin-top `--space-2xl`) renders `WebhookLogEntry` for each log item
  - Empty states match UI-SPEC copywriting exactly for both sections

## Task Commits

1. **Task 1: Components** — `e7ad8a2`
2. **Task 2: Webhooks page** — `9bad9f6`

## Files Created/Modified

- `services/ui/src/lib/components/tools/WebhookRuleForm.svelte` — new routing rule form component
- `services/ui/src/lib/components/tools/WebhookLogEntry.svelte` — new log entry component with inline expand
- `services/ui/src/routes/(app)/tools/webhooks/+page.server.ts` — parallel data fetch with Promise.allSettled
- `services/ui/src/routes/(app)/tools/webhooks/+page.svelte` — full Webhooks page with CRUD + event log

## Decisions Made

- `WebhookLogEntry` uses inline expand/collapse rather than the project's `Accordion` component — the Accordion component expects `label`, `color`, and a `children` snippet, designed for council/soul-style usage. Webhook log rows need a header-only toggle with custom left/right layout that does not fit the Accordion API.
- `SlidePanel`'s `title` prop handles the "New Routing Rule" heading — no additional `<h3>` inside panel body needed.
- `formError` inline state string handles both create and delete API failures — displayed above the rules list.

## Deviations from Plan

**1. [Rule 1 - Pattern Adaptation] WebhookLogEntry uses inline accordion instead of Accordion.svelte**
- **Found during:** Task 1 — reading Accordion.svelte revealed `label`, `color`, `children` Snippet API incompatible with log entry header layout
- **Issue:** Accordion component renders its own header with a dot, label, sublabel, and arrow — the webhook log entry needs a completely different header layout (tool name + action + timestamp on left, dot + latency on right)
- **Fix:** Implemented inline expand/collapse with `expanded: boolean = $state(false)` and conditional `log-details` block
- **Files modified:** `services/ui/src/lib/components/tools/WebhookLogEntry.svelte`

## Known Stubs

None — all data flows are wired to real API endpoints. Empty arrays fall back gracefully on API failure.

## Self-Check: PASSED

- FOUND: services/ui/src/lib/components/tools/WebhookRuleForm.svelte
- FOUND: services/ui/src/lib/components/tools/WebhookLogEntry.svelte
- FOUND: services/ui/src/routes/(app)/tools/webhooks/+page.server.ts
- FOUND: services/ui/src/routes/(app)/tools/webhooks/+page.svelte
- FOUND commit: e7ad8a2 (feat(07-03): WebhookRuleForm and WebhookLogEntry components)
- FOUND commit: 9bad9f6 (feat(07-03): Webhooks page with routing rules and event log)
