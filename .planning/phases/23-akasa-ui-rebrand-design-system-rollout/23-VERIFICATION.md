---
phase: 23-akasa-ui-rebrand-design-system-rollout
verified: 2026-02-23T04:57:17Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
human_verification:
  - test: "Visit all 13 routes in the running dev app and confirm dark Akasa theme renders correctly"
    expected: "Every page — /, /login, /new-execution, /executions/[id], /executions/[id]/bots/[botId], /executions/[id]/report, /objectives, /objectives/[id], /verdicts, /verdicts/[verdictId], /guide, /admin, /billing — renders with the dark violet Akasa theme, no broken CSS variables, no bright-white panels"
    why_human: "Visual rendering, font display (Clash Display vs Inter vs system fallback), aurora blob animation, particle canvas, and frosted nav glass effect cannot be verified by grep"
  - test: "Confirm soul tier badge visual on execution monitor: Artisan badge shows amber breathing glow"
    expected: "Artisan badges use amber color with a pulsing/breathing animation; Understudy badges teal; Novice muted; Retired rose"
    why_human: "CSS animation (breathe keyframe) behavior cannot be verified programmatically"
  - test: "Confirm particle canvas renders behind the nav on all pages"
    expected: "Subtle floating particles (violet, amber, teal colors) visible in the background; nav frosted glass activates on scroll past 40px"
    why_human: "Canvas rendering and scroll-triggered class toggle require browser verification"
---

# Phase 23: Akasa UI Rebrand — Design System Rollout Verification Report

**Phase Goal:** Merge the Akasa brand from improvement/ui and apply the design system to every page in the platform — dark violet theme, CSS custom properties, soul-concept amber accents — so the full app presents a unified, production-ready look.

**Verified:** 2026-02-23T04:57:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Akasa CSS token system (--bg, --violet, --amber, --teal, --rose, --error) defined in app.css with zero old tokens | VERIFIED | app.css lines 3–48: all 28 tokens present. Zero old tokens (--canvas, --signal, --surface-*, --text-primary, --critical) found by grep across all .svelte files |
| 2 | Every page loads Clash Display, Inter, and JetBrains Mono fonts via layout svelte:head | VERIFIED | +layout.svelte lines 143–147: preconnect + googleapis + fontshare links confirmed |
| 3 | Nav bar shows Akasa logo with particle canvas background, frosted glass on scroll, objectives link | VERIFIED | +layout.svelte: `Akasa` logo text (line 173), objectives nav link (line 177), `window.scrollY > 40` stuck toggle (line 107), particle canvas loop (lines 111–138) |
| 4 | Landing page renders full Akasa hero with aurora blobs, glitch text, scroll-reveal sections | VERIFIED | +page.svelte lines 24–56: aurora div, hero section, `.glitch glitch-soul` span confirmed |
| 5 | Login page shows Akasa brand (not Claw Army) | VERIFIED | login/+page.svelte: `Sign In | Akasa` title (line 6), `Akasa` brand name (line 29), zero Claw Army matches |
| 6 | All 13 route pages use only Akasa CSS tokens — zero old tokens, zero Claw Army brand references | VERIFIED | grep across all .svelte files: 0 old token matches, 0 Claw Army matches, all 13 pages confirmed using var(--) tokens |
| 7 | Soul-concept elements use amber accents exclusively | VERIFIED (programmatic) / UNCERTAIN (visual) | SoulTierBadge.svelte line 31: Artisan=var(--amber); VerdictConfirmPanel.svelte lines 51–53: Promote=teal, Retire=rose, Demote=amber; amber confirmed in layout soul notifications (lines 100, 102) |

