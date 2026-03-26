---
phase: 08-evolution-dashboard
verified: 2026-03-26T10:18:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "GET /agents now includes .leftJoin(bots, eq(agentClasses.botId, bots.id)) and .leftJoin(councilVerdicts, eq(agentClasses.botId, councilVerdicts.botId)) and .groupBy() — compositeScore and lastVerdictAt return real DB data"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to /evolution with at least 2 executions completed — verify class distribution grid renders with real counts and sparkline appears"
    expected: "4-column grid with NOVICE/UNDERSTUDY/ARTISAN/RETIRED counts, CSS sparkline bars visible when scoreHistory has 2+ entries"
    why_human: "Requires live DB data from completed executions; programmatic check can only verify code structure"
  - test: "Navigate to /evolution and check agent list — verify at least some agents show a composite score value other than the dash placeholder"
    expected: "Agents that have completed council evaluations show their compositeScore; the gap that caused all-dashes is now closed"
    why_human: "Confirms the JOIN fix works end-to-end against real data, not just in unit tests with mocks"
  - test: "Navigate to /evolution/[botId] for a bot with soul lineage — click a circle node in the SVG lineage tree"
    expected: "Inline tooltip appears showing soul label, Generation N, archetype/pioneer tags"
    why_human: "SVG click interaction and tooltip positioning cannot be verified programmatically"
  - test: "On /evolution with a pending verdict visible — click the Approve button"
    expected: "Button shows loading state, then row fades out and is removed; heading disappears when list is empty"
    why_human: "Requires live pending verdict data and reachable PATCH endpoint"
---

# Phase 08: Evolution Dashboard Verification Report

**Phase Goal:** Users can see their agents evolving over time — class progression, soul lineage, experiment outcomes, category benchmarks, and pending confirmations all in one place
**Verified:** 2026-03-26T10:18:00Z
**Status:** human_needed — all automated checks pass, 11/11 must-haves verified
**Re-verification:** Yes — after gap closure (Plan 04 fixed GET /agents JOIN)

## Gap Closure Confirmation

The single gap from the initial verification has been closed:

**Gap:** GET /agents route selected `bots.compositeScore` and `MAX(councilVerdicts.createdAt)` but never joined those tables — runtime Drizzle SQL referenced columns from tables absent in the FROM clause.

**Fix applied (commit 08033de):** `.leftJoin(bots, eq(agentClasses.botId, bots.id))` and `.leftJoin(councilVerdicts, eq(agentClasses.botId, councilVerdicts.botId))` added after `.from(agentClasses)`, with `.groupBy(agentClasses.botId, agentClasses.currentClass, agentClasses.isPioneer, agentClasses.taskCategory, agentClasses.updatedAt, bots.compositeScore)` before `.orderBy()`.

