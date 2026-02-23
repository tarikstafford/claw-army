# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v3.0 Phase 23 — Akasa UI Rebrand Design System Rollout (Plan 1 of 7 complete)

## Current Position

Phase: 23 of 23 (Akasa UI Rebrand — Design System Rollout)
Plan: 1 of 7 complete — Design system foundation done
Status: Phase 23, Plan 1 complete — Akasa token system + particle canvas nav + landing + login pages rebranded
Last activity: 2026-02-23 — 23-01 complete: Akasa CSS token system, layout shell, landing page, login page

Progress: [██████████] ~100% v3.0 core + Phase 23 in progress (1/7 plans done)

## Performance Metrics

**Velocity:**
- Total plans completed: 45 (v1.0 + v1.1 + v2.0 + v3.0 P01-22 + P23-01)
- Average duration: 4.7 min
- Total execution time: 222 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01–07 (v1.0 + v1.1) | 25/25 | 147 min | 5.9 min |
| 08–14 (v2.0) | 19/19 | 55 min | 2.9 min |
| 15–19 (v3.0) | 7/TBD | 37 min | 5.3 min |

| Phase 18-soul-inspector P01 | 12 min | 2 tasks | 7 files |
| Phase 18-soul-inspector P02 | 3 min | 2 tasks | 5 files |
| Phase 19-run-view-enhancements P01 | 3 min | 2 tasks | 4 files |
| Phase 19-run-view-enhancements P02 | 3 min | 2 tasks | 7 files |
| Phase 20-spawn-timeout-error-preservation P01 | 5 min | 1 task | 1 file |
| Phase 21-launch-from-objective-ui P01 | 8 min | 2 tasks | 3 files |
| Phase 21-launch-from-objective-ui P02 | 2 min | 1 task | 1 file |
| Phase 22-v3-tech-debt-cleanup P01 | 2 min | 2 tasks | 3 files |
| Phase 23-akasa-ui-rebrand P01 | 6 min | 2 tasks | 4 files |

**Recent Trend:**
- v2.0 plans averaged 2.9 min — targeted, incremental additions to existing systems.
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0–v2.0 architectural decisions archived in PROJECT.md Key Decisions table.
See `.planning/milestones/v2.0-ROADMAP.md` for full phase-level decision log.

**v3.0 decisions:**
- [15-01] Migration files belong in packages/db/migrations/ (drizzle out:./migrations), not src/migrations/ as initially planned
- [15-01] Removed set -e from startup script in favor of explicit || { FAILURE_REASON=...; exit 1; } blocks — required for EXIT trap to fire post_failure()
- [15-01] Double-validate openclaw: command -v guard (idempotency) + --version execution (correctness) as separate checks
- [15-02] Return 200 for failure payload receipt — VM completed its job by reporting; ACK prevents retry spam
- [15-02] Liveness check placed between connect() and registry update — never register a stale WebSocket client
- [15-02] Spawn timeout uses botRegistry polling (not DB query) — avoids per-interval DB hit; registry is authoritative in-process state
- [15-03] checkExecutionCompletion called fire-and-forget after task terminal state — completion check non-blocking, failures logged but don't affect task result
- [15-03] bot-stopped class no longer applied to failed bots — failed bots need distinct visual treatment (red/pink) not faded opacity
- [15-03] Connection-level errorMessage uses substring matching ('not connected', 'Connection closed') — matches openclaw-client error strings from Plan 02
- [16-01] objectiveId on executions is nullable with ON DELETE SET NULL — existing executions unaffected, no backfill needed
- [16-01] Migration 0010 uses DO $ block with information_schema check for idempotent FK constraint addition
- [16-01] NewObjective omits id, isArchived, createdAt, updatedAt — server always assigns these
- [16-02] TypeBox response schemas for auth-protected routes must declare 401 as valid response code or TS2345 is raised
- [16-02] CORS methods expanded to include PATCH and DELETE for browser preflight support on objectives endpoints
- [16-03] objectiveId validation in service layer (not route) keeps FK pre-check co-located with DB operations
- [16-03] Error string matching in route catch block ('Objective not found or archived') creates clear service/route contract
- [16-03] objectiveId ?? null passed to INSERT ensures nullable FK is always explicitly written as SQL NULL
- [17-01] db.execute() returns non-iterable QueryResult — use db.select() with sql<T> correlated subqueries for all objectives route queries
- [17-01] Stats endpoint uses single db.select().from(objectives) with 4 correlated subquery fields — clean pattern, avoids non-iterable QueryResult
- [17-01] avgCompositeScore in executions endpoint CAST AS float to prevent PostgreSQL numeric-as-string coercion
- [17-01] ObjectiveListItem extends Objective — base type for GET /objectives/:id, extended type for GET /objectives list aggregation

