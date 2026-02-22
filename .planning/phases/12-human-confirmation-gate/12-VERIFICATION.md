---
phase: 12-human-confirmation-gate
verified: 2026-02-22T02:48:47Z
status: human_needed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /verdicts in browser and inspect visual rendering"
    expected: "Pending Verdicts page renders with verdict type badges, confidence scores, summary text, and DA warning flags"
    why_human: "CSS rendering and visual consistency with existing admin pages cannot be verified programmatically"
  - test: "Click a Promote or Retire verdict card and inspect the detail page"
    expected: "Evidence section (DA challenges or performance evidence) renders BEFORE the confirm/reject buttons appear; both buttons are equal height, padding, and visual weight"
    why_human: "DOM ordering and visual equality of equal-weight buttons (CONF-02, CONF-03) requires browser inspection"
  - test: "Verify reject button label in browser"
    expected: "Reject button reads exactly: 'Reject — Your feedback teaches the army'"
    why_human: "Typography rendering and exact label text confirmed by reading source but button layout needs visual verification"
  - test: "Confirm calibration warning banner appears"
    expected: "When confirmation rate exceeds 95% across 10+ verdicts, an amber banner appears above the verdict list with percentage and behavioral coaching text"
    why_human: "Requires test data in the database to trigger warningTriggered=true from the calibration endpoint"
---

# Phase 12: Human Confirmation Gate Verification Report

**Phase Goal:** Promote and Retire verdicts are gated behind an operator confirmation step before the God Layer acts — the gate is built to resist rubber-stamping from launch, not as a future hardening pass.
**Verified:** 2026-02-22T02:48:47Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Plan 01 — Backend API)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /verdicts/pending returns only Promote and Retire verdicts with status=pending | VERIFIED | `verdicts.ts` line 38–44: `inArray(['Promote','Retire'])` + `eq(status,'pending')` with `.orderBy(createdAt)` |
| 2 | POST /verdicts/:id/confirm transitions pending→confirmed with confirmedAt, confirmedBy, timeOnScreenMs | VERIFIED | `verdicts.ts` lines 128–153: atomic UPDATE sets `status:'confirmed'`, `confirmedAt:new Date()`, `confirmedBy:userId`, `timeOnScreenMs` |
| 3 | POST /verdicts/:id/reject transitions pending→rejected | VERIFIED | `verdicts.ts` lines 174–198: atomic UPDATE sets `status:'rejected'`, `confirmedBy:userId`, `timeOnScreenMs` (no confirmedAt — correct per decision) |
| 4 | Confirming or rejecting an already-resolved verdict returns 409 Conflict | VERIFIED | Both confirm and reject use `.returning({id})` — 0 rows → `reply.code(409).send({error:'Verdict already resolved...'})` |
| 5 | GET /verdicts/calibration returns per-user confirmation rate with warningTriggered flag | VERIFIED | `verdicts.ts` lines 200–234: queries by `confirmedBy=userId`, filters `['confirmed','rejected']`, computes rate, `warningTriggered = total >= 10 && rate > 0.95` |
| 6 | Maintain, Monitor, and Demote verdicts never appear in the pending list | VERIFIED | `inArray(councilVerdicts.verdictType, ['Promote', 'Retire'])` whitelist — all other types excluded by constraint |

### Observable Truths (Plan 02 — UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 7 | Operator sees a Verdicts nav link that navigates to /verdicts | VERIFIED | `+layout.svelte` line 20: `<a href="/verdicts" class="nav-link">Verdicts</a>` in `.nav-right` div |
| 8 | The /verdicts page shows list of pending Promote/Retire verdicts with type, bot ID, confidence, summary | VERIFIED | `+page.svelte` lines 74–95: each verdict renders type badge, bot ID (sliced), confidence %, summary (truncated 120) |
| 9 | Clicking a verdict navigates to /verdicts/[verdictId] which shows full evidence before action buttons | VERIFIED | `[verdictId]/+page.svelte` lines 110–168: evidence section rendered at line 110, action buttons gated at line 147 with `{#if evidenceLoaded && verdict.status === 'pending'}` |
| 10 | Reject carries the label "Reject — Your feedback teaches the army" | VERIFIED | `[verdictId]/+page.svelte` line 154: exact label text present |
| 11 | Time-on-screen tracked from mount and sent with confirm/reject POST | VERIFIED | `arrivedAt = $state(0)` set on mount at line 22 (`arrivedAt = Date.now()`); `timeOnScreenMs = Date.now() - arrivedAt` computed at click time in both `doConfirm` (line 40) and `doReject` (line 54) |
| 12 | Calibration warning banner appears when operator confirmed more than 95% of 10+ verdicts | VERIFIED | `+page.svelte` lines 59–64: `{#if calibration?.warningTriggered}` renders amber banner with percentage text |
| 13 | Operator email from session is sent as userId in confirm/reject calls | VERIFIED | `userId = $derived(data.session?.user?.email ?? 'operator')` at line 18; passed as `{userId, timeOnScreenMs}` in both confirm/reject calls |