**Evidence:**
- `services/akasa-server/src/routes/evolution-dashboard.ts` lines 109-111: leftJoin + leftJoin + groupBy confirmed in file
- `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` lines 299-323, 344-352: mock chain updated to `from().leftJoin().leftJoin().groupBy().orderBy()`
- All 88 tests pass: `Test Files 10 passed (10), Tests 88 passed (88)`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /fleet returns classCounts, totalBots, averageCompositeScore, scoreHistory, pendingVerdictCount | VERIFIED | evolution-dashboard.ts lines 22-92; real DB queries with AVG(), COUNT(), DATE() grouping |
| 2 | GET /agents returns agent list with botId, currentClass, compositeScore, isPioneer, lastVerdictAt | VERIFIED | Lines 99-118: leftJoin(bots) + leftJoin(councilVerdicts) + groupBy confirmed; SELECT shape includes all 5 fields |
| 3 | GET /bots/:botId/timeline returns merged verdict/class_transition/dna_capture events sorted DESC | VERIFIED | evolution-dashboard.ts lines 120-200; three parallel queries merged and sorted |
| 4 | GET /bots/:botId/lineage returns soul ancestry chain root-first | VERIFIED | evolution-dashboard.ts lines 203-272; parentSoulId walk, reversed at end |
| 5 | GET /bots/:botId/ledger returns run-by-run with scoreDelta and keepDiscard | VERIFIED | evolution-dashboard.ts lines 274-329; scoreDelta null-first, keepDiscard logic correct |
| 6 | GET /benchmarks returns all categoryBenchmarks with thinDataFlag and benchmarkMature | VERIFIED | evolution-dashboard.ts lines 331-340; full select from categoryBenchmarks |
| 7 | GET /pending returns only requiresHumanConfirmation=true AND status=pending verdicts | VERIFIED | evolution-dashboard.ts lines 342-372; and() with both conditions |
| 8 | Fleet overview shows 4-column class grid with semantic ARTISAN=amber treatment and CSS sparkline | VERIFIED | FleetOverview.svelte: grid-template-columns repeat(4, 1fr), .artisan { border-color: rgba(251,191,36,0.32) }, .sparkline flexbox bars |
| 9 | Bot detail page shows lineage SVG tree, timeline with color-coded dots, experiment ledger table | VERIFIED | LineageTree.svelte (d3-hierarchy), BotTimeline.svelte (EVENT_COLORS map), ExperimentLedger.svelte (table with th scope="col") |
| 10 | Pending verdicts widget enables approve/reject with modal gate | VERIFIED | VerdictConfirm.svelte: PATCH /verdicts/:id/confirm, Modal.svelte confirm gate for reject |
| 11 | Evolution Dashboard defaults to Director's Cut; mode toggle available in nav | VERIFIED | +layout.svelte setMode('back-office') on mount; NavBar.svelte has FRONT OFFICE/BACK OFFICE toggle buttons |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` | Wave 0 test file for all 7 routes | VERIFIED | Exists, 88 tests total across 10 test files, uses vi.mock('@claw/db') pattern |
| `services/akasa-server/src/routes/evolution-dashboard.ts` | All 7 GET evolution routes with correct JOINs | VERIFIED | Lines 109-111: leftJoin(bots) + leftJoin(councilVerdicts) + groupBy confirmed |
| `services/ui/src/lib/components/evolution/FleetOverview.svelte` | 4-column grid with sparkline | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/lib/components/evolution/VerdictConfirm.svelte` | Approve/reject widget | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/routes/(app)/evolution/+page.svelte` | Composed fleet page | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/lib/components/evolution/LineageTree.svelte` | d3-hierarchy SVG tree | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/lib/components/evolution/BotTimeline.svelte` | Chronological event list | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/lib/components/evolution/ExperimentLedger.svelte` | Run-by-run table | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/lib/components/evolution/BenchmarkCard.svelte` | Benchmark with pioneer treatment | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/routes/(app)/evolution/[botId]/+page.svelte` | Bot detail page | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/routes/(app)/evolution/benchmarks/+page.svelte` | Benchmarks page | VERIFIED | No regression — unchanged from initial verification |
| `services/ui/src/routes/(app)/evolution/+layout.svelte` | Back Office mode lock + sub-nav | VERIFIED | No regression — unchanged from initial verification |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `services/akasa-server/src/routes/index.ts` | `evolution-dashboard.ts` | `akasaRouter.use('/akasa/evolution', evolutionDashboardRouter())` | WIRED | Line 33: confirmed (no regression) |
| `services/ui/src/routes/(app)/evolution/+page.server.ts` | `/api/akasa/evolution/fleet` | fetch in load function | WIRED | No regression |
| `services/ui/src/routes/(app)/evolution/+page.svelte` | `FleetOverview.svelte` | component import | WIRED | No regression |
| `services/ui/src/lib/components/evolution/VerdictConfirm.svelte` | `/api/akasa/verdicts/:id/confirm` | fetch PATCH | WIRED | No regression |
| `services/ui/src/routes/(app)/evolution/[botId]/+page.svelte` | `LineageTree.svelte` | component import | WIRED | No regression |
| `services/ui/src/lib/components/evolution/LineageTree.svelte` | `d3-hierarchy` | import | WIRED | No regression |
| `services/ui/src/routes/(app)/evolution/+page.server.ts` | `/api/akasa/evolution/agents` | fetch in load function | WIRED | No regression |
| `services/akasa-server/src/routes/evolution-dashboard.ts` GET /agents | `bots` table | `.leftJoin(bots, eq(agentClasses.botId, bots.id))` | WIRED | Line 109: confirmed — gap closed |
| `services/akasa-server/src/routes/evolution-dashboard.ts` GET /agents | `council_verdicts` table | `.leftJoin(councilVerdicts, eq(agentClasses.botId, councilVerdicts.botId))` | WIRED | Line 110: confirmed — gap closed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `FleetOverview.svelte` | `fleet.classCounts`, `fleet.scoreHistory` | GET /fleet → DB (agentClasses COUNT, councilVerdicts AVG) | Yes — real DB aggregation queries | FLOWING |
| `FleetOverview.svelte` | `agents[]` (compositeScore) | GET /agents → DB with leftJoin(bots) + groupBy | Yes — JOIN to bots table returns compositeScore | FLOWING |
| `VerdictConfirm.svelte` | `pendingVerdicts[]` | GET /pending → DB (councilVerdicts with and() filter) | Yes — real DB filter query | FLOWING |
| `LineageTree.svelte` | `nodes[]` | GET /lineage → DB (botSouls parentSoulId walk) | Yes — iterative soul chain traversal | FLOWING |
| `BotTimeline.svelte` | `events[]` | GET /timeline → DB (3 tables merged, sorted) | Yes — three real DB queries merged | FLOWING |
| `ExperimentLedger.svelte` | `rows[]` | GET /ledger → DB (councilVerdicts with scoreDelta computed) | Yes — real DB query with delta computation | FLOWING |
| `BenchmarkCard.svelte` | `benchmark` | GET /benchmarks → DB (categoryBenchmarks full select) | Yes — full table select | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 88 akasa-server tests pass | `pnpm --filter @claw/akasa-server exec vitest run` | 10 test files, 88 tests passed | PASS |
| GET /agents mock chain includes leftJoin | grep leftJoin evolution-dashboard.test.ts | Lines 299, 300, 344, 345 | PASS |
| Route file contains leftJoin(bots) | grep 'leftJoin(bots' evolution-dashboard.ts | Line 109 | PASS |
| Route file contains leftJoin(councilVerdicts) | grep 'leftJoin(councilVerdicts' evolution-dashboard.ts | Line 110 | PASS |
| Route file contains groupBy on agents query | grep 'groupBy(' evolution-dashboard.ts | Line 111 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DASH-01 | 08-01, 08-02 | Fleet overview: agent count by class, composite score trends over time | SATISFIED | FleetOverview.svelte: 4-column grid, CSS sparkline from scoreHistory; GET /fleet and GET /agents both return real data |
| DASH-02 | 08-01, 08-03 | Per-agent evolution timeline: verdicts, class transitions, DNA captures chronologically | SATISFIED | BotTimeline.svelte: merged events from /timeline endpoint, EVENT_COLORS map |
| DASH-03 | 08-01, 08-03 | Lineage tree visualization: archetype to mutations to current soul, clickable nodes | SATISFIED | LineageTree.svelte: d3-hierarchy SVG, role="button" nodes, onclick tooltip |
| DASH-04 | 08-01, 08-03 | Experiment ledger: run-by-run log with score, delta, mutation, verdict, keep/discard | SATISFIED | ExperimentLedger.svelte: full table, formatDelta(), outcomeColor/Label() |
| DASH-05 | 08-01, 08-03 | Category benchmarks: pioneer baselines, maturity, thin-data flags | SATISFIED | BenchmarkCard.svelte: thinDataFlag italic caption, CONFIRMED tag for benchmarkMature |
| DASH-06 | 08-01, 08-02 | Pending confirmation: Promote/Retire verdicts with evidence, approve/reject inline | SATISFIED | VerdictConfirm.svelte: Accordion evidence, PATCH confirm/reject, Modal gate for reject |
| DASH-07 | 08-01, 08-03 | Pioneer designation: amber/gold, permanent badge, "First in [category]" with date | SATISFIED | BenchmarkCard.svelte: border-left amber; FleetOverview.svelte: .pioneer-badge in amber |
| DASH-08 | 08-01 | Evolution Dashboard defaults to Director's Cut; Screenplay toggle in nav | SATISFIED | +layout.svelte: setMode('back-office') on mount; NavBar.svelte: mode toggle buttons |