- [17-02] No CSS variable conversion on objectives page — kept hardcoded light-mode colors consistent with billing/+page.svelte
- [17-02] Objectives nav link is first in nav-right (before Guide) — primary v3.0 navigation target
- [17-03] activeRunId is plain $state (not $derived from runs) — prevents Svelte 5 infinite re-run loop in SSE/polling effect
- [17-03] SSE effect cleanup: returns () => { clearInterval(interval); cleanup?.(); } — mirrors executions/[id] pattern; terminal status events clear activeRunId to auto-dismiss live panel
- [17-03] activityFeed LIFO slice of 5: [event, ...activityFeed].slice(0, 5) — newest event always first
- [Phase 18-01]: [18-01] constitutionDirectives jsonb column cast to string[] via TypeScript assertion — Drizzle infers jsonb as generic type, required to satisfy TypeBox string[] | null response schema
- [18-02] inArray guarded with botIds.length > 0 — PostgreSQL rejects empty IN () clause; guard prevents SQL error when execution has no bots yet
- [18-02] Bot detail page uses separate botAgentClass $state + $effect to fetch agentClass from getBotSoul() — badge visible without user opening inspector panel
- [18-02] Report leaderboard class-badge span replaced with SoulTierBadge component — eliminates duplicated CSS, same hex values, single source of truth

- [19-01] tokenBurnRate returned as null when bot has been active < 1 minute — avoids misleading spikes from early tool calls
- [19-01] currentTaskDescription query uses tasks WHERE status='claimed' (not 'working') — claimed is the in-progress state in the task lifecycle
- [19-01] toolCallCount excludes rejected=true invocations — counts only productive tool calls

- [19-02] VerdictConfirmPanel calls onResolved() instead of goto() — inline panel must not navigate away from run detail view
- [19-02] arrivedAt initialized in let declaration (not $effect) — verdict data passed as prop so timing starts at component mount
- [19-02] Pending verdicts polling at 10s vs bots at 5s — verdicts change less frequently than bot status
- [19-02] pending-verdicts endpoint filters verdictType IN ('Promote','Retire') — only promotion-path verdicts require human confirmation

- [20-01] stopBot() skipDbUpdate option added as optional third param — existing callers unaffected (2-arg calls pass undefined, guard evaluates false, DB write proceeds as before)
- [20-01] Only spawn-timeout call site passes skipDbUpdate:true — idle checker and all other callers continue writing status:'stopped' unconditionally
- [20-01] publishBotStopped remains unconditional — event correctly signals VM termination regardless of which terminal status the bot ended with

- [21-01] objectiveId conditional spread ...(objectiveId ? { objectiveId } : {}) — TypeBox Optional(Type.String({ format: 'uuid' })) rejects null; omitting the field entirely when absent is the correct approach
- [21-01] $effect for form initialization from URL params — $derived would make values read-only and break bind:value; $state + $effect allows user-overridable initialization
- [21-01] Hidden input pattern for objectiveId — URL search params are NOT included in formData on POST; hidden input inside form is the only reliable mechanism
- [21-02] Button placed between .meta paragraph and Aggregate Stats section — primary action visually follows objective identity, precedes data sections for natural scan order
- [21-02] budgetCapDollars fallback of 10 (dollars) when defaultBudgetCapCents is null — aligns with plan specification
- [21-02] Indigo #4f46e5 (slightly deeper than page's existing #6366f1) distinguishes the primary action button from secondary view/navigation links

- [22-01] Dead agent class CSS removed from report page — SoulTierBadge component replaced raw spans in Phase 18-02, making 40 lines of .class-* CSS orphaned
- [22-01] userId derived from data.session?.user?.email with 'operator' fallback — follows established pattern from verdicts/+page.svelte and verdicts/[verdictId]/+page.svelte
- [22-01] let { data } = $props() used (not page.data.session) — codebase convention reserves page store for route params only

- [23-01] --error/#f87171 and --error-dim added for form validation/API failures; --rose reserved for retirement/soul language only — distinct semantic purposes prevent token confusion across rebrand plans
- [23-01] Font link tags in layout svelte:head (not per-page) — global availability across all routes; removed duplicate from landing page svelte:head
- [23-01] Objectives nav link placed first in nav-links ul — matches v3.0 nav order: Objectives, Guide, Verdicts, Billing
- [23-01] Particle class defined at module scope in layout — avoids Svelte 5 nested-class performance warning

### Roadmap Evolution

- Phase 23 added: Akasa UI Rebrand — Design System Rollout (merge improvement/ui + apply to all 8 remaining pages)

### Pending Todos

None.

### Blockers/Concerns (carry forward to v3.0)

- [Production]: Confirm pgvector extension enabled on Cloud SQL before running migrations 0003–0007.
- [Production]: Run archetype seed after migration: `cd packages/db && npx tsx src/seed/archetypes.ts`
- [BOT — Phase 15]: Verify OpenClaw WebSocket `run_task` schema accepts extra soul fields or use prompt-prefix injection.
- [Production]: Configure Cloud Scheduler to POST /admin/cleanup/decision-traces for 90-day TTL enforcement.
- [Production]: Terraform needs bot-lifecycle-billing-sub subscription for Billing Engine.
- [Production]: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_TRUST_HOST must be set in Vercel env vars.
- [Production]: Composite score weights (40/30/20/10) not empirically validated — iterate after first real execution data.
- [Production]: GCP resources not yet provisioned. Terraform config valid. Run terraform apply when GCP project is ready.

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 23-01-PLAN.md — Phase 23, Plan 1 complete: Akasa token system, particle canvas nav, landing + login pages rebranded (6 min, 4 files)
Resume file: None
