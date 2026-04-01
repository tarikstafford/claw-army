---
phase: 12-human-confirmation-gate
plan: "02"
subsystem: ui
tags: [sveltekit, svelte5, runes, confirmation-gate, anti-rubber-stamp, calibration]

# Dependency graph
requires:
  - phase: 12-human-confirmation-gate/12-01
    provides: Fastify verdicts API with 5 endpoints (pending, single, confirm, reject, calibration)
  - phase: 07-google-auth-gate
    provides: session object with user.email via SvelteKit Auth.js

provides:
  - /verdicts inbox page listing pending Promote/Retire verdicts with type badges, confidence scores, and calibration warning
  - /verdicts/[verdictId] detail page with evidence-first rendering (CONF-02), equal-weight confirm/reject buttons (CONF-03), and time-on-screen tracking (CONF-04)
  - PendingVerdict, VerdictDetail, CalibrationData TypeScript interfaces in types.ts
  - 5 API helpers in api.ts: getPendingVerdicts, getVerdict, confirmVerdict, rejectVerdict, getCalibration
  - Calibration warning banner when confirmation rate exceeds 95% over 10+ verdicts
  - Verdicts nav link in global layout

affects: [13-god-layer, 14-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Svelte 5 runes ($state, $derived, $effect) for reactive page state
    - evidenceLoaded gate — action buttons only rendered after evidence state is truthy (CONF-02)
    - arrivedAt timestamp on mount + timeOnScreenMs calculated at submit time (CONF-04)
    - $effect auto-refresh with setInterval(fn, 15_000) + cleanup return value
    - Equal-weight button styling: both buttons use flex:1 + identical padding/font-size/border-width, differing only in color

key-files:
  created:
    - services/ui/src/routes/verdicts/+page.svelte
    - services/ui/src/routes/verdicts/[verdictId]/+page.svelte
  modified:
    - services/ui/src/lib/types.ts
    - services/ui/src/lib/api.ts
    - services/ui/src/routes/+layout.svelte

key-decisions:
  - "evidenceLoaded flag is set after getVerdict() resolves — action buttons are not in the DOM until evidence renders, enforcing CONF-02 at the Svelte template level"
  - "arrivedAt = Date.now() on mount; timeOnScreenMs = Date.now() - arrivedAt at the moment the operator clicks — captures actual reading time, not time until page loaded"
  - "Calibration warning uses amber color scheme (#fbbf24 text, #1a1100 bg, #92400e border) visually distinct from error (red) and info (blue) to signal behavioral feedback, not failure"
  - "Reject button labeled 'Reject — Your feedback teaches the army' per CONF-03; both buttons have flex:1 so neither dominates visual weight"
  - "Auto-refresh via setInterval(loadData, 15_000) on /verdicts page — operators see new verdicts without manual reload"

patterns-established:
  - "Evidence-before-controls: {#if evidenceLoaded && verdict.status === 'pending'} gates all action UI — never gate on loading state alone"
  - "Equal-weight action buttons: both filled (never ghost), same structural CSS, color-only differentiation for accept vs reject"

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 12 Plan 02: Human Confirmation Gate UI Summary

**Svelte 5 operator confirmation UI with evidence-gated action buttons, equal-weight reject button, arrivedAt time tracking, and calibration warning banner — satisfying CONF-02, CONF-03, and CONF-04**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T02:35:07Z
- **Completed:** 2026-02-22T02:40:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 5

## Accomplishments

- Added `PendingVerdict`, `VerdictDetail`, and `CalibrationData` TypeScript interfaces and 5 verdict API helper functions following the existing `apiFetch` pattern
- Built `/verdicts` inbox page with verdict type badges (Promote=green, Retire=red), confidence score percentages, devil's advocate warning flags, 15-second auto-refresh, and amber calibration warning banner when `warningTriggered === true`
- Built `/verdicts/[verdictId]` detail page that gates confirm/reject buttons behind `evidenceLoaded` flag (set after API response), tracks time-on-screen via `arrivedAt = Date.now()` on mount, and labels reject as "Reject — Your feedback teaches the army" at equal visual weight to confirm
- Human operator verified UI layout, evidence ordering, and button parity in browser (Task 3 checkpoint approved)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add verdict types to types.ts and API helpers to api.ts** - `67d724c` (feat)
2. **Task 2: Create /verdicts page, /verdicts/[verdictId] detail page, and add nav link** - `1d8a032` (feat)
3. **Task 3: Verify confirmation gate UI in browser** - human-verify checkpoint (approved by operator — no code commit)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified

- `services/ui/src/lib/types.ts` - Added PendingVerdict, VerdictDetail, CalibrationData interfaces
- `services/ui/src/lib/api.ts` - Added getPendingVerdicts, getVerdict, confirmVerdict, rejectVerdict, getCalibration helpers
- `services/ui/src/routes/+layout.svelte` - Added "Verdicts" nav link before Billing
- `services/ui/src/routes/verdicts/+page.svelte` - New: operator inbox with calibration warning and auto-refresh
- `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` - New: evidence-first detail page with equal-weight action buttons

## Decisions Made

- `evidenceLoaded` flag set after `getVerdict()` resolves — action buttons not in DOM until evidence renders, enforcing CONF-02 at template level rather than relying on CSS visibility
- `arrivedAt = Date.now()` on mount; `timeOnScreenMs = Date.now() - arrivedAt` calculated at click time — captures actual reading time including any scrolling delay, not just time-to-load
- Calibration warning uses amber color scheme visually distinct from error (red) and info (blue) — signals behavioral feedback, not system failure
- Reject button labeled "Reject — Your feedback teaches the army" per CONF-03; both buttons use `flex: 1` so neither dominates visual weight (equal-weight requirement met structurally, not just by CSS)
- Auto-refresh via `setInterval(loadData, 15_000)` in `$effect` with cleanup return value — operators see new verdicts without manual reload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The UI routes consume the existing `/verdicts/*` endpoints established in Plan 01.

## Next Phase Readiness

- Full human confirmation gate (CONF-01 through CONF-04) is implemented: API (Plan 01) + UI (Plan 02) are both complete
- Phase 13 (God Layer) can now rely on `council_verdicts.status` = `confirmed` or `rejected` to gate Promote/Retire outcomes — operators have the tooling to drive that transition
- Phase 14 UI polish can reference the verdict pages for style consistency patterns

## Self-Check: PASSED

All files and commits verified:
- FOUND commit: 67d724c (Task 1 — types and api helpers)
- FOUND commit: 1d8a032 (Task 2 — verdicts pages and nav link)
- FOUND: services/ui/src/routes/verdicts/+page.svelte
- FOUND: services/ui/src/routes/verdicts/[verdictId]/+page.svelte
- FOUND: .planning/phases/12-human-confirmation-gate/12-02-SUMMARY.md

---
*Phase: 12-human-confirmation-gate*
*Completed: 2026-02-22*
