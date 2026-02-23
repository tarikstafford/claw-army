# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Users deploy a crew of AI bots that gets measurably smarter with every run — behavioral constitutions evolve through council-evaluated mutation, and the DNA library is the compounding moat no competitor can replicate without the run history.
**Current focus:** v3.0 Phase 23 — Akasa UI Rebrand Design System Rollout (Plan 7 of 7 — audit complete, visual verification pending)

## Current Position

Phase: 23 of 23 (Akasa UI Rebrand — Design System Rollout)
Plan: 7 of 7 — App-wide compliance audit complete; human visual verification pending
Status: Phase 23, Plan 7 audit complete — 4 compliance checks passed: 0 old CSS tokens, 0 Claw Army brand references, 0 old token definitions in app.css; hex audit passed with all values classified as acceptable exceptions (SVG fills, #fff on violet, Google brand colors); 1 minor: .tok #4ade80 on landing page (no --green token); Task 2 (visual verification) awaiting human sign-off
Last activity: 2026-02-23 — 23-07 compliance audit complete: 4/4 audits pass, all remaining hex values classified (2 min, 0 files modified)

Progress: [██████████] ~100% v3.0 core + Phase 23 audit complete (7/7 plans, visual sign-off pending)

## Performance Metrics

**Velocity:**
- Total plans completed: 51 (v1.0 + v1.1 + v2.0 + v3.0 P01-22 + P23-01 + P23-02 + P23-03 + P23-04 + P23-05 + P23-06 + P23-07)
- Average duration: 4.7 min
- Total execution time: 247 min

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
| Phase 23-akasa-ui-rebrand P02 | 10 min | 2 tasks | 2 files |
| Phase 23-akasa-ui-rebrand P03 | 25 min | 2 tasks | 3 files |
| Phase 23-akasa-ui-rebrand P04 | 3 min | 2 tasks | 2 files |
| Phase 23-akasa-ui-rebrand P05 | 4 min | 2 tasks | 4 files |
| Phase 23-akasa-ui-rebrand P06 | 6 min | 2 tasks | 3 files |
| Phase 23-akasa-ui-rebrand P07 | 2 min | 1 task (audit) | 0 files |

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

- [23-02] new-execution page: took improvement/ui as CSS base + layered v3.0 objectiveId $state/$derived/$effect/hidden-input — both branches modified this file, manual merge required
- [23-02] Execution monitor: kept v3.0 script block entirely (VerdictConfirmPanel, SoulTierBadge, pendingVerdicts, enriched bot cards all postdate improvement/ui branch); replaced style block with Akasa tokens; added missing CSS rules for v3.0-specific elements
- [23-02] Error/alert states use var(--error)/var(--error-dim) not var(--rose) — rose is retirement/soul lifecycle language; error is for form validation and API failure states

- [23-03] SoulTierBadge uses inline-flex (not inline-block) to accommodate Artisan pip span without layout break
- [23-03] Artisan pip added as <span class="pip"> inside SoulTierBadge — animated amber breathe dot for top-tier souls; plan specified adding one if not present
- [23-03] {#each Svelte template syntax creates false-positive hex grep matches — not color values; verified by direct line inspection; actual hex count is 0
- [23-03] Reject button copy changed from "teaches the army" to "teaches the soul" — aligns with Akasa soul lifecycle language

- [23-04] Svelte {#each} template syntax with ?? generates false-positive hex grep matches — not color values; actual hex count is 0 in both files
- [23-04] Leaderboard rows alternate var(--bg-card)/var(--bg-3) with class:row-alt — cleaner than nth-child selector for Svelte
- [23-04] Rank badges use podium colors: amber (1st), violet-bright (2nd), teal (3rd) — maps to Akasa's three primary accent colors
- [23-04] Verdict retire uses var(--rose)/var(--rose-dim) not var(--error) — retire is soul lifecycle language, not a failure state
- [23-04] Soul tier distribution counts use per-tier color classes — allows semantic color per tier without inline styles

- [23-05] Score column in run history table uses var(--amber) — composite score is a soul metric, amber is soul-language
- [23-05] Live panel border: 1px solid var(--teal) — teal border signals active/live state; matches active-indicator pattern
- [23-05] Verdict confirm button uses var(--violet) not var(--teal) — primary action buttons use violet; teal is reserved for liveness/active states
- [23-05] Reject button uses amber treatment (amber-dim background, amber text) — rejection is soul-mechanic correction, not error; amber = intervention language
- [23-05] status-completed badge uses violet-bright/violet-dim — positive outcome maps to violet (signal), not teal (live) or amber (soul)
- [23-05] Verdict type semantic colors: Promote=teal (soul progression), Retire=rose (soul lifecycle end), Demote=amber (soul-mechanic intervention), Monitor/Maintain=violet-dim (administrative)
- [23-05] Severity badge semantic colors: strong=rose (critical soul risk), moderate=amber (intervention needed), weak=text-muted (low priority)

- [23-06] Callout semantic split: callout--violet for product tips (Quick Start, Cost Control, Guardrails), callout--amber for soul/governance language (Army Builder, DNA compounds, Verdicts best practice)
- [23-06] tier-artisan border uses rgba(251,191,36,0.2) opacity amber — Artisan amber border; opacity value cannot be expressed as CSS token
- [23-06] Admin stat-running uses teal border/dim (active/live state) — matches teal=liveness pattern from 23-05
- [23-06] Admin stat-failed uses error border/dim — error is form/API failure language per 23-01 decision
- [23-06] Billing status-completed uses violet-bright/violet-dim — positive outcome maps to violet (signal) not teal (live)
- [23-06] #fff retained for button text on var(--violet) background — no --white token in app.css; universally correct neutral

- [23-07] All 4 compliance audits pass: 0 old CSS tokens, 0 Claw Army brand references, 0 old token definitions in app.css
- [23-07] SVG fill hex values (#a78bfa in logo circles, Google brand colors in Sign-In icon) are acceptable exceptions — CSS vars cannot be used in SVG fill attributes inline
- [23-07] #fff in button/spinner CSS is acceptable exception — no --white token in design system (confirmed 23-06 decision applies app-wide)
- [23-07] .tok { color: #4ade80; } on landing page terminal mockup is only actionable non-tokenized hex — no --green token in app.css; low-priority cosmetic; document as known issue post-launch
- [23-07] Svelte {#each}, href="#...", &#entity patterns are all false-positive hex grep matches — verified by direct line inspection in each case

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
Stopped at: Completed 23-07-PLAN.md — Phase 23, Plan 7 audit complete: 4/4 compliance checks passed (0 old tokens, 0 brand refs, 0 old token defs); all hex values classified; visual sign-off (Task 2) pending human review (2 min, 0 files modified)
Resume file: None
