---
phase: 08-evolution-dashboard
plan: "04"
subsystem: evolution-dashboard-api
tags: [bug-fix, drizzle, sql, left-join, group-by]
dependency_graph:
  requires: []
  provides: [correct-agents-query-with-joins]
  affects: [fleet-overview-agent-list]
tech_stack:
  added: []
  patterns: [drizzle-left-join, sql-group-by-aggregation]
key_files:
  modified:
    - services/akasa-server/src/routes/evolution-dashboard.ts
    - services/akasa-server/src/__tests__/evolution-dashboard.test.ts
decisions:
  - "groupBy includes bots.compositeScore because it is a selected non-aggregate column from a joined table"
  - "lastVerdictAt uses MAX() aggregate so it is excluded from groupBy"
  - "Both JOINs are LEFT JOIN to preserve agent_classes rows for bots with no verdicts or no composite score"
metrics:
  duration: 4 min
  completed: "2026-03-26"
  tasks: 1
  files: 2
requirements:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
  - DASH-05
  - DASH-06
  - DASH-07
  - DASH-08
---

# Phase 08 Plan 04: GET /agents LEFT JOIN Fix Summary

**One-liner:** Added LEFT JOIN bots and LEFT JOIN council_verdicts with GROUP BY to the GET /agents Drizzle query so compositeScore and lastVerdictAt return real database values instead of undefined.

## What Was Done

The GET /agents route in `services/akasa-server/src/routes/evolution-dashboard.ts` selected `bots.compositeScore` and `MAX(councilVerdicts.createdAt)` in its `.select()` block but only queried `.from(agentClasses)` with no JOIN to either table. Drizzle was generating SQL that referenced columns from tables not in the FROM clause, causing compositeScore and lastVerdictAt to be undefined for all rows. The Fleet Overview agent list showed "--" for all composite scores.

**Fix applied:**

```typescript
const agentRows = await db
  .select({
    botId: agentClasses.botId,
    currentClass: agentClasses.currentClass,
    isPioneer: agentClasses.isPioneer,
    taskCategory: agentClasses.taskCategory,
    compositeScore: bots.compositeScore,
    lastVerdictAt: sql<string | null>`MAX(${councilVerdicts.createdAt})`,
  })
  .from(agentClasses)
  .leftJoin(bots, eq(agentClasses.botId, bots.id))
  .leftJoin(councilVerdicts, eq(agentClasses.botId, councilVerdicts.botId))
  .groupBy(agentClasses.botId, agentClasses.currentClass, agentClasses.isPioneer, agentClasses.taskCategory, agentClasses.updatedAt, bots.compositeScore)
  .orderBy(desc(agentClasses.updatedAt));
```

Test mock chains updated to reflect the new `.leftJoin().leftJoin().groupBy().orderBy()` call chain.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix GET /agents route JOINs and update test mock chain | 08033de | evolution-dashboard.ts, evolution-dashboard.test.ts |

## Verification

- `grep -n 'leftJoin(bots'` — line 109: match confirmed
- `grep -n 'leftJoin(councilVerdicts'` — line 110: match confirmed
- `grep -n 'groupBy('` — line 111: match confirmed (agents route)
- `pnpm --filter @claw/akasa-server exec vitest run` — 88/88 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- [x] `services/akasa-server/src/routes/evolution-dashboard.ts` — modified, exists
- [x] `services/akasa-server/src/__tests__/evolution-dashboard.test.ts` — modified, exists
- [x] Commit 08033de — confirmed in git log
- [x] All 88 tests pass
