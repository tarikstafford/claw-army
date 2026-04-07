---
phase: 13-agent-intelligence-views
plan: "02"
subsystem: ui
tags: [evolution, bot-detail, svelte, components, radar-chart, timeline]
dependency_graph:
  requires: ["13-01"]
  provides: ["bot-detail-ui", "identity-card", "soul-radar", "profile-tab", "runtime-status"]
  affects: ["services/ui/src/routes/(app)/evolution/[botId]"]
tech_stack:
  added: []
  patterns:
    - "7-axis SVG radar chart with text-length/500 heuristic for dimension scoring"
    - "30s setInterval polling for runtime status via onMount cleanup"
    - "Accordion token override: --card: var(--bo-card) wrapper for Back Office world"
    - "$derived.by() for complex derived computations returning typed arrays"
key_files:
  created:
    - services/ui/src/lib/components/evolution/IdentityCard.svelte
    - services/ui/src/lib/components/evolution/SoulRadar.svelte
    - services/ui/src/lib/components/evolution/ProfileTab.svelte
    - services/ui/src/lib/components/evolution/RuntimeStatus.svelte
  modified:
    - services/ui/src/lib/components/evolution/BotTimeline.svelte
    - services/ui/src/routes/(app)/evolution/[botId]/+page.svelte
    - services/ui/src/routes/(app)/evolution/[botId]/+page.server.ts
decisions:
  - "Accordion token override via wrapper div with --card: var(--bo-card) is required for Back Office world — Accordion uses semantic --card/--border tokens that default to Front Office"
  - "Text-length/500 heuristic for SoulRadar dimension scoring — maps SOUL.md section length to [0,1] radar coverage"
  - "$derived.by() used for complex array computation in ProfileTab (not $derived<T>(fn) which passes a function to derived rather than wrapping it)"
metrics:
  duration: "484s"
  completed_date: "2026-04-07"
  tasks_completed: 3
  files_changed: 7
---

# Phase 13 Plan 02: Bot Detail Page — Identity Card, Profile Tab, Runtime Status, Verdict Accordion Summary

Bot detail page redesigned with IdentityCard header, RuntimeStatus polling bar, and 4-tab layout (Profile/Timeline/Lineage/Ledger). Profile tab shows 7-axis soul radar, SOUL.md viewer, constitution directives, and class progression stepper. Timeline verdict events expand to show 3-judge Accordion sections with structured output rendering.

## What Was Built

**IdentityCard.svelte** — Horizontal card at top of bot detail page showing bot ID (first 8 chars in mono/violet), class badge (color-coded per CLASS_COLORS), pioneer badge (amber), composite score (Press Start 2P 20px), task category, archetype label, and status dot.

**SoulRadar.svelte** — Pure SVG radar chart with 7 axes mapping soul dimension keys. Uses text-length/500 heuristic to derive scores from SOUL.md dimension content length. Shows outer bounding polygon, axis lines, data polygon with violet fill, and labeled axes.

**ProfileTab.svelte** — Vertical stack of 4 sections: SoulRadar component, SOUL.md viewer (splits on `## ` headers), Constitution Directives ordered list, and Class Progression stepper with colored circles and date labels connected by horizontal lines.

**RuntimeStatus.svelte** — Compact horizontal status bar that polls `/api/akasa/evolution/bots/:botId/runtime` every 30 seconds via `setInterval` in `onMount`. Shows session status, token counts (IN/OUT/CACHED), cost in dollars, budget utilization with color thresholds (default/<80% = `--bo-text`, 80-99% = `--bo-amber`, >=100% = `--bo-rose`), relative heartbeat time, and error truncated to 60 chars.

**BotTimeline.svelte (extended)** — Added `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` fields to TimelineEvent interface. Verdict events with judge data show "Show/Hide Judge Detail" toggle button. Expanded detail renders 3 Accordion sections (PERFORMANCE JUDGE / SOUL ANALYST / DEVIL'S ADVOCATE) with structured rendering for outputs containing `score`/`reasoning`/`recommendation` keys.

**+page.server.ts** — Extended Promise.allSettled array with profile endpoint fetch; returns `profile` field (null on failure).

**+page.svelte** — Replaced flat layout with: back link, IdentityCard, RuntimeStatus, 4-tab nav (PROFILE/TIMELINE/LINEAGE/LEDGER), tab content area. Tab buttons use violet bottom border for active state, matching evolution sub-nav convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect $derived syntax in ProfileTab**
- **Found during:** Task 3 svelte-check verification
- **Issue:** `$derived<SoulSection[]>((): SoulSection[] => {...})` passes a function to `$derived` which expects the computed value directly, not a factory
- **Fix:** Changed to `$derived.by((): SoulSection[] => {...})` which is the correct Svelte 5 API for derived computations using a callback
- **Files modified:** `services/ui/src/lib/components/evolution/ProfileTab.svelte`
- **Commit:** cd5b251

## Known Stubs

None — all components render live data from API responses. When data is null/unavailable, appropriate fallback text is shown ("No soul data", "No runtime data", "No profile data available").

## Self-Check: PASSED
