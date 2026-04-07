# Phase 13: Agent Intelligence Views - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 13-agent-intelligence-views
**Areas discussed:** Agent Profile Layout, Fleet Org Map Structure, Council Reasoning Display, Runtime Status Placement
**Mode:** --auto (all decisions auto-selected)

---

## Agent Profile Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed sections in bot detail | Extend existing /evolution/[botId] with identity card + tabs (Profile, Timeline, Lineage, Ledger) | ✓ |
| Separate profile route | New /evolution/[botId]/profile route | |
| Side panel overlay | SlidePanel with profile info alongside timeline | |

**User's choice:** [auto] Tabbed sections within bot detail page (recommended default)
**Notes:** Reuses existing page structure. Identity card always visible at top, tabs switch content below. No new routes needed for the core profile.

---

## Fleet Org Map Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Task category → class → agents | Hierarchy grouped by task category (roots), agent class (mid), individual agents (leaves) | ✓ |
| Flat network graph | All agents as nodes with connection lines | |
| reportsTo hierarchy | Paperclip-style manager chain (not applicable — Akasa agents don't have reportsTo) | |

**User's choice:** [auto] Group by task category with class tiers (recommended default)
**Notes:** Natural hierarchy matches how evolution system works. Agents compete within categories, progress through classes. d3-hierarchy tree layout at /evolution/org.

---

## Council Reasoning Display

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expandable accordions | Extend BotTimeline verdict events with clickable expansion showing judge outputs in Accordion components | ✓ |
| Separate verdict detail page | Navigate to /evolution/verdicts/[id] for full reasoning | |
| Modal overlay | Click verdict → modal with tabbed judge outputs | |

**User's choice:** [auto] Inline expandable accordions on timeline events (recommended default)
**Notes:** VerdictConfirm.svelte already uses Accordion for judge outputs. Same pattern applied to historical verdicts in the timeline. No new components needed.

---

## Runtime Status Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Status bar in identity card | Compact row below identity card with live data, 30s polling | ✓ |
| Separate runtime tab | New tab alongside Profile/Timeline/Lineage/Ledger | |
| Floating status widget | Always-visible overlay widget on bot detail page | |

**User's choice:** [auto] Status bar in agent profile identity card (recommended default)
**Notes:** Runtime status is agent-level context, belongs with identity. Sourced from Paperclip GET /agents/:id/runtime-state via API proxy. Graceful degradation if unavailable.

---

## Claude's Discretion

- Scoring heuristic for text-based soul dimensions radar chart
- Identity card layout proportions
- Class progression visual format (stepper vs timeline)
- Judge output rendering format (structured vs formatted JSON)

## Deferred Ideas

None
