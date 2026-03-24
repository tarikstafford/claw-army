---
phase: 04-sveltekit-frontend-core
plan: 03
subsystem: ui
tags: [svelte, frontend, indra, chat, sanctum, websocket]
dependency_graph:
  requires: [04-01]
  provides: [indra-page, chat-page, sanctum-page]
  affects: [services/ui]
tech_stack:
  added: []
  patterns: [subscribeWS, Promise.allSettled, optimistic-ui, two-panel-layout]
key_files:
  created:
    - services/ui/src/routes/(app)/indra/+page.svelte
    - services/ui/src/routes/(app)/indra/+page.server.ts
    - services/ui/src/routes/(app)/chat/+page.svelte
    - services/ui/src/routes/(app)/chat/+page.server.ts
    - services/ui/src/routes/(app)/sanctum/+page.svelte
    - services/ui/src/routes/(app)/sanctum/+page.server.ts
  modified: []
decisions:
  - INDRA fleet stats use dashboard.idleAgents/activeAgents/completedAgents field names — null-safe with '—' fallback per UI-SPEC
  - Chat messages fetched client-side only (not SSR) because thread selection is interactive
  - Optimistic UI for chat send — replace optimistic message with confirmed on API success, restore on failure
  - SANCTUM costs-by-agent table uses row.tokenCount ?? row.tokens for resilience to API field naming variations
metrics:
  duration: 201s
  completed_date: "2026-03-24"
  tasks: 3
  files: 6
---

# Phase 04 Plan 03: INDRA, CHAT, and SANCTUM Pages Summary

INDRA fleet briefing, CHAT with real-time WebSocket messaging, and SANCTUM cost metrics pages built using Phase 3 component library with full Front Office/Back Office dual-world support.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | INDRA fleet briefing page | 9480b53 | indra/+page.svelte, indra/+page.server.ts |
| 2 | CHAT page with real-time WebSocket messaging | 7787ad4 | chat/+page.svelte, chat/+page.server.ts |
| 3 | SANCTUM costs and metrics page | 4ab4288 | sanctum/+page.svelte, sanctum/+page.server.ts |

## What Was Built

### INDRA (`/indra`)
- Server load fetches dashboard, activity feed, and pending approvals via `Promise.allSettled` — gracefully degrades if any endpoint fails
- INDRA identity bar: gem diamond + "INDRA" wordmark in Cormorant Garamond, `--fo-plum` color, centered focal point
- MetricTile grid showing idle/working/done agent counts, total karma, and daily cost
- Pending approvals section with inline Approve/Dismiss buttons (hidden when empty)
- Activity feed with ISO timestamp formatting and "No recent activity" empty state
- `subscribeWS` subscription updates fleet counts reactively on `agent.status.changed` events

### CHAT (`/chat`)
- Server load fetches chat threads list — throws error on failure
- Two-panel layout: 240px sidebar + flex-1 message panel filling `calc(100vh - 44px)`
- Thread sidebar with avatar circles, thread titles, and last message previews
- Message panel renders `ChatBubble` components with auto-scroll via `tick()`
- Optimistic UI: message appended immediately with pending ID, replaced on API confirmation or restored on failure
- Enter to send, Shift+Enter for newline — handled via `onkeydown` event
- `subscribeWS` fetches new messages on `chat.message.created` for active thread, updates thread preview for inactive threads
- Typing indicator via `ChatBubble variant="agent" typing` on `chat.agent.typing` events (auto-dismissed after 3s)
- Skeleton loaders shown while messages load (no spinner, no text)

### SANCTUM (`/sanctum`)
- Server load fetches costs/summary, costs/by-agent, budgets/overview via `Promise.allSettled`
- "Sanctum" page display heading in Cormorant Garamond `clamp(26px, 3.5vw, 38px)`
- `KarmaCallout` rendered at top when karma data is available in cost summary or budget
- MetricTile grid: daily cost, budget remaining, monthly total, token count
- Costs by agent table: agent name, total cost, token count, last active date
- "Coming in Phase 5" evolution placeholder section — visible, not hidden
- Back Office styling polished with `--bo-*` token overrides throughout

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- **INDRA dashboard field mapping** (`indra/+page.svelte`): Uses `dashboard.idleAgents`, `dashboard.activeAgents`, `dashboard.completedAgents`, `dashboard.totalKarma`, `dashboard.dailyCostCents` — if Paperclip's dashboard API returns different field names, these will show '—'. This is intentional resilience per UI-SPEC (show '—' not zero) and will resolve when API is verified against live Paperclip.
- **SANCTUM costs-by-agent** (`sanctum/+page.svelte`): Uses `row.tokenCount ?? row.tokens` and `row.lastActive ?? row.updatedAt` — field names are resilient to API variations but exact mapping unverified.

## Self-Check: PASSED

All 6 files created and all 3 commits verified present.