**Score:** 13/13 truths verified (automated checks)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/council-verdicts.ts` | timeOnScreenMs nullable integer column | VERIFIED | Line 50: `timeOnScreenMs: integer('time_on_screen_ms')` with comment `// nullable, no default` |
| `packages/db/migrations/0006_add_time_on_screen_ms.sql` | Single ALTER TABLE ADD COLUMN | VERIFIED | Single line: `ALTER TABLE "council_verdicts" ADD COLUMN "time_on_screen_ms" integer;` |
| `packages/db/migrations/meta/_journal.json` | Tag updated to 0006_add_time_on_screen_ms | VERIFIED | Entry idx:6 tag is `0006_add_time_on_screen_ms` |
| `services/execution-service/src/routes/verdicts.ts` | Fastify plugin with 5 endpoints | VERIFIED | Exports `verdictsRoutes`; implements GET /pending, GET /:verdictId, POST /:verdictId/confirm, POST /:verdictId/reject, GET /calibration |
| `services/execution-service/src/app.ts` | verdictsRoutes registered at /verdicts | VERIFIED | Line 11 import + line 40: `app.register(verdictsRoutes, { prefix: '/verdicts' })` |
| `services/ui/src/lib/types.ts` | PendingVerdict, VerdictDetail, CalibrationData interfaces | VERIFIED | Lines 132–176: all three interfaces present with correct fields |
| `services/ui/src/lib/api.ts` | 5 verdict API helpers | VERIFIED | Lines 92–126: getPendingVerdicts, getVerdict, confirmVerdict, rejectVerdict, getCalibration — all use `apiFetch` through `${BASE}/verdicts/*` |
| `services/ui/src/routes/verdicts/+page.svelte` | Operator inbox with calibration warning | VERIFIED | 259 lines; contains verdict-grid, calibration-warning block, 15s auto-refresh |
| `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` | Evidence-gated detail page with equal-weight buttons | VERIFIED | 517 lines; evidenceLoaded gate at line 147; arrivedAt tracking; reject/confirm buttons both use `.action-btn` base class with `flex:1` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `services/execution-service/src/routes/verdicts.ts` | `@claw/db councilVerdicts` | drizzle-orm select/update | WIRED | `import { db, councilVerdicts } from '@claw/db'` at line 3; `councilVerdicts` used in all 5 route handlers |
| `services/execution-service/src/app.ts` | `verdicts.ts` | `app.register(verdictsRoutes, { prefix: '/verdicts' })` | WIRED | Import at line 11, registration at line 40 with correct prefix |
| `services/ui/src/lib/api.ts` | `/api/verdicts/*` | `apiFetch` through SvelteKit proxy | WIRED | All 5 helpers call `${BASE}/verdicts/...`; SvelteKit catch-all proxy at `routes/api/[...path]/+server.ts` forwards to execution service |
| `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` | `api.ts` confirmVerdict/rejectVerdict | calls with `{userId, timeOnScreenMs}` | WIRED | Lines 41 and 55: `confirmVerdict(verdictId, {userId, timeOnScreenMs})` and `rejectVerdict(verdictId, {userId, timeOnScreenMs})` |
| `services/ui/src/routes/+layout.svelte` | `/verdicts` | nav-link anchor element | WIRED | Line 20: `<a href="/verdicts" class="nav-link">Verdicts</a>` |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| CONF-01: Only Promote/Retire require human gate | SATISFIED | Backend guards by `inArray(['Promote','Retire'])` in WHERE clause; Maintain/Monitor/Demote never enter the pending queue |
| CONF-02: Evidence renders before action controls | SATISFIED | `{#if evidenceLoaded && verdict.status === 'pending'}` — buttons are not in the DOM until evidence API call resolves |
| CONF-03: Reject has equal visual weight with learning framing | SATISFIED (needs human confirm) | Both buttons share identical `.action-btn` base CSS (same padding, font-size, font-weight, border-width, `flex:1`); reject label is "Reject — Your feedback teaches the army" |
| CONF-04: Time-on-screen tracked, calibration warning at >95% | SATISFIED | `arrivedAt` set on mount; `timeOnScreenMs` sent in POST body; `warningTriggered = total >= 10 && rate > 0.95` |

