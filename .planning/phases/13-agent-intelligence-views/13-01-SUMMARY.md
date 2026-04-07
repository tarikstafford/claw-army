---
phase: 13-agent-intelligence-views
plan: "01"
subsystem: akasa-server/evolution-dashboard
tags: [backend, api, evolution, agent-intelligence]
dependency_graph:
  requires: []
  provides: [evolution-dashboard-api-profile, evolution-dashboard-api-org, evolution-dashboard-api-runtime]
  affects: [ui-agent-intelligence-views]
tech_stack:
  added: []
  patterns: [lazy-paperclip-db-init, d3-hierarchy-single-root, parallel-promise-all]
key_files:
  created: []
  modified:
    - services/akasa-server/src/routes/evolution-dashboard.ts
decisions:
  - "Single fleet root object returned by /org endpoint (not array) — d3-hierarchy requires single root node per RESEARCH.md Pitfall 6"
  - "Lazy getPaperclipDb() helper for Paperclip DB initialization — avoids circular initialization, consistent with evolution-trigger.ts pattern"
  - "agentRuntimeState + agents queries run in parallel via Promise.all — independent queries, no dependency between them"
  - "classHistory derived from single agentClasses row — simplified history with initial Novice entry and current class if transitioned"
  - "Runtime endpoint returns res.json(null) with 200 when paperclipAgentId is null — graceful degradation per D-21"
metrics:
  duration: 197s
  completed: "2026-04-07"
  tasks_completed: 2
  files_modified: 1
---

# Phase 13 Plan 01: Agent Intelligence Views Backend Endpoints Summary

Four API endpoints added to `evolution-dashboard.ts` powering the Agent Intelligence Views UI: bot profile with soul dimensions, fleet org tree for d3-hierarchy, extended timeline with judge JSONB, and runtime data from Paperclip shared DB.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add profile, org, and extended timeline endpoints | b3b8e8a | evolution-dashboard.ts |
| 2 | Add runtime proxy endpoint with budget utilization | b3b8e8a | evolution-dashboard.ts |

Note: Both tasks modified the same file and were committed atomically in a single commit.

## Endpoints Implemented

### GET /bots/:botId/profile (AGENT-01)
- Joins `bots` LEFT JOIN `agentClasses` LEFT JOIN `botSouls`
- Returns: `compositeScore`, `status`, `currentClass`, `isPioneer`, `taskCategory`, `archetypeName`, `soulId`, `soulContent`, `dimensions`, `constitutionDirectives`, `generation`, `classHistory`
- 404 when bot not found; null for soul fields when `soulId` is null
- `classHistory` derived from single `agentClasses` row: initial Novice entry + current class if `lastTransitionAt` is non-null

### GET /org (AGENT-02)
- Queries `agentClasses` LEFT JOIN `bots`
- Builds hierarchy in application code: fleet root → category → class_tier → agent leaves
- Returns single root object with `type: 'fleet'` — required by d3-hierarchy for single root
- Agent `label` = first 8 chars of `botId`

### GET /bots/:botId/timeline — Extended (AGENT-03)
- Added `performanceJudgeOutput`, `soulAnalystOutput`, `devilsAdvocateOutput` to verdict SELECT
- These fields are populated on verdict events; non-verdict events (class_transition, dna_capture) do not include them

### GET /bots/:botId/runtime (AGENT-04)
- Looks up `bots.paperclipAgentId` from Akasa DB
- Graceful null return (200) when `paperclipAgentId` is null
- Parallel queries to Paperclip shared DB: `agentRuntimeState` + `agents` via `Promise.all`
- Returns: `sessionId`, `lastRunStatus`, `totalInputTokens`, `totalOutputTokens`, `totalCachedInputTokens`, `totalCostCents`, `budgetMonthlyCents`, `spentMonthlyCents`, `budgetUtilization`, `lastError`, `updatedAt`
- `budgetUtilization = Math.round((spentMonthlyCents / budgetMonthlyCents) * 100)` when `budgetMonthlyCents > 0`, otherwise `null`

## Decisions Made

1. **Single fleet root for /org**: RESEARCH.md documents returning an array of category roots, but the plan intentionally deviates — d3-hierarchy requires a single root node (Pitfall 6). Returning a single `fleet` root object is the correct approach for Plan 03 OrgMap.svelte.

2. **Lazy getPaperclipDb() helper**: Added at file scope to avoid circular initialization. Same pattern as `evolution-trigger.ts`. The `agentRuntimeState` and `paperclipAgents` are dynamically imported inside the route handler using `await import('@paperclipai/db')`.

3. **classHistory simplification**: `agentClasses` stores one row per bot+category (no transition audit log). classHistory is derived by creating an initial "Novice" entry from `createdAt` and adding the current class only if `lastTransitionAt` is non-null and class is not Novice.

## Deviations from Plan

None — plan executed exactly as written. The `/org` endpoint intentionally deviates from RESEARCH.md (per the plan's own note), returning a single root object rather than an array — this is plan-documented, not an executor deviation.

## Known Stubs

None — all endpoints return live DB data. The runtime endpoint gracefully returns `null` when no Paperclip agent is linked (not a stub — documented behavior per D-21).

## Self-Check: PASSED

- evolution-dashboard.ts modified: FOUND
- Commit b3b8e8a: FOUND (`git log --oneline | grep b3b8e8a`)
- `router.get('/bots/:botId/profile'`: FOUND at line 366
- `router.get('/org'`: FOUND at line 441
- `router.get('/bots/:botId/runtime'`: FOUND at line 518
- `performanceJudgeOutput: councilVerdicts.performanceJudgeOutput`: FOUND at line 147
- `agentRuntimeState`: FOUND at lines 540, 545-555
- `budgetUtilization`: FOUND at lines 576-578, 590
