---
phase: 39-soul-and-dna-visibility
plan: "01"
subsystem: soul-visibility
tags: [souls, benchmarks, ui, api, read-only]
dependency_graph:
  requires: []
  provides:
    - GET /souls endpoint with category/class filtering and pagination
    - GET /souls/categories endpoint for filter chip population
    - GET /category-benchmarks endpoint
    - Soul Library page at /souls
    - Category Benchmarks page at /category-benchmarks
  affects:
    - services/execution-service/src/app.ts
    - services/ui/src/routes/+layout.svelte
tech_stack:
  added: []
  patterns:
    - Fastify plugin with TypeBox schema validation (soulsRoutes, categoryBenchmarksRoutes)
    - Drizzle ORM with raw SQL LEFT JOINs for cross-table aggregation
    - Svelte 5 runes ($state, $effect) with manual load function pattern
    - Filter chip → backend reload pattern (consistent with Phase 38 decision)
key_files:
  created:
    - services/execution-service/src/routes/souls.ts
    - services/execution-service/src/routes/category-benchmarks.ts
    - services/ui/src/routes/souls/+page.svelte
    - services/ui/src/routes/category-benchmarks/+page.svelte
  modified:
    - services/execution-service/src/app.ts
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/routes/+layout.svelte
decisions:
  - "soulsRoutes registers GET /categories before GET / to avoid Fastify route conflict (static segment before dynamic)"
  - "agentClass join uses raw SQL LEFT JOIN with compound condition (botId + taskCategory) — same pattern as objectives.ts"
  - "compositeScore sourced from bots.compositeScore via botId LEFT JOIN — null for archetypes (no botId)"
  - "Filter chips call loadSouls(reset: true) directly — no reactive effects to avoid infinite loop (consistent with Phase 38 decision)"
  - "Load More appends to existing souls array and updates currentOffset — avoids full re-fetch"
  - "Category Benchmarks page uses table layout — more appropriate than cards for structured multi-column data"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_changed: 8
---

# Phase 39 Plan 01: Soul Library and Category Benchmarks Summary

Two new read-only Fastify route plugins and two SvelteKit pages giving users full visibility into the DNA soul library (SOUL-01) and per-category benchmark data (SOUL-04).

## What Was Built

**Backend (Task 1):**

`services/execution-service/src/routes/souls.ts` — `soulsRoutes` Fastify plugin:
- `GET /souls/categories` — SELECT DISTINCT task_category for filter chip population
- `GET /souls` — paginated soul list (limit/offset, optional category and agentClass filters) with LEFT JOINs to `agent_classes` and `bots` tables for agentClass and compositeScore fields

`services/execution-service/src/routes/category-benchmarks.ts` — `categoryBenchmarksRoutes` Fastify plugin:
- `GET /category-benchmarks` — all category benchmarks ordered by task_category ASC

Both route plugins registered in `app.ts` with `/souls` and `/category-benchmarks` prefixes.

**UI (Task 2):**

- `SoulLibraryEntry`, `SoulLibraryResponse`, `SoulCategoriesResponse`, `CategoryBenchmarkEntry`, `CategoryBenchmarksResponse` added to `types.ts`
- `getSoulLibrary()`, `getSoulCategories()`, `getCategoryBenchmarks()` added to `api.ts`
- `/souls` page: 3-column responsive card grid with category filter chips (from API), class filter chips (Novice/Understudy/Artisan/Retired), generation badge, agent class badge with color coding, composite score, Load More pagination
- `/category-benchmarks` page: full-width table with Mature/Immature badges (teal/gray), Thin/OK badges (amber/gray), pioneer execution link, standard promotion indicator
- Nav bar updated with "Souls" and "Benchmarks" links

## Verification Results

- `npx tsc --noEmit` in execution-service: 0 errors in new files (1 pre-existing error in `billing.ts` unrelated to this plan)
- `npx svelte-check --threshold error` in UI: 0 errors, 0 warnings in new files

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 14aba79 | feat(39-01): add GET /souls and GET /category-benchmarks backend endpoints |
| 2    | 7f3741c | feat(39-01): add Soul Library and Category Benchmarks UI pages |

## Self-Check: PASSED

All 4 new files verified present on disk. Both task commits (14aba79, 7f3741c) confirmed in git log.
