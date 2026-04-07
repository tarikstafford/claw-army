# Phase 13: Agent Intelligence Views - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface comprehensive agent intelligence data that already exists in the database and Paperclip API but is currently hidden from users. Four capabilities:

1. **Agent Profile** — identity card + soul dimensions visualization + SOUL.md viewer + constitution directives + class progression
2. **Fleet Org Map** — interactive hierarchy of agents grouped by task category and class
3. **Council Verdict Detail** — expandable judge reasoning (Performance Judge, Soul Analyst, Devil's Advocate) on timeline events
4. **Agent Runtime Status** — live session info, token consumption, cost, heartbeat from Paperclip API

All data already exists — this is a pure UI/API-extension phase. No new DB tables needed.

</domain>

<decisions>
## Implementation Decisions

### Agent Profile Layout
- **D-01:** Agent profile is NOT a separate route — it extends the existing `/evolution/[botId]` page with new sections
- **D-02:** Identity card sits at top of bot detail page (always visible): name, class badge, archetype origin, task category, pioneer status, composite score
- **D-03:** Below identity card, tabbed navigation: Profile (new), Timeline (existing BotTimeline), Lineage (existing LineageTree), Ledger (existing ExperimentLedger)
- **D-04:** Profile tab contains: soul dimensions radar chart, formatted SOUL.md viewer, constitution directives list, class progression timeline

### Soul Dimensions Visualization
- **D-05:** 7-axis radar/spider chart for soul dimensions (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops)
- **D-06:** Dimensions are text strings, not numeric — radar chart needs a scoring heuristic (e.g., text length as proxy, or Claude's discretion on a better approach). Researcher should investigate appropriate visualization for text-based dimensions
- **D-07:** SOUL.md displayed as formatted markdown (use existing markdown rendering if available, or render dimension sections with headers)

### Fleet Org Map
- **D-08:** Org map lives at `/evolution/org` as a new tab in the evolution sub-nav
- **D-09:** Hierarchy structure: task category (root nodes) → agent class tier (Novice/Understudy/Artisan) → individual agents (leaves)
- **D-10:** Uses d3-hierarchy tree layout following the LineageTree.svelte pattern ($derived.by() for layout, declarative SVG rendering)
- **D-11:** Nodes show: agent name (or truncated botId), class badge, composite score, status indicator
- **D-12:** Color-coded by class: Artisan (amber), Understudy (violet), Novice (muted), Retired (faint) — matching FleetOverview conventions
- **D-13:** Click on agent node navigates to `/evolution/{botId}`

### Council Verdict Detail
- **D-14:** Timeline verdict events become expandable — clicking a verdict event in BotTimeline reveals judge outputs
- **D-15:** Use Accordion.svelte (existing component) for each judge section: Performance Judge, Soul Analyst, Devil's Advocate
- **D-16:** Judge outputs rendered as structured content (not raw JSON) — extract key fields if possible, fall back to formatted JSON

### Runtime Status
- **D-17:** Runtime status displayed as a compact status bar below the identity card on the bot detail page
- **D-18:** Data sourced from Paperclip API: GET `/agents/:id/runtime-state` via existing API proxy
- **D-19:** Shows: current session status, token consumption (input/output/cached), total cost, last heartbeat timestamp, last error (if any)
- **D-20:** Auto-refreshes on 30s polling interval (client-side setInterval with cleanup)
- **D-21:** Graceful degradation — if Paperclip runtime-state returns null/404, show "No runtime data" placeholder

### Claude's Discretion
- How to score/quantify text-based soul dimensions for the radar chart visualization (D-06)
- Exact layout proportions and spacing for the identity card
- Whether to show class progression as a horizontal stepper or vertical timeline
- Format of judge outputs (structured extraction vs. formatted JSON) based on actual JSONB shape

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `tasks/akasa-design-guide.md` — Visual language reference (Back Office palette, typography, component patterns)
- `services/ui/src/app.css` — Token definitions (--bo-* variables, spacing, fonts)

### Existing Evolution UI (extend, don't duplicate)
- `services/ui/src/routes/(app)/evolution/[botId]/+page.svelte` — Current bot detail page (add profile sections here)
- `services/ui/src/routes/(app)/evolution/[botId]/+page.server.ts` — Bot detail data loader (extend with new fetches)
- `services/ui/src/routes/(app)/evolution/+layout.svelte` — Evolution tab bar (add ORG tab)
- `services/ui/src/lib/components/evolution/LineageTree.svelte` — d3-hierarchy pattern reference
- `services/ui/src/lib/components/evolution/BotTimeline.svelte` — Timeline component (extend for verdict expansion)
- `services/ui/src/lib/components/evolution/FleetOverview.svelte` — Class badge colors and agent row patterns
- `services/ui/src/lib/components/evolution/VerdictConfirm.svelte` — Judge output accordion pattern

### Shared Components
- `services/ui/src/lib/components/Accordion.svelte` — Expandable section component

### Backend API
- `services/akasa-server/src/routes/evolution-dashboard.ts` — Evolution endpoints (extend for new data)
- `services/akasa-server/src/routes/council.ts` — Verdict endpoints
- `services/akasa-server/src/routes/souls.ts` — Soul CRUD endpoints

### DB Schema
- `packages/db/src/schema/bot-souls.ts` — Soul dimensions JSONB, constitution directives, generation, parentSoulId
- `packages/db/src/schema/council-verdicts.ts` — Judge output JSONB fields
- `packages/db/src/schema/agent-classes.ts` — Class progression tracking
- `packages/db/src/schema/bots.ts` — Bot with paperclipAgentId (links to Paperclip runtime)

### Paperclip API
- `paperclip/server/src/routes/agents.ts` — Runtime state endpoint (GET /agents/:id/runtime-state)

### Shared Types
- `packages/shared-types/src/soul.ts` — SoulDimension interface (7 fields)
- `packages/shared-types/src/bot.ts` — Bot interface, BotStatus enum

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **LineageTree.svelte**: d3-hierarchy + tree() + SVG rendering pattern — directly applicable for org map
- **BotTimeline.svelte**: Vertical event timeline — extend with expandable verdict detail
- **Accordion.svelte**: Used by VerdictConfirm for judge outputs — reuse for council reasoning display
- **FleetOverview.svelte**: Class badge color mapping (Artisan=amber, Understudy=violet, Novice=muted, Retired=faint)
- **VerdictConfirm.svelte**: Already renders performanceJudgeOutput, soulAnalystOutput, devilsAdvocateOutput as accordion sections

### Established Patterns
- d3 layout in `$derived.by()`, not `$effect()` (Phase 8-03 decision)
- Back Office world (`setMode('back-office')`) for all evolution views
- Evolution sub-nav with violet active indicator
- API proxy: SvelteKit `/api/...` → Express backend
- Parallel fetch with `Promise.allSettled` in page loaders
- Inline Press Start 2P at 20px for large display numbers (not MetricTile)

### Integration Points
- Evolution layout tabs: add "ORG" tab alongside FLEET, AGENTS, BENCHMARKS
- Bot detail page: add identity card header + tabbed content below
- Bot detail loader: extend to fetch soul data, runtime state
- Evolution dashboard API: add endpoint for soul+dimensions data per bot
- API proxy: add route for Paperclip runtime-state passthrough

</code_context>

<specifics>
## Specific Ideas

- User wants Paperclip's org map concept adapted for Akasa — not a direct port (Akasa agents don't have reportsTo), but a visual fleet topology grouped by task category and class
- Individual agent "soul" information should be clearly visible — dimensions, SOUL.md content, constitutional directives
- Council reasoning (what the 3 judges actually said) should be transparent to users, not hidden in JSONB
- Runtime status bridges Paperclip's live agent data into the Akasa evolution context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-agent-intelligence-views*
*Context gathered: 2026-04-07*
