---
phase: 18-soul-inspector
plan: 01
subsystem: soul-inspector
tags: [soul, inspector, ui, api, drawer, panel]
dependency_graph:
  requires:
    - packages/db (botSouls, councilVerdicts, agentClasses tables)
    - services/execution-service/src/routes/bots.ts (existing route file)
    - services/ui/src/lib/api.ts (existing API client)
    - services/ui/src/lib/types.ts (existing types)
  provides:
    - GET /bots/:botId/soul endpoint
    - BotSoul TypeScript interface
    - getBotSoul() API client function
    - SoulInspectorPanel.svelte slide-in drawer
    - "Inspect Soul" buttons in all 3 bot card contexts
  affects:
    - services/ui/src/routes/executions/[id]/+page.svelte
    - services/ui/src/routes/executions/[id]/report/+page.svelte
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
tech_stack:
  added: []
  patterns:
    - CLASS_RANK precedence map for best agent class resolution (from executions.ts leaderboard)
    - Svelte 5 $props()/$state()/$effect() reactive drawer pattern
    - CSS @keyframes slideIn for panel animation
    - Number() cast for PG numeric-as-string on weightedConfidenceScore
key_files:
  created:
    - services/ui/src/lib/components/SoulInspectorPanel.svelte
  modified:
    - services/execution-service/src/routes/bots.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/routes/executions/[id]/+page.svelte
    - services/ui/src/routes/executions/[id]/report/+page.svelte
    - services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte
decisions:
  - "[18-01] constitutionDirectives jsonb column cast to string[] via TypeScript assertion — Drizzle infers jsonb as generic type"
metrics:
  duration: 12 min
  completed: 2026-02-22T09:38:43Z
  tasks_completed: 2
  files_modified: 7
---

# Phase 18 Plan 01: Soul Inspector Summary

**One-liner:** Slide-in soul inspector drawer with 7 behavioral dimensions, lineage metadata, constitution directives, and council verdict — triggered from all 3 bot card contexts via GET /bots/:botId/soul.

## What Was Built

### Task 1: GET /bots/:botId/soul endpoint + BotSoul type + getBotSoul() client

Added a new `GET /:botId/soul` route to `bots.ts` before the existing `/:botId/detail` handler. The endpoint:
- Fetches `bots.soulId` first — returns 200 with null fields (not 404) when soulId is null
- Queries `botSouls` for full soul data only when soulId is non-null
- Fetches the most recent council verdict via `ORDER BY createdAt DESC LIMIT 1`, casting `weightedConfidenceScore` to `Number()` per decision [17-01]
- Resolves best agent class using the `CLASS_RANK` precedence map pattern from `executions.ts` (Artisan=3 > Understudy=2 > Novice=1 > Retired=0)
- Declares 401 response in TypeBox schema per decision [16-02]

Added `BotSoul` interface to `types.ts` after the `ArmyBuilderAnalysis` block with full 7-dimension structure.

Added `getBotSoul()` to `api.ts` with `BotSoul` import.

### Task 2: SoulInspectorPanel component + wiring

Created `SoulInspectorPanel.svelte` in the new `services/ui/src/lib/components/` directory:
- CSS slide-in drawer: `position: fixed`, right-side, 480px max-width, `@keyframes slideIn` from `translateX(100%)`
- Svelte 5 pattern: `$props()`, `$state()`, `$effect()` — loads `getBotSoul(botId)` on botId change
- Backdrop overlay with `onclick={onClose}` for click-outside dismissal
- Auto-focus via `$effect(() => { if (botId && panelRef) panelRef.focus(); })`
- Content sections: Agent class badge (tier colors), Lineage grid, 7 Behavioral Dimensions (labeled, `white-space: pre-wrap`), Constitution Directives (ordered list), Council Verdict with per-judge expandable `<details>` blocks
- Graceful empty state when `soul.soulId === null`
- Hardcoded light-mode colors per decision [17-02]

Wired into all 3 contexts:
- **Monitoring page** (`executions/[id]`): "Soul" pill button in `.bot-card-top` with `stopPropagation + preventDefault` to prevent `<a>` navigation; `selectedBotId` state
- **Report/leaderboard** (`executions/[id]/report`): "Inspect" button in new "Soul" table column with `<th>` header; `selectedBotId` state
- **Bot detail** (`bots/[botId]`): "Inspect Soul" button in `.bot-status-row`; `showInspector` boolean state drives `botId` prop

## Verification Passed

1. `pnpm --filter=execution-service exec tsc --noEmit` — 0 errors
2. `pnpm --filter=ui exec npx svelte-check --tsconfig ./tsconfig.json` — 0 errors (474 files, 2 pre-existing CSS warnings)
3. `GET /:botId/soul` exists in bots.ts with TypeBox schema
4. `SoulInspectorPanel.svelte` renders all 7 dimensions, lineage, constitution, verdict
5. All 3 pages import and mount SoulInspectorPanel with click-to-open wiring
6. Bots with null soulId show graceful empty state (not error)
7. `Number(verdictRow.weightedConfidenceScore)` cast present in endpoint handler

## Success Criteria Met

- SOUL-01: Inspector panel shows full SOUL.md content via structured 7-dimension sections and constitution directives
- SOUL-02: Inspector panel shows lineage: generation counter, parent soul reference (or "Seed"), task category, archetype flag. Mutation operations omitted (not in DB schema — documented scope reduction)
- SOUL-03: Inspector panel shows council verdict: type, confidence %, summary, and per-judge outputs (when verdict exists)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast constitutionDirectives jsonb to string[]**
- **Found during:** Task 1 — backend TypeScript compilation
- **Issue:** Drizzle infers `jsonb` columns as `{}` type; TypeBox response schema expects `string[] | null`; direct use caused `TS2322`
- **Fix:** Added `(soulData?.constitutionDirectives as string[] | null)` type assertion
- **Files modified:** `services/execution-service/src/routes/bots.ts`
- **Commit:** 1c81785

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `1c81785` | feat(18-01): add GET /bots/:botId/soul endpoint, BotSoul type, and getBotSoul() client |
| 2 | `8eb4d6b` | feat(18-01): create SoulInspectorPanel drawer and wire into all 3 bot card contexts |

## Self-Check: PASSED

All files confirmed on disk:
- services/ui/src/lib/components/SoulInspectorPanel.svelte — FOUND
- services/ui/src/lib/types.ts — FOUND
- services/ui/src/lib/api.ts — FOUND
- services/execution-service/src/routes/bots.ts — FOUND

All commits verified in git history:
- 1c81785 — FOUND
- 8eb4d6b — FOUND
