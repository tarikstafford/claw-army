# Phase 38: Objective DNA Evolution Timeline - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Objective detail page shows a chronological timeline of soul lifecycle events (promotions, demotions, retirements, pioneer detections, and all council verdicts) across all runs linked to that objective. Requires a new backend query endpoint and a timeline UI component. No schema changes — all data already exists in agent_classes, council_verdicts, dna_store, negative_signal_register, and category_benchmarks tables.

</domain>

<decisions>
## Implementation Decisions

### Timeline visual style
- Vertical event list with left-side connecting line and event nodes
- Line stays neutral (var(--border)); individual nodes are color-coded: green for promotion, red for retirement, amber for demotion, neutral for monitor/maintain
- Class transitions displayed with existing tier badges and arrow: [Novice] → [Understudy]
- Timeline sits BELOW the existing DNA Evolution summary section (keep the aggregate class counts + trend summary as a quick glance)

### Event scope
- Show ALL council verdicts — not just class transitions. Includes: Promote, Demote, Retire, Monitor, Maintain verdicts + pioneer detection events
- Flat chronological list, newest first (most recent events at top)
- Filter chips above timeline: All, Promotions, Demotions, Retirements, Pioneers, Monitor/Maintain — starts with "All" selected
- No grouping by run — run number shown per event but events are a flat list

### Entry detail level
- Rich default view per entry: task category, class transition with tier badges + arrow, run number (linked to /executions/:id), date, verdict type label, weighted confidence score, composite fitness score, 1-line verdict summary snippet
- Entries are expandable — click to reveal: full verdict summary, individual council judge scores (Performance Judge 50%, Soul Analyst 35%, Devil's Advocate 15%), mutation lineage if applicable
- Pioneer events get a distinct visual treatment (pioneer badge/marker)

### Pagination
- Show latest 20 events initially, "Load more" button to fetch older events
- Newest first ordering — "Load more" loads progressively older events

### Empty state
- Zero runs: muted message + CTA — "No evolution history yet. Launch your first run to start building soul intelligence." with link to launch button
- Runs with no transitions: Monitor/Maintain verdicts appear naturally in timeline (all verdicts included)
- Timeline renders correctly with success criteria empty state requirement

### Claude's Discretion
- Exact spacing, padding, and typography within Akasa design system
- Loading skeleton while timeline data fetches
- "Load more" implementation details (offset-based vs cursor-based)
- Exact filter chip styling and interaction micro-details
- Pioneer event node color choice (suggest purple/violet to differentiate from transition colors)
- Expanded view layout within each timeline entry

</decisions>

<specifics>
## Specific Ideas

- Reuse existing tier badges from bot cards (Novice/Understudy/Artisan/Retired) for the class transition display
- Run number links directly to execution detail page — consistent with Run History table above
- Council judge breakdown in expanded view mirrors the weighted verdict structure: Performance Judge (50%), Soul Analyst (35%), Devil's Advocate (15%)
- Color-coded nodes match the semantic meaning: green = positive progression, red = terminal, amber = setback

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Tier badges: existing Novice/Understudy/Artisan/Retired badge components used on bot cards, leaderboard, and bot detail
- Objective detail page: `services/ui/src/routes/objectives/[id]/+page.svelte` — 1,090 lines, 4 sections (Stats, Live Status, Run History, DNA Evolution summary)
- `$lib/api.ts`: `apiFetch<T>` helper, existing getObjective/getObjectiveExecutions/getObjectiveStats functions
- `$lib/types.ts`: Objective, ObjectiveListItem, ObjectiveRun, ObjectiveStats types
- Akasa design system: 28 CSS tokens (--violet, --bg-card, --border, --text-muted, etc.)

### Established Patterns
- SvelteKit server load functions with explicit App.Locals type annotation (no $types import) — established in Phases 36-37
- Auth: server load reads httpOnly session cookie, forwards Bearer token to backend
- Progressive disclosure: expandable sections used elsewhere in the UI
- Status/class badge pattern reused across multiple pages

### Integration Points
- Backend: New endpoint needed on `/objectives/:id/timeline` (or similar) in `services/execution-service/src/routes/objectives.ts`
- Query joins: objectives → executions → bots → agent_classes + council_verdicts + dna_store + category_benchmarks
- Frontend: New section added to `services/ui/src/routes/objectives/[id]/+page.svelte` below existing DNA Evolution summary
- Types: New timeline event type needed in `$lib/types.ts`
- API client: New function in `$lib/api.ts` for fetching timeline data with pagination + filter params

### Data Model Path
```
objectives
  └─ executions (via objectiveId FK)
      └─ bots (via executionId FK)
          ├─ agent_classes (botId + taskCategory) → currentClass, lastTransitionAt, artisanGraduationAt
          ├─ council_verdicts (botId + executionId) → verdictType, weightedConfidenceScore, verdictSummary, judge outputs
          ├─ dna_store (botId + executionId) → version, compositeScore, dnaPayload (GODL-02 context)
          ├─ negative_signal_register (botId + executionId) → failureType, mutationBlacklist
          └─ category_benchmarks (taskCategory) → pioneerBotId, baselineCompositeScore, benchmarkMature
```

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-objective-dna-evolution-timeline*
*Context gathered: 2026-03-03*
