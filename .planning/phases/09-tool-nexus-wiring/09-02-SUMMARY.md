---
phase: 09-tool-nexus-wiring
plan: 02
subsystem: api
tags: [webhook, routing-rules, tool-nexus, dispatch, tdd, drizzle, fire-and-forget]

# Dependency graph
requires:
  - phase: 09-tool-nexus-wiring
    plan: 01
    provides: webhook receipt + signature verification already working; webhook_routing_rules table populated via UI (Phase 7)

provides:
  - "extractEventType(toolId, payload) — pure function, named export, provider-specific event type extraction"
  - "evaluateRoutingRules(rules, eventType) — pure function, named export, exact + wildcard matching"
  - "Webhook routing rule evaluation after receipt — fire-and-forget, never blocks 200 response"
  - "tool_invocation_logs entry with action webhook:toolId:dispatched on rule match"
  - "tool_invocation_logs entry with action webhook:toolId:no_match on no match"
  - "Best-effort agent heartbeat notification on match with assignToAgentId"
  - "10 unit tests covering extractEventType and evaluateRoutingRules"

affects:
  - TOOL-07 gap closure — webhook payloads now routed to matched agent/logged as no_match

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget pattern: res.json({ received: true }) before void (async () => { ... })()"
    - "TDD: unit tests for pure functions extracted from route handler — no DB mocking required"
    - "Provider-specific event extraction: HubSpot (events[0].subscriptionType), Slack (event.type / type), fallback (payload.type)"
    - "Wildcard routing rule: eventType === '*' matches any event"

key-files:
  created:
    - services/akasa-server/src/__tests__/webhook-routing.test.ts
  modified:
    - services/akasa-server/src/routes/webhooks.ts

key-decisions:
  - "extractEventType and evaluateRoutingRules exported as named exports — enables unit testing without DB mocking and future reuse"
  - "Fire-and-forget pattern (void async IIFE) for routing evaluation — 200 response never delayed by DB queries or agent dispatch"
  - "Slack event.type preferred over top-level type for non-challenge payloads — event object carries the actual event type in Slack's event subscriptions API"
  - "Best-effort agent heartbeat on localhost:PORT — non-blocking, failure logged as warning only"
  - "no_match always logged to tool_invocation_logs — TOOL-07 requirement for visibility into unmatched webhooks"

patterns-established:
  - "Fire-and-forget routing evaluation pattern: log receipt → send 200 → evaluate rules async"
  - "Provider-specific event type extraction via pure function"

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 9 Plan 02: Webhook Routing Rule Evaluation Summary

**Webhook routing gap closed (TOOL-07) — incoming payloads matched against webhook_routing_rules, dispatch logged with agentId on match, no_match logged otherwise; 200 response always fires before routing evaluation via fire-and-forget void async pattern**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-29T09:06:18Z
- **Completed:** 2026-03-29T09:11:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

### Task 1: Add routing rule evaluation and dispatch to webhook handler (TDD)

**RED phase:**
- Created `services/akasa-server/src/__tests__/webhook-routing.test.ts` with 10 unit tests for `extractEventType` and `evaluateRoutingRules`
- Tests imported both functions from `webhooks.ts` as named exports (which didn't exist yet)
- Confirmed tests fail with "is not a function" (confirmed RED state before implementation)

**GREEN phase:**
- Added `import { webhookRoutingRules } from '@claw/db'` and `import { and } from 'drizzle-orm'` to `webhooks.ts`
- Added `export function extractEventType(toolId, payload)` — handles HubSpot (events[0].subscriptionType), Slack (event.type / type), unknown tools (type / 'unknown')
- Added `export function evaluateRoutingRules(rules, eventType)` — exact match + wildcard ('*') support; returns first match or null
- Added fire-and-forget routing block after `res.json({ received: true })` in the webhook receiver:
  - Parses raw body as JSON (silent catch)
  - Extracts eventType via `extractEventType`
  - Queries `webhook_routing_rules` filtered by userId + toolId + isActive=true
  - Calls `evaluateRoutingRules(rules, eventType)`
  - On no match: inserts `webhook:${toolId}:no_match` log entry
  - On match: inserts `webhook:${toolId}:dispatched` log with agentId, eventType, ruleId; then best-effort heartbeat POST to Paperclip agents API
- `res.json({ received: true })` is on line 208, before the void async block on line 216 — 200 response always fires first
- Slack URL verification challenge early return preserved intact

**Verification:**
- All 10 tests pass: `pnpm --filter @claw/akasa-server exec vitest run src/__tests__/webhook-routing.test.ts`
- Full suite 98/98 tests pass

## Task Commits

1. **Task 1: Add routing rule evaluation and dispatch to webhook handler** - `ed01840` (feat)

## Files Created/Modified

- `services/akasa-server/src/__tests__/webhook-routing.test.ts` — 10 unit tests for extractEventType and evaluateRoutingRules pure functions
- `services/akasa-server/src/routes/webhooks.ts` — Added extractEventType and evaluateRoutingRules exports + fire-and-forget routing evaluation block with no_match/dispatched logging

## Decisions Made

- `extractEventType` and `evaluateRoutingRules` extracted as named exports for unit testability — pure functions with no DB dependency
- Fire-and-forget `void (async () => {...})()` ensures 200 response is never delayed by routing evaluation (per TOOL-07 requirement and Pitfall 4 in research)
- HubSpot event extraction uses `events[0].subscriptionType` per HubSpot subscription events API structure
- Slack event extraction prefers `payload.event.type` over top-level `payload.type` — event subscriptions API wraps actual events in `event` object; top-level `type` is for challenge/admin events
- Best-effort heartbeat to `localhost:${PORT}/api/companies/default/agents/${agentId}/heartbeat` — non-blocking, failure is a console.warn only, not an error that affects dispatch logging

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None. The webhook routing evaluation uses existing infrastructure (webhook_routing_rules table, tool_invocation_logs table) with no new configuration required.

## Next Phase Readiness

- TOOL-07 is now fully satisfied: webhook receipt → signature verification → log receipt → send 200 → evaluate routing rules → log dispatch/no_match
- The assigned agent receives a best-effort heartbeat notification for matched webhooks
- No_match webhooks are visible in the webhook event log with `webhook:toolId:no_match` action for operational visibility
- Ready for Phase 10

---
*Phase: 09-tool-nexus-wiring*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: `services/akasa-server/src/__tests__/webhook-routing.test.ts`
- FOUND: `services/akasa-server/src/routes/webhooks.ts` contains extractEventType, evaluateRoutingRules, webhookRoutingRules import, no_match logging, dispatched logging, void (async pattern
- FOUND: commit `ed01840`