**Score:** 6/7 truths fully verified programmatically. 1 truth (amber/soul visual rendering) passes code-level checks but requires human visual confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/ui/src/app.css` | Akasa token system with --error token | VERIFIED | 28 CSS custom properties in :root block; --violet: #7c3aed (line 19); --error: #f87171 (line 38); --error-dim (line 39); all utility classes (glitch, breathe, .r scroll-reveal, sec-label) present |
| `services/ui/src/routes/+layout.svelte` | Akasa nav + particle canvas + font loading | VERIFIED | Clash Display loaded (line 146); particle system (130 particles, lines 1–53 module scope); Particle class at module scope; frosted-glass .stuck toggle; Objectives/Guide/Verdicts/Billing nav links; @render children() (line 214) |
| `services/ui/src/routes/+page.svelte` | Akasa landing page | VERIFIED | Title "Akasa — Where agents enrich their souls"; aurora blobs; glitch text with data-text="soul."; scroll-reveal .r/.on IntersectionObserver |
| `services/ui/src/routes/login/+page.svelte` | Akasa login page | VERIFIED | "Sign In | Akasa" title; "Akasa" brand text; dark card with var(--bg-card); violet accents; Google OAuth integration retained |
| `services/ui/src/routes/new-execution/+page.svelte` | Akasa-styled execution launch form with objectiveId support | VERIFIED | objectiveId $state (line 23), urlObjectiveId $derived (line 25), $effect pre-fill (line 31), hidden input (line 93); 102 var(--) uses |
| `services/ui/src/routes/executions/[id]/+page.svelte` | Akasa-styled execution monitor | VERIFIED | SoulTierBadge imported (line 8); VerdictConfirmPanel imported (line 9); SoulInspectorPanel imported (line 7); 87 var(--) uses; zero old tokens |
| `services/ui/src/lib/components/SoulTierBadge.svelte` | Dark-mode soul tier badge with Akasa colors | VERIFIED | Artisan=var(--amber) (line 31); breathe animation pip (line 38); Understudy=var(--teal) (line 30); zero hex values |
| `services/ui/src/lib/components/SoulInspectorPanel.svelte` | Dark-mode soul inspector drawer | VERIFIED | var(--bg-card) (line 242); Artisan=var(--amber) (line 65); Demote=var(--amber) (line 77); zero hex values in lib components |
| `services/ui/src/lib/components/VerdictConfirmPanel.svelte` | Dark-mode verdict confirmation panel | VERIFIED | var(--bg-card) (line 176); Promote=var(--teal) (line 51); Retire=var(--rose) (line 52); Demote=var(--amber) (line 53); rose confirm/reject buttons |
| `services/ui/src/routes/executions/[id]/bots/[botId]/+page.svelte` | Akasa-styled bot detail page | VERIFIED | SoulTierBadge imported (line 8); var(--bg-card) used (line 423); 87 var(--) uses |
| `services/ui/src/routes/executions/[id]/report/+page.svelte` | Akasa-styled execution report page | VERIFIED | SoulTierBadge imported (line 7); used at lines 92, 96, 100, 105, 167; var(--bg-card) (line 288); 88 var(--) uses |
| `services/ui/src/routes/objectives/+page.svelte` | Akasa-styled objectives list | VERIFIED | var(--bg-card) (line 149); var(--violet-bright) (line 169); 42 var(--) uses |
| `services/ui/src/routes/objectives/[id]/+page.svelte` | Akasa-styled objective detail | VERIFIED | Launch button href includes `?objectiveId={objectiveId}&maxBots=...` (line 115); var(--bg-card) used; 77 var(--) uses |
| `services/ui/src/routes/verdicts/+page.svelte` | Akasa-styled verdicts list | VERIFIED | var(--bg-card) (line 187); var(--amber-dim) for Demote verdict (line 144); 32 var(--) uses |
| `services/ui/src/routes/verdicts/[verdictId]/+page.svelte` | Akasa-styled verdict detail | VERIFIED | var(--violet-bright) (line 218); var(--bg-card) (line 288); 62 var(--) uses |
| `services/ui/src/routes/guide/+page.svelte` | Akasa-styled guide ("Akasa" brand not "Claw Army") | VERIFIED | "How Akasa works" heading (line 10); "Akasa turns a plain-language objective..." (line 42); var(--bg-card) used 5+ times; 239 var(--) uses |
| `services/ui/src/routes/admin/+page.svelte` | Akasa-styled admin panel | VERIFIED | var(--bg-card) (line 226); var(--error) for danger states (lines 271, 280); 71 var(--) uses |
| `services/ui/src/routes/billing/+page.svelte` | Akasa-styled billing page | VERIFIED | var(--bg-card) (line 163); var(--violet-bright) (line 248); 40 var(--) uses |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app.css` | All page style blocks | CSS custom property inheritance | VERIFIED | `var(--violet)` used in every single route .svelte file; all 13 routes + layout confirmed |
| `+layout.svelte` | All child routes | `@render children()` | VERIFIED | Line 214: `{@render children()}` present |
| `new-execution/+page.svelte` | `new-execution/+page.server.ts` | Form POST with objectiveId | VERIFIED | hidden input `name="objectiveId"` at line 93; $state `objectiveId` forwarded |
| `objectives/[id]/+page.svelte` | `new-execution/+page.svelte` | URL param `?objectiveId=` | VERIFIED | Line 115: `href="/new-execution?objectiveId={objectiveId}&maxBots=..."` |
| `SoulTierBadge.svelte` | `executions/[id]/bots/[botId]/+page.svelte` | component import | VERIFIED | Line 8: `import SoulTierBadge from '$lib/components/SoulTierBadge.svelte'`; used at line 182 |
| `SoulInspectorPanel.svelte` | `executions/[id]/+page.svelte` | component import | VERIFIED | Line 7: import confirmed; used at line 251 |
| `VerdictConfirmPanel.svelte` | `executions/[id]/+page.svelte` | component import | VERIFIED | Line 9: import confirmed; used at line 254 |
| `SoulTierBadge.svelte` | `executions/[id]/report/+page.svelte` | component import | VERIFIED | Line 7: import; used at lines 92, 96, 100, 105, 167 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `routes/+page.svelte` | 762 | `.tok { color: #4ade80; }` terminal-emulator green checkmark | Info | No `--green` token exists in app.css; decorative landing page element only. Documented as acceptable exception in 23-07-SUMMARY |
| `routes/+page.svelte` | 312 | `fill="#a78bfa"` SVG circle | Info | SVG inline fill attributes cannot use CSS custom properties; value matches `--violet-bright`; acceptable per plan |
| `routes/login/+page.svelte` | 26 | `fill="#a78bfa"` SVG logo circle | Info | Same as above — SVG inline fill, matches --violet-bright |
| `routes/+layout.svelte` | 170 | `fill="#a78bfa"` SVG logo circle | Info | Same as above |
| Multiple files (6 instances) | various | `color: #fff` on violet backgrounds | Info | No `--white` token exists in app.css; universally correct for text on colored backgrounds; documented as 23-06 acceptable exception |
| `routes/login/+page.svelte` | 40–43 | Google Sign-In SVG path fills (#4285F4, #34A853, #FBBC05, #EA4335) | Info | Vendor-mandated Google brand colors in SVG; not tokenizable |

No blockers found. All flagged hex values are documented acceptable exceptions per plan criteria.

---

### Human Verification Required

#### 1. Full Visual Route Tour

**Test:** Start `cd services/ui && npm run dev`. Visit each of the 13 routes and confirm the Akasa dark theme renders.

**Expected:**
- `/` — Hero with dark violet background, aurora gradient blobs animating, particle canvas visible, "soul." text with glitch animation
- `/login` — Dark card on dark background, Akasa diamond logo animated, Google Sign-In button
- `/new-execution` — Dark form, violet Launch button
- `/executions/[id]` — Dark bot cards, SoulTierBadge visible on each bot card, live dot pulsing
- `/executions/[id]/bots/[botId]` — Dark stats panels, SoulTierBadge present
- `/executions/[id]/report` — Dark leaderboard, podium cards, SoulTierBadge on each entry
- `/objectives` — Dark card grid, status badges, violet/teal accents
- `/objectives/[id]` — Dark detail, run history table, "Launch" button present
- `/verdicts` — Dark list, verdict type badges (teal=Promote, rose=Retire, amber=Demote)
- `/verdicts/[verdictId]` — Dark verdict detail, judge summaries
- `/guide` — Dark guide, "How Akasa works" heading, no "Claw Army" text
- `/admin` — Dark panel, danger states in red (--error), not rose
- `/billing` — Dark billing, usage table

**Why human:** Visual rendering, correct font loading (Clash Display headings vs Inter body), animation behavior, and frosted-glass nav activation on scroll cannot be verified by static code analysis.

#### 2. Artisan Soul Badge Breathing Animation

**Test:** On any execution monitor page with an Artisan-tier bot, observe the SoulTierBadge.

**Expected:** Artisan badge shows amber text/background AND an amber breathing pip (6px circle pulsing between scale 1 and 1.25 with box-shadow glow).

**Why human:** CSS `breathe` animation keyframe cannot be verified programmatically; requires visual inspection.

#### 3. Nav Frosted Glass on Scroll

**Test:** On any page, scroll down more than 40px.

**Expected:** Nav background transitions from transparent to `rgba(7,6,15,0.92)` with `backdrop-filter: blur(20px)` — visible frosted glass effect.

**Why human:** Scroll-triggered class toggle requires live browser interaction.

---

## Gaps Summary

No gaps found. All 13 route pages verified with Akasa CSS tokens. All key component links wired. Zero old token violations, zero Claw Army brand references found in the entire `services/ui/src/` directory.

The only remaining items are aesthetic/visual — verified via code to be correctly implemented — but require human eyes to confirm the browser renders them as intended. The single known deviation (`.tok { color: #4ade80 }` on the landing page) is documented, low-priority, and caused by the absence of a `--green` token in the design system rather than a migration failure.

---

_Verified: 2026-02-23T04:57:17Z_
_Verifier: Claude (gsd-verifier)_
