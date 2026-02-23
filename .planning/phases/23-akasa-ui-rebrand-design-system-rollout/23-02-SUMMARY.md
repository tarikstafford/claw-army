---
phase: 23-akasa-ui-rebrand-design-system-rollout
plan: 02
subsystem: ui
tags: [svelte, css-tokens, akasa, rebrand, design-system]

# Dependency graph
requires:
  - phase: 23-01
    provides: Akasa CSS token system in app.css, layout shell, landing + login pages rebranded
  - phase: 21-01
    provides: objectiveId URL param + hidden input + $effect pre-fill logic in new-execution page
  - phase: 19-02
    provides: VerdictConfirmPanel integration in execution monitor
  - phase: 18-02
    provides: SoulTierBadge integration on bot cards in execution monitor
provides:
  - new-execution page with Akasa dark theme and full objectiveId URL param logic (state, derived, effect, hidden input)
  - Execution monitor page with Akasa dark theme retaining VerdictConfirmPanel, SoulTierBadge, enriched bot cards
affects:
  - 23-03 (next rebrand plan — bot detail, report, or other pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "improvement/ui CSS base + v3.0 script/template selective merge: take Akasa styles from improvement/ui, keep v3.0 logic additions"
    - "error states use var(--error) / var(--error-dim) tokens (not --rose which is retirement-only)"
    - "status pills use Akasa semantic colors: teal=working, violet=idle, amber=spawning, rose=failed, transparent=stopped"

key-files:
  created: []
  modified:
    - services/ui/src/routes/new-execution/+page.svelte
    - services/ui/src/routes/executions/[id]/+page.svelte

key-decisions:
  - "[23-02] new-execution: took improvement/ui as CSS base, added v3.0 objectiveId $state/$derived/$effect/hidden-input on top — both branches modified this file, manual merge required"
  - "[23-02] execution monitor: kept v3.0 script block entirely (VerdictConfirmPanel, SoulTierBadge, pendingVerdicts, bot enrichments post-date improvement/ui branch); replaced style block wholesale with Akasa tokens from improvement/ui"
  - "[23-02] error/alert CSS uses var(--error)/var(--error-dim) not var(--rose) — rose is retirement language; error is form validation and API failure language (consistent with 23-01 decision)"
  - "[23-02] bot-failed border uses var(--error) accent, not rose — error=red failure, rose=retirement/soul lifecycle"

patterns-established:
  - "Pattern: For pages where both branches diverged, take improvement/ui CSS + v3.0 script/template when v3.0 has post-branch additions"
  - "Pattern: Army Builder Analysis CSS updated from old fallback tokens to clean Akasa tokens (no fallback hex values)"

# Metrics
duration: 10min
completed: 2026-02-23
---

# Phase 23 Plan 02: Execution Pages Rebrand Summary

**Akasa-themed new-execution form (objectiveId URL param merge) and execution monitor (VerdictConfirmPanel + SoulTierBadge + enriched bot cards) — completing the improvement/ui selective-merge work.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-23T03:15:28Z
- **Completed:** 2026-02-23T03:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- new-execution page now uses full Akasa design system (var(--violet), var(--bg-card), var(--font-*), etc.) while retaining all v3.0 objectiveId URL param logic (urlObjectiveId $derived, urlMaxBots, urlBudgetCapDollars, $effect pre-fill, hidden input forwarding)
- Execution monitor page now uses Akasa design system while retaining all Phase 18-19 enrichments: SoulTierBadge on bot cards, SoulInspectorPanel, VerdictConfirmPanel inline verdicts, currentTaskDescription, toolCallCount, tokenBurnRate display
- Both pages updated from "Claw Army" to "Akasa" brand in title tags
- Army Builder Analysis section in new-execution updated from old fallback tokens to clean Akasa tokens
- Zero old tokens (--signal, --surface-*, --text-primary, hardcoded hex) in either file

## Task Commits

1. **Task 1: Merge new-execution page — Akasa styles + objectiveId logic** - `2d95c02` (feat)
2. **Task 2: Replace execution monitor page with improvement/ui version** - `6c55510` (feat)

## Files Created/Modified
- `services/ui/src/routes/new-execution/+page.svelte` - Akasa-styled mission briefing form with objectiveId URL param support, Army Builder Analysis with Akasa tokens
- `services/ui/src/routes/executions/[id]/+page.svelte` - Akasa-styled execution monitor with full v3.0 feature set intact

## Decisions Made
- new-execution page: took improvement/ui as the CSS base (proper Akasa tokens throughout), then layered in the v3.0 objectiveId $state/$derived/$effect and the hidden `<input>` — both branches modified this file and a raw git merge would have conflicted
- Execution monitor: kept v3.0 script block entirely since VerdictConfirmPanel, SoulTierBadge, pendingVerdicts polling, and bot card enrichments all postdate the improvement/ui branch. Replaced the style block wholesale and added missing Akasa-styled rules for the v3.0-specific elements (bot-failed, bot-task-desc, bot-live-stats, inspect-soul-btn, verdict-pending-btn)
- Error/alert states: used var(--error)/var(--error-dim) consistently — not var(--rose) which is retirement/soul lifecycle language per 23-01 decision

## Deviations from Plan

None - plan executed exactly as written. The plan correctly anticipated the two merge strategies (objectiveId additive merge for new-execution, CSS-only replacement with v3.0 script retention for execution monitor).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All improvement/ui selective-merge work is now complete (layout, landing, login, new-execution, execution monitor all Akasa-themed)
- Remaining rebrand work (Plans 03-07) is net-new restyling against pages never touched in improvement/ui: bot detail, report, guide, admin, billing, objectives, verdicts, components
- Next plan should tackle the most impactful pages for user-visible quality (bot detail or report page)

## Self-Check: PASSED

- FOUND: `services/ui/src/routes/new-execution/+page.svelte`
- FOUND: `services/ui/src/routes/executions/[id]/+page.svelte`
- FOUND: `.planning/phases/23-akasa-ui-rebrand-design-system-rollout/23-02-SUMMARY.md`
- FOUND commit: `2d95c02` feat(23-02): Akasa-style new-execution page with objectiveId logic
- FOUND commit: `6c55510` feat(23-02): Akasa-style execution monitor with all v3.0 features intact

---
*Phase: 23-akasa-ui-rebrand-design-system-rollout*
*Completed: 2026-02-23*