### Anti-Patterns Found

No anti-patterns detected. Grep scan of all 5 key files returned no matches for:
- TODO/FIXME/PLACEHOLDER/HACK
- `return null`, `return {}`, `return []`
- Console.log only implementations
- Empty handlers

### Human Verification Required

#### 1. Visual rendering of verdicts inbox

**Test:** Start the UI dev server (`cd services/ui && npm run dev`), navigate to http://localhost:5173 while logged in, click "Verdicts" in the nav bar.
**Expected:** Pending Verdicts page renders with amber type badges (Promote=green, Retire=red), bot ID (first 8 chars), confidence score as percentage, summary text truncated at 120 chars, and a DA warning flag for any verdict with `hasUnresolvedDevilsAdvocate=true`.
**Why human:** CSS rendering and visual fidelity to existing admin page patterns cannot be verified from source alone.

#### 2. Evidence-before-controls ordering (CONF-02)

**Test:** Click into any Promote or Retire verdict on the detail page and observe the page render sequence.
**Expected:** The verdict summary, Devil's Advocate challenges (if any), Performance Evidence, and Soul Analysis all render fully visible before the confirm/reject button row appears at the bottom of the page.
**Why human:** While the `{#if evidenceLoaded}` gate is verified in source, the actual DOM render order and visual scroll position relative to buttons requires human inspection.

#### 3. Equal-weight button appearance (CONF-03)

**Test:** On the /verdicts/[verdictId] detail page, compare the confirm and reject buttons visually.
**Expected:** Both buttons are the same height, same padding, same font size — neither is a ghost/outline-only button. Reject uses an amber/dark fill (#92400e background), confirm uses a blue fill (#3d7eff). Reject label reads exactly "Reject — Your feedback teaches the army".
**Why human:** The CSS `flex:1` and identical base class are verified, but actual rendered dimensions and visual parity require browser inspection.

#### 4. Calibration warning with live data

**Test:** Create test data where a user has confirmed 10+ verdicts with >95% confirmation rate, then load the /verdicts page.
**Expected:** An amber banner appears above the verdict list reading "Calibration Notice: You have confirmed X of Y verdicts (Z%). A high confirmation rate may indicate rubber-stamping. Consider reviewing evidence more carefully."
**Why human:** Requires real or seeded database records to trigger `warningTriggered=true` from the calibration endpoint.

### Gaps Summary

No gaps. All 13 automated must-have checks pass. The phase delivered:

1. A complete Fastify API (5 endpoints) with atomic idempotency guards using `.returning()` — the confirm/reject guard pattern (`WHERE status=pending AND verdictType IN ('Promote','Retire')`) is substantive and correct.

2. A complete SvelteKit UI (2 new pages + layout update + types + API helpers) that implements all anti-rubber-stamp controls: evidence-before-controls gating via `evidenceLoaded` flag, equal-weight buttons with `flex:1`, time-on-screen tracking via `arrivedAt = Date.now()` on mount, and calibration warning banner.

3. A proper database migration (`0006_add_time_on_screen_ms.sql`) and journal entry rename following established project conventions.

The four human verification items are confirmations of visual behavior, not gaps — the underlying source code implements each requirement correctly.

---

_Verified: 2026-02-22T02:48:47Z_
_Verifier: Claude (gsd-verifier)_
