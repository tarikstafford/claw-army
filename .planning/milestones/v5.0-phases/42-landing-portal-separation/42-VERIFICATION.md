---
phase: 42-landing-portal-separation
verified: 2026-03-04T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to http://localhost:5173/ and confirm the nav shows ONLY logo + Login + Sign up — no Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, or Signals links, and no Platform live status pill"
    expected: "Minimal marketing nav renders with logo, Login button, Sign up button only"
    why_human: "Nav element presence is structurally confirmed in code but correct visual render and absence of portal links requires browser inspection"
  - test: "Navigate to http://localhost:5173/objectives (or any /app route while authenticated) and confirm full nav renders with all 7 management links, Deploy crew button, Platform live status pill, and SSE lifecycle toasts appear on bot events"
    expected: "Full portal nav with Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, Signals, Deploy crew, and Platform live pill"
    why_human: "SSE toast system is code-wired but actual toast appearance on live events requires a running execution"
  - test: "Navigate to http://localhost:5173/, http://localhost:5173/login, and an authenticated portal route — confirm the particle canvas animation renders on all three pages"
    expected: "Animated particle canvas visible in the background on landing, login, and portal pages"
    why_human: "Canvas rendering and animation requires browser and cannot be verified statically"
---

# Phase 42: Landing/Portal Separation Verification Report

**Phase Goal:** Clean visual separation between marketing site and app portal — landing page gets minimal nav (logo + Login/Signup), portal gets the full nav bar with all management links.
**Verified:** 2026-03-04T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All five observable truths are structurally verified in the codebase. Human confirmation is needed only for visual rendering and SSE toast runtime behavior.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Landing page at / shows only logo + Login/Signup nav — no portal links | VERIFIED | `(marketing)/+layout.svelte`: nav-right contains only `<a href="/login">` and `<a href="#access">` — no `.nav-links` ul, no status-pill, no SSE. Grep confirmed zero matches for nav-links, objectives, connectLifecycleSSE in marketing layout. |
| 2 | Portal pages show full nav with all management links + Deploy crew button + SSE toasts | VERIFIED | `(app)/+layout.svelte`: `.nav-links` ul with 7 links (Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, Signals), status-pill, Deploy crew button conditioned on session, `connectLifecycleSSE` wired in `$effect`, full toast HTML present |
| 3 | All existing routes remain accessible at the same URLs — no 404s | VERIFIED | SvelteKit route groups `(marketing)/` and `(app)/` do not affect URL structure. All 10 portal route dirs confirmed present in `(app)/`: objectives, executions, souls, guide, verdicts, billing, category-benchmarks, negative-signals, new-execution, admin. Marketing files confirmed at `(marketing)/+page.svelte`, `(marketing)/login/+page.svelte`. |
| 4 | Particle canvas renders on both landing and portal pages | VERIFIED | `ParticleCanvas.svelte` exists at `services/ui/src/lib/components/ParticleCanvas.svelte` with `class Particle` (97 lines, substantive). Imported and rendered as `<ParticleCanvas />` in both `(marketing)/+layout.svelte` (line 24) and `(app)/+layout.svelte` (line 67). |
| 5 | Session data is only loaded for portal routes, not the landing page | VERIFIED | `(app)/+layout.server.ts` exports `load` with `event.locals.auth()`. Root `+layout.server.ts` does NOT exist — confirmed absent. `(marketing)/+layout.svelte` has no `data` prop and no session reference. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/ui/src/lib/components/ParticleCanvas.svelte` | Reusable particle canvas animation component | VERIFIED | 97 lines, contains `class Particle`, `onMount` animation loop, canvas element, `:global(canvas#particles)` scoped styles |
| `services/ui/src/routes/(marketing)/+layout.svelte` | Minimal marketing nav layout (logo + Login/Signup) | VERIFIED | 151 lines, imports ParticleCanvas, renders minimal nav with Login and Sign up only — no portal links |
| `services/ui/src/routes/(app)/+layout.svelte` | Full portal nav layout with SSE toasts | VERIFIED | 331 lines, imports connectLifecycleSSE, full 7-link nav, SSE effect, toast HTML and styles all present |
| `services/ui/src/routes/(app)/+layout.server.ts` | Session load for portal routes only | VERIFIED | 7 lines, exports `load` function, calls `event.locals.auth()`, returns `{ session }` |
| `services/ui/src/routes/+layout.svelte` | Bare root shell — only renders children | VERIFIED | 5 lines exactly: script with `$props()` and `{@render children()}` — no nav, no CSS, no SSE |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(app)/+layout.svelte` | `(app)/+layout.server.ts` | `data.session` from layout server load | WIRED | Line 11: `let session = $derived(data.session)` — session derived from data prop, used in nav conditionals `{#if session?.user}` at line 108 |
| `(marketing)/+layout.svelte` | `$lib/components/ParticleCanvas.svelte` | component import | WIRED | Line 3: `import ParticleCanvas from '$lib/components/ParticleCanvas.svelte'` — rendered at line 24 as `<ParticleCanvas />` |
| `(app)/+layout.svelte` | `$lib/sse` | SSE lifecycle connection | WIRED | Line 6: `import { connectLifecycleSSE } from '$lib/sse'` — called in `$effect` at line 27: `const cleanup = connectLifecycleSSE(addNotification)` |

All 3 key links: WIRED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PORTAL-01 | 42-01-PLAN.md | Clean visual separation between marketing site and app portal | SATISFIED | Two SvelteKit route groups created: `(marketing)/` with minimal nav (logo + Login/Signup only), `(app)/` with full portal nav (7 links + Deploy crew + SSE toasts). Session load scoped to portal group. Verified structurally in all relevant files. |

Note: No `.planning/REQUIREMENTS.md` file exists in this project. The requirement `PORTAL-01` is described directly in the ROADMAP.md phase entry as "Clean visual separation between marketing site and app portal" and is satisfied by the implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODOs, FIXMEs, placeholders, empty implementations, or stale console.log-only handlers found in any phase-modified file.

### Human Verification Required

#### 1. Marketing Nav Visual Confirmation

**Test:** Start `pnpm --filter @claw/ui dev`, navigate to `http://localhost:5173/`
**Expected:** Nav shows logo, Login button, and Sign up button only — no Objectives, Guide, Verdicts, Billing, Souls, Benchmarks, Signals links and no "Platform live" status pill
**Why human:** The absence of portal nav items is verified in the template source, but correct rendering in the browser (including CSS visibility and no inadvertent global styles bleeding in) requires visual confirmation

#### 2. Portal Nav and SSE Toast Confirmation

**Test:** Navigate to `http://localhost:5173/objectives` while authenticated
**Expected:** Full nav bar with all 7 management links visible, "Deploy crew" button present, "Platform live" status pill visible; when a bot lifecycle event occurs, a toast notification slides in from the right
**Why human:** The SSE toast system is fully wired in code but actual toast appearance depends on live SSE events from a running execution service — cannot be triggered statically

#### 3. Particle Canvas Render on Both Route Groups

**Test:** Visit `http://localhost:5173/` and `http://localhost:5173/objectives` and observe background
**Expected:** Animated particle canvas (purple/amber/teal particles floating upward) renders in the background on both pages
**Why human:** Canvas animation requires a live browser environment to verify

### Gaps Summary

No gaps. All five observable truths are structurally verified. All three key links are wired. The single requirement PORTAL-01 is satisfied. All artifacts exist, are substantive, and are connected.

The three human verification items relate to visual rendering and SSE runtime behavior — standard items that require a browser and cannot be verified programmatically. They do not indicate missing or broken code.

---

_Verified: 2026-03-04T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
