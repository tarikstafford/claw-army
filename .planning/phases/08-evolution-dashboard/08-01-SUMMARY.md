---
phase: 08-evolution-dashboard
plan: 01
subsystem: evolution-dashboard
tags: [backend, frontend, api, evolution, vitest]
dependency_graph:
  requires: []
  provides:
    - evolution-dashboard-api-routes
    - evolution-dashboard-ui-skeleton
    - evolution-dashboard-test-suite
  affects:
    - services/akasa-server/src/routes/index.ts
    - services/ui/src/lib/components/NavBar.svelte
tech_stack:
  added:
    - d3-hierarchy ^3.1.2 (lineage tree layout — used in Plan 03)
    - "@types/d3-hierarchy ^3.1.7"
  patterns:
    - evolutionDashboardRouter() factory pattern (Express Router)
    - Promise.allSettled for parallel API fetches in SvelteKit page.server.ts
    - supertest + vi.mock('@claw/db') pattern for route unit tests
key_files:
  created:
    - services/akasa-server/src/__tests__/evolution-dashboard.test.ts
    - services/akasa-server/src/routes/evolution-dashboard.ts
    - services/ui/src/routes/(app)/evolution/+layout.svelte
    - services/ui/src/routes/(app)/evolution/+page.server.ts
    - services/ui/src/routes/(app)/evolution/+page.svelte
    - services/ui/src/routes/(app)/evolution/agents/+page.server.ts
    - services/ui/src/routes/(app)/evolution/agents/+page.svelte
    - services/ui/src/routes/(app)/evolution/[botId]/+page.server.ts
    - services/ui/src/routes/(app)/evolution/[botId]/+page.svelte
    - services/ui/src/routes/(app)/evolution/benchmarks/+page.server.ts
    - services/ui/src/routes/(app)/evolution/benchmarks/+page.svelte
  modified:
    - services/akasa-server/src/routes/index.ts
    - services/ui/src/lib/components/NavBar.svelte
    - services/ui/package.json
decisions:
  - "Evolution sub-nav uses violet active indicator (--bo-violet) not rose (--bo-rose) per UI-SPEC — evolution is violet-domain"
  - "FLEET tab uses exact pathname match (=== '/evolution'), AGENTS/BENCHMARKS use startsWith — avoids FLEET being perpetually active"
  - "Score history uses DATE() daily aggregation with AVG() per day, limit 30 — avoids per-verdict scatter plot noise"
  - "Ledger scoreDelta returns null for first row and toFixed(2) string for subsequent — consistent with numeric display format"
  - "keepDiscard logic: confirmed Promote/Maintain = keep, confirmed Demote/Retire = discard, all other statuses = pending"
  - "Lineage walk reversed after collection — chain is collected leaf-to-root then reversed to root-first for display"
metrics:
  duration_minutes: 6
  tasks_completed: 4
  files_created: 13
  files_modified: 3
  completed_date: "2026-03-26"
---

# Phase 08 Plan 01: Evolution Dashboard API Routes and UI Scaffold Summary

**One-liner:** 7 Express GET routes for evolution data (fleet/agents/timeline/lineage/ledger/benchmarks/pending), Wave 0 Vitest test suite (15 tests passing), and SvelteKit route scaffold with Back Office mode lock, EVOLUTION NavBar tab, and FLEET/AGENTS/BENCHMARKS sub-navigation.

## What Was Built

### Task 0: Wave 0 Test File
Created `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` with 7 describe blocks covering all GET route handlers. Uses supertest Express app pattern with `vi.mock('@claw/db')` to mock Drizzle queries. 15 tests passing covering:
- Fleet: classCounts with 0-fill, scoreHistory shape, averageCompositeScore, pendingVerdictCount
- Agents: shape validation and empty array case
- Timeline: merge + DESC sort + empty case
- Lineage: parentSoulId chain walk + empty soulId case
- Ledger: scoreDelta null-first + keepDiscard logic
- Benchmarks: shape with thinDataFlag and benchmarkMature
- Pending: filter correctness + empty case

### Task 1: Evolution Dashboard Express Routes
Created `services/akasa-server/src/routes/evolution-dashboard.ts` with `evolutionDashboardRouter()` factory exporting 7 GET routes:
- `GET /fleet` — classCounts (0-filled for all 4 classes), scoreHistory (daily avg last 30 entries), averageCompositeScore, pendingVerdictCount, totalBots
- `GET /agents` — agent list from agentClasses ordered by updatedAt DESC
- `GET /bots/:botId/timeline` — merged verdict/class_transition/dna_capture events sorted DESC
- `GET /bots/:botId/lineage` — soul parentSoulId chain walk (root-first, max depth 10)
- `GET /bots/:botId/ledger` — run-by-run with scoreDelta and keepDiscard
- `GET /benchmarks` — all categoryBenchmarks rows
- `GET /pending` — verdicts where requiresHumanConfirmation=true AND status=pending

Router mounted in `routes/index.ts` alongside existing `evolutionTriggerRouter()` (no conflict — trigger only registers POST /trigger).

### Task 2: NavBar + Evolution Layout
- `d3-hierarchy ^3.1.2` installed in `@claw/ui` (for Plan 03 lineage tree)
- NavBar extended: `activeTab` type union includes `'evolution'`, new tab `{ href: '/evolution', label: 'EVOLUTION', key: 'evolution' }`
- `+layout.svelte` created with Back Office mode lock (onMount setMode/cleanup restore pattern from tools layout) and FLEET/AGENTS/BENCHMARKS sub-nav with violet active indicator

### Task 3: Page Skeletons
All 4 page types created and loading data server-side:
- Fleet: classCounts grid, avg score stat, pending verdicts list, agent link list
- Agents: functional agent list with class badge, task category, score, pioneer badge
- Bot detail: Soul Lineage section, Evolution Timeline section, Experiment Ledger table
- Benchmarks: thinDataFlag/benchmarkMature flag display with pioneer score and run count

## Commits

| Hash | Message |
|------|---------|
| 3704787 | test(08-01): add Wave 0 test file for evolution dashboard routes |
| c7bf62e | feat(08-01): create evolution dashboard Express routes (7 GET endpoints) |
| bac0264 | feat(08-01): install d3-hierarchy, extend NavBar with EVOLUTION tab, create evolution layout |
| f2f16e2 | feat(08-01): create all evolution page skeletons (fleet, agents, bot detail, benchmarks) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- Fleet page (`+page.svelte`): classCounts grid is a basic div layout — Plan 02 replaces with real FleetOverview component including score trend chart using scoreHistory data
- Bot detail page (`+page.svelte`): Lineage displayed as text chain — Plan 03 replaces with LineageTree SVG component using d3-hierarchy
- Bot detail page: Timeline displayed as simple list — Plan 02/03 add richer event cards
- Agents route (`/agents`): Uses simplified SELECT without JOIN to bots for compositeScore/lastVerdictAt — these columns will be null until the JOIN query is enhanced in Plan 02

## Self-Check: PASSED

All created files exist on disk. All 4 task commits verified in git log.