All 8 requirements satisfied. No orphaned requirements. REQUIREMENTS.md confirms all DASH-01 through DASH-08 marked Complete for Phase 8.

### Anti-Patterns Found

None — the blocker from the initial verification (un-joined table references in GET /agents) has been resolved. No new anti-patterns introduced by Plan 04.

### Human Verification Required

#### 1. Fleet Overview Data Rendering

**Test:** Navigate to `/evolution` with at least 2 executions completed
**Expected:** 4-column class grid shows non-zero counts; sparkline bars are visible (not "Not enough data for trend")
**Why human:** Requires live DB data from completed executions

#### 2. Agent Composite Score Display (Gap Closure Confirmation)

**Test:** Navigate to `/evolution` and check the agent list — do agents with completed council evaluations show a composite score?
**Expected:** At least some agents display a numeric composite score rather than the dash placeholder
**Why human:** Confirms the JOIN fix works end-to-end against real data; unit tests use mocks so runtime behavior against the actual DB is unverified programmatically

#### 3. Lineage Tree Node Interaction

**Test:** Navigate to `/evolution/[botId]` for a bot with soul lineage — click a circle node in the SVG
**Expected:** Inline tooltip appears showing soul label, "Generation N", archetype/pioneer tags
**Why human:** SVG click interaction and tooltip positioning cannot be verified programmatically

#### 4. Verdict Approve Action

**Test:** On `/evolution` with a pending verdict visible — click the "Approve" button
**Expected:** Button shows loading state, then row fades out and is removed from list; "Awaiting Your Decision" heading disappears when all verdicts are gone
**Why human:** Requires live pending verdict data and reachable PATCH endpoint

### Summary

All 11 observable truths are verified. The one gap from the initial verification — GET /agents missing LEFT JOINs to the `bots` and `council_verdicts` tables — has been closed by commit 08033de. The agents route now generates correct SQL with `LEFT JOIN bots`, `LEFT JOIN council_verdicts`, and `GROUP BY` including all non-aggregate columns. All 88 tests pass. All 8 DASH requirements are satisfied. The remaining 4 human verification items are unchanged from the initial verification and concern live UI behavior against real data.

---

_Verified: 2026-03-26T10:18:00Z_
_Verifier: Claude (gsd-verifier)_
