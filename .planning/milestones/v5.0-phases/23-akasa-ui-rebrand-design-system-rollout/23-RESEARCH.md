# Phase 23: Akasa UI Rebrand — Design System Rollout - Research

**Researched:** 2026-02-23
**Domain:** SvelteKit UI / CSS Design System / Brand Migration
**Confidence:** HIGH

---

## Summary

The Akasa design system already exists on the `origin/improvement/ui` branch. The branch diverged from the current `release/v3.0` at commit `a4e27ea` ("Merge pull request #13 — feature/homepage-v2-guide"). Since that divergence, `improvement/ui` added 4 commits that rebrand `app.css`, `+layout.svelte`, `+page.svelte`, `executions/[id]/+page.svelte`, `login/+page.svelte`, and `new-execution/+page.svelte`. Meanwhile, `release/v3.0` added the objectives pages, wired the `/objectives` nav link, and added objectiveId URL-param support in `new-execution`.

The key insight: **this phase is primarily a cherry-pick + page-by-page restyle exercise, not library installation work**. No new npm packages are needed. The design tokens, animations, and component patterns are fully documented in `docs/akasa-design-guide.md` on `improvement/ui`. The challenge is (a) merging the 4 rebrand commits without losing the v3.0 additions, and (b) restyling the 9 pages/components that were not touched in `improvement/ui`.

The scope is entirely CSS/HTML — no backend changes, no API contract changes, no new routes. Every change is local to `services/ui/src/`.

**Primary recommendation:** Perform a manual selective-merge (not `git merge`) of the 6 rebranded files from `improvement/ui`, preserve the v3.0-only additions (objectives nav link, objectiveId param), then restyle the 9 remaining pages/components using the design guide as the reference.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | ^2.52.0 | Framework (already installed) | Existing stack |
| Svelte 5 | ^5.51.3 | Component model with runes (already installed) | Existing stack |
| CSS Custom Properties (native) | — | Akasa token system | Zero-dependency, browser-native |

### Fonts (CDN, no install)
| Font | Source | Purpose |
|------|--------|---------|
| Clash Display | Fontshare CDN (`api.fontshare.com`) | All headings (h1–h3), logo wordmark |
| Inter | Google Fonts | Body copy, nav links, button labels |
| JetBrains Mono | Google Fonts | Section eyebrows, status pills, tags, ALL CAPS micro-labels |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CDN font loading | Self-hosted fonts | Self-hosting avoids third-party dependency but adds build complexity. CDN approach already proven in improvement/ui — use it. |
| Per-page `<svelte:head>` font links | Single load in `app.html` | `app.html` is simpler but `<svelte:head>` is the SvelteKit convention. The improvement/ui branch loads fonts in `+page.svelte` only (the landing page). For inner app pages that share the layout, fonts must be loaded in `+layout.svelte` or each page's `<svelte:head>`. Move to `+layout.svelte` for global load. |

**Installation:** No npm installs required. Font loading is via `<link>` tags in `<svelte:head>`.

---

## Architecture Patterns

### Recommended Project Structure
```
services/ui/src/
├── app.css                    # Akasa token :root — the single source of truth
├── app.html                   # No changes needed
├── routes/
│   ├── +layout.svelte         # Particle canvas, Akasa nav, font <link> tags
│   ├── +page.svelte           # Landing — take wholesale from improvement/ui (with v3.0 nav link preserved)
│   ├── login/                 # Take wholesale from improvement/ui
│   ├── new-execution/         # Take from improvement/ui + preserve objectiveId URL param logic
│   ├── executions/[id]/       # Take from improvement/ui
│   ├── executions/[id]/bots/[botId]/  # Restyle to Akasa (currently old tokens + hardcoded hex)
│   ├── executions/[id]/report/        # Restyle to Akasa
│   ├── guide/                 # Full restyle — 1,328 lines, heaviest task
│   ├── admin/                 # Restyle to Akasa
│   ├── billing/               # Restyle to Akasa
│   ├── objectives/            # Restyle to Akasa (new in v3.0, not in improvement/ui)
│   ├── objectives/[id]/       # Restyle to Akasa (new in v3.0, not in improvement/ui)
│   ├── verdicts/              # Restyle to Akasa (partially done in improvement/ui)
│   └── verdicts/[verdictId]/  # Restyle to Akasa (partially done in improvement/ui)
└── lib/components/
    ├── SoulTierBadge.svelte    # Restyle: hardcoded light-mode colors, needs dark Akasa treatment
    ├── SoulInspectorPanel.svelte  # Restyle: 36 hardcoded hex values, light-mode panel
    └── VerdictConfirmPanel.svelte # Restyle: 47 hardcoded hex values, light-mode panel
```

### Pattern 1: Token Mapping (Old → Akasa)
**What:** Every old token maps to an Akasa equivalent. Replace consistently.
**When to use:** All pages still using old design system tokens.

```
Old Token              → Akasa Token
--canvas               → --bg
--surface-0            → --bg-2
--surface-1            → --bg-2
--surface-2            → --bg-3
--surface-3            → --bg-card
--signal               → --violet
--signal-tint          → --violet-dim
--signal-border        → --border-mid
--text-primary         → --text
--text-secondary       → --text-muted
--text-muted           → --text-faint
--text-faint           → --text-faint (keep)
--active               → --teal
--active-tint          → --teal-dim
--alert                → --amber
--critical             → --rose (or a direct error hex if needed — rose is retirement language)
--border               → --border (both exist, but value changes to violet-tinted)
--border-soft          → --border
--border-signal        → --border-mid or --border-hi
--border-active        → rgba(45,212,191,0.40)
```

**Critical note on `--critical`:** The old `--critical` was a red error color (`#ef4444`). Akasa doesn't have a general error token — `--rose` is specifically retirement/end-of-life. For actual error states (form validation errors, API failures), use direct rgba on the rose hue OR accept that `--rose` doubles as error red in dark context (visually compatible). Document this decision explicitly.

### Pattern 2: Soul Tier Badge Dark-Mode Treatment (Akasa)
**What:** SoulTierBadge and rank display must swap light-mode pastel colors for Akasa dark tokens.
**When to use:** Artisan/Understudy/Novice/Retired badges anywhere in the app.

```css
/* Akasa-compliant soul tier badge colors */
.tier-novice     { color: var(--text-muted);    background: rgba(236,232,255,0.05); border: 1px solid var(--border); }
.tier-understudy { color: var(--teal);           background: var(--teal-dim);         border: 1px solid rgba(45,212,191,0.2); }
.tier-artisan    { color: var(--amber);          background: var(--amber-dim);        border: 1px solid rgba(251,191,36,0.2); }
.tier-retired    { color: var(--rose);           background: var(--rose-dim);         border: 1px solid rgba(244,114,182,0.15); }
```

Per the design guide:
- Artisan = amber accent (the soul's peak expression — amber signals "this is about the soul")
- Understudy = teal (confirmed, human-validated)
- Novice = muted/faint (no history, exploration mode)
- Retired = rose (end-of-life/legacy)

The `breathe` animation keyframe (amber pulsing glow) should be applied to the Artisan pip on the rank display. This is defined in `app.css` on improvement/ui.

### Pattern 3: Font Loading in Layout
**What:** Clash Display and Inter/JetBrains Mono must be available on every page.
**When to use:** Move font `<link>` tags from landing page `<svelte:head>` to `+layout.svelte` so all inner pages get the fonts.

```html
<!-- Add to +layout.svelte <svelte:head> -->
<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" />
</svelte:head>
```

Once fonts are in `+layout.svelte`, remove the duplicate `<svelte:head>` font tags from `+page.svelte`.

### Pattern 4: Scroll Reveal Observer
**What:** App-level scroll reveal pattern. Defined once in `app.css`, wired per-page via `onMount`.
**When to use:** All pages with major content blocks. Not strictly required for utility pages (admin, billing) but can be applied.

```typescript
// Source: improvement/ui routes/+page.svelte
onMount(() => {
  const obs = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
    }),
    { threshold: 0.1, rootMargin: '0px 0px -24px 0px' }
  );
  document.querySelectorAll('.r').forEach(el => obs.observe(el));
  document.querySelectorAll('.hero .r').forEach(el => el.classList.add('on'));
  return () => obs.disconnect();
});
```

### Anti-Patterns to Avoid
- **Hardcoded hex values in page CSS:** The design guide is explicit — always use CSS custom property variables. Current offending pages: guide (39 instances), admin (58), billing (39), bot detail (70), report (67), verdict detail (60), SoulInspectorPanel (36), VerdictConfirmPanel (47).
- **Mixing old tokens with new tokens:** Using `var(--signal)` and `var(--violet)` in the same file breaks token coherence. Full replacement per file is required.
- **Applying amber to non-soul elements:** Amber is exclusively for soul-concept language. Do not use `--amber` for interactive states, buttons, or non-soul copy.
- **Using rose for general errors:** `--rose` is retirement language. Error states (API failures, validation) need a separate treatment — use `rgba(244,114,182,0.8)` directly or define a `--error` alias in app.css if needed.
- **Applying glitch effect to non-amber, non-display-size text:** Glitch is only for amber display text (h1/h2 large accents). Never on body copy, labels, or tags.
- **Forgetting `data-text` attribute on glitch elements:** The glitch CSS uses `content: attr(data-text)` — missing this attribute makes it render nothing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Particle canvas | Custom particle system | Already in improvement/ui `+layout.svelte` | Fully implemented with correct colors and performance characteristics |
| Scroll reveal | IntersectionObserver from scratch | Pattern in improvement/ui + `app.css` `.r`/`.r.on` classes | Already defined and working |
| Glitch animation | Custom CSS animation | Already in `app.css` on improvement/ui | Complex keyframe timing — take the existing implementation |
| Aurora background blobs | CSS gradient system | Already defined in improvement/ui pages | Tested animation durations and positions |
| Logo mark animation | SVG animation | Already in `+layout.svelte` on improvement/ui | Timing calibrated (18s outer, 12s inner, 3s pulse) |

**Key insight:** The improvement/ui branch is a complete, working implementation of the Akasa design. The primary task is (a) getting those 6 files onto the current branch correctly, and (b) extending the pattern to the 9 pages/components not yet touched.

---

## Common Pitfalls

### Pitfall 1: Merge Conflict in `new-execution/+page.svelte`
**What goes wrong:** Both branches modified this file. `improvement/ui` reskinned it (315 lines changed). `release/v3.0` added objectiveId URL param reading (21 lines). A raw `git merge` will produce a conflict.
**Why it happens:** Diverged branches both editing the same file.
**How to avoid:** Take the `improvement/ui` version of `new-execution/+page.svelte`, then manually apply the v3.0 additions (the `objectiveId`, `urlMaxBots`, `urlBudgetCapDollars` `$state`/`$derived` vars, the `$effect`, and the hidden `<input>` element). Both changes are small, additive, and non-overlapping in the file structure.
**Warning signs:** If `git merge` is attempted and conflicts appear, do NOT accept either branch wholesale — manually merge.

### Pitfall 2: Objectives Link Missing from Rebranded Nav
**What goes wrong:** The `improvement/ui` nav does not include the `/objectives` link (it was added to `release/v3.0` after the branch diverged). Taking the layout wholesale from `improvement/ui` drops the objectives nav link.
**Why it happens:** The `/objectives` route was created in Phases 17+ which postdate the `improvement/ui` branch.
**How to avoid:** After copying the `+layout.svelte` from `improvement/ui`, add the `/objectives` nav link back into the `ul.nav-links` list. The improvement/ui nav has: Guide, Verdicts, Billing. The current branch has: Objectives, Guide, Verdicts, Billing.

### Pitfall 3: Font Loading Gap on Inner App Pages
**What goes wrong:** If Clash Display isn't loaded, headings fall back to Inter and lose the tight letter-spacing and display weight. The design looks like a degraded version.
**Why it happens:** In `improvement/ui`, fonts are loaded only in the landing page `<svelte:head>` — inner app pages (billing, admin, guide etc.) don't have the font `<link>` tags because they weren't rebranded.
**How to avoid:** Move all three font `<link>` tags to `+layout.svelte` `<svelte:head>`. This ensures every route gets the fonts.

### Pitfall 4: Light-Mode Component Panels
**What goes wrong:** SoulInspectorPanel (495 lines, 36 hardcoded hex) and VerdictConfirmPanel (451 lines, 47 hardcoded hex) use white backgrounds and light gray borders. They will appear as bright white rectangles on the dark Akasa page.
**Why it happens:** These components were built against the old design system before the rebrand.
**How to avoid:** These are significant restyling jobs. The panel background should be `var(--bg-card)`, borders `var(--border)`, text `var(--text)`, labels `var(--text-faint)`. The soul tier colors within the panels must follow the Akasa tier treatment (amber for Artisan, teal for Understudy, etc.).

### Pitfall 5: SoulTierBadge Has Hardcoded Light-Mode Colors
**What goes wrong:** `SoulTierBadge.svelte` uses light pastel backgrounds (`#eff6ff`, `#f5f3ff`, `#fffbeb`) that look correct on white but clash badly on Akasa dark backgrounds.
**Why it happens:** Built before the rebrand.
**How to avoid:** Replace with the Akasa tier colors (see Pattern 2 above). The badge is used in bot detail page (`executions/[id]/bots/[botId]/+page.svelte`) and potentially elsewhere.

### Pitfall 6: `--critical` Token No Longer Exists
**What goes wrong:** Several pages use `var(--critical)` and `var(--critical-tint)` for error states. After replacing `app.css`, these variables are undefined and the error states become invisible (inherits or renders nothing).
**Why it happens:** The Akasa token system doesn't define `--critical`. `--rose` is for retirement, not errors.
**How to avoid:** Either (a) add a `--error` token to `app.css` for error states (`--error: #f87171; --error-dim: rgba(248,113,113,0.10);`), or (b) replace `var(--critical)` usages with `--rose` and accept the semantic overlap. Option (a) is cleaner and more honest. Count: admin page uses `var(--critical)` heavily for execution stop/danger states.

### Pitfall 7: Brand Name "Claw Army" Still in `<title>` Tags and Copy
**What goes wrong:** `<title>` tags, `<h1>` headings, and body copy across most pages still read "Claw Army". After the rebrand, the product name is "Akasa".
**Why it happens:** Only the pages already touched in `improvement/ui` had their brand copy updated.
**How to avoid:** Systematically search for "Claw Army" across all `.svelte` files and replace with "Akasa". The guide page is especially heavy (1,328 lines with frequent "Claw Army" mentions that need revoicing to match Akasa copy conventions).

---

## Code Examples

Verified patterns from official sources (improvement/ui branch):

### CSS Token System (from `app.css` on `improvement/ui`)
```css
:root {
  --bg:        #07060f;   /* Page base */
  --bg-2:      #0c0b18;   /* Sections, raised surfaces */
  --bg-3:      #100f1e;   /* Tertiary surface */
  --bg-card:   #131224;   /* Cards, panels */
  --bg-card-2: #110f20;   /* Card hover state */
  --border:     rgba(148,110,255,0.10);
  --border-mid: rgba(148,110,255,0.20);
  --border-hi:  rgba(148,110,255,0.32);
  --text:       #ece8ff;
  --text-muted: rgba(236,232,255,0.50);
  --text-faint: rgba(236,232,255,0.22);
  --violet:        #7c3aed;
  --violet-bright: #a78bfa;
  --violet-light:  #c4b5fd;
  --violet-dim:    rgba(124,58,237,0.14);
  --violet-glow:   rgba(124,58,237,0.08);
  --amber:     #fbbf24;
  --amber-dim: rgba(251,191,36,0.10);
  --teal:     #2dd4bf;
  --teal-dim: rgba(45,212,191,0.10);
  --rose:     #f472b6;
  --rose-dim: rgba(244,114,182,0.08);
  --glitch-r: rgba(255,60,120,0.7);
  --glitch-b: rgba(60,180,255,0.7);
  --font-display: 'Clash Display', 'Inter', system-ui, sans-serif;
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', monospace;
}
```

### Card Pattern (from design guide)
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 36px 30px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
}
.card:hover {
  border-color: var(--border-mid);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
```

### Section Eyebrow Label (from design guide + app.css)
```css
.sec-label {
  display: flex; align-items: center; gap: 14px;
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--text-faint); margin-bottom: 22px;
}
.sec-label::after {
  content: ''; display: block;
  width: 28px; height: 1px;
  background: linear-gradient(90deg, var(--border-mid), transparent);
}
```

### Artisan Tier Pip with `breathe` Animation (from design guide)
```css
.tier-pip-artisan {
  background: var(--amber);
  animation: breathe 2.5s ease-in-out infinite;
}
@keyframes breathe {
  0%,100% { transform: scale(1);    box-shadow: 0 0 9px var(--amber); }
  50%      { transform: scale(1.25); box-shadow: 0 0 14px var(--amber), 0 0 28px rgba(251,191,36,0.4); }
}
```

### Compatibility Badge Colors (from design guide)
```css
.cb-open { background: var(--teal-dim);   color: var(--teal);          border: 1px solid rgba(45,212,191,0.2); }
.cb-soon { background: var(--violet-dim); color: var(--violet-bright); border: 1px solid rgba(167,139,250,0.2); }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Claw Army" brand, blue (`--signal: #3d7eff`) design system | "Akasa" brand, dark violet (`--violet: #7c3aed`) design system | improvement/ui branch (4 commits on top of v2.0 merge) | Full token replacement required — old tokens undefined after app.css swap |
| Flat dark-navy background (`--canvas: #090d18`) | Deep void violet (`--bg: #07060f`) with layered surfaces | improvement/ui | Nearly indistinguishable visually but token names change completely |
| System-ui font stack | Clash Display + Inter + JetBrains Mono from CDN | improvement/ui | Requires CDN `<link>` tags on every page via layout |
| Static nav (sticky) | Fixed nav with frosted glass on scroll (`.stuck` class toggle) | improvement/ui | Behavioral change — nav needs `id="nav"` and JS `scroll` event |
| No particle background | 130-particle canvas in `+layout.svelte` | improvement/ui | Adds to every page — already done, merge in without regression |
| No scroll reveal animations | `.r` / `.r.on` IntersectionObserver | improvement/ui | Optional for utility pages, good for content-heavy pages |

**Deprecated/outdated:**
- `--signal`: Replaced by `--violet` / `--violet-bright` / `--violet-light`
- `--canvas`: Replaced by `--bg`
- `--surface-0/1/2/3`: Replaced by `--bg-2`, `--bg-3`, `--bg-card`, `--bg-card-2`
- `--text-primary` / `--text-secondary`: Replaced by `--text` / `--text-muted`
- `--active` / `--active-tint`: Context-dependent: use `--teal` / `--teal-dim` for liveness/status
- `--alert` / `--alert-tint`: Use `--amber` / `--amber-dim` only for soul-concept language
- `--critical` / `--critical-tint`: No direct Akasa replacement — add `--error` token to `app.css`

---

## Page Inventory & Rebrand Status

| Page | Route | Current Branch Status | improvement/ui Status | Action |
|------|-------|----------------------|----------------------|--------|
| Landing | `/` | Old v2 design | FULLY REBRANDED | Selective-merge improvement/ui version, remove duplicate font tags |
| Layout | `+layout.svelte` | Old v2 design + objectives nav link | FULLY REBRANDED (no objectives link) | Selective-merge + add objectives link back + add font `<svelte:head>` |
| Login | `/login` | Old design, "Claw Army" brand | FULLY REBRANDED | Take wholesale from improvement/ui |
| New Execution | `/new-execution` | Old design + objectiveId URL params | MOSTLY REBRANDED (missing objectiveId logic) | Take improvement/ui version + add objectiveId logic from v3.0 |
| Execution Monitor | `/executions/[id]` | **OLD DESIGN** (0 Akasa tokens) | FULLY REBRANDED | Take wholesale from improvement/ui |
| Bot Detail | `/executions/[id]/bots/[botId]` | **OLD DESIGN** (70 hardcoded hex) | **OLD DESIGN** | Full restyle needed — not in improvement/ui rebrand |
| Report | `/executions/[id]/report` | **OLD DESIGN** (67 hardcoded hex) | **OLD DESIGN** | Full restyle needed |
| Guide | `/guide` | **OLD DESIGN** (39 signal refs, 1,328 lines) | **OLD DESIGN** | Full restyle + brand copy ("Claw Army" → "Akasa") — heaviest task |
| Admin | `/admin` | **OLD DESIGN** (25 signal refs, 58 hex) | **OLD DESIGN** | Full restyle |
| Billing | `/billing` | **OLD DESIGN** (1 signal ref, 39 hex) | **OLD DESIGN** | Full restyle |
| Objectives List | `/objectives` | **OLD DESIGN** (not in improvement/ui) | n/a (doesn't exist) | Full restyle (266 lines) |
| Objective Detail | `/objectives/[id]` | **OLD DESIGN** (not in improvement/ui) | n/a (doesn't exist) | Full restyle (509 lines) |
| Verdicts List | `/verdicts` | **PARTIALLY STYLED** (9 old refs, 8 Akasa refs) | Partially done | Finish migration |
| Verdict Detail | `/verdicts/[verdictId]` | **PARTIALLY STYLED** (6 old refs, 15 Akasa refs) | Partially done | Finish migration |
| SoulTierBadge | lib/components | **OLD DESIGN** (light-mode pastels) | n/a | Restyle with Akasa tier colors |
| SoulInspectorPanel | lib/components | **OLD DESIGN** (36 hardcoded hex, light panels) | n/a | Full restyle — 495 lines |
| VerdictConfirmPanel | lib/components | **OLD DESIGN** (47 hardcoded hex, light panels) | n/a | Full restyle — 451 lines |

**Count:** 6 pages to selective-merge from improvement/ui, 9 pages/components to restyle from scratch.

---

## Open Questions

1. **Error state token (`--critical` replacement)**
   - What we know: Akasa doesn't define `--critical`. Pages like admin use it for stop/danger states.
   - What's unclear: Should `--rose` serve double duty (retirement + errors) or should we add `--error`?
   - Recommendation: Add `--error: #f87171; --error-dim: rgba(248,113,113,0.10);` to `app.css` to make error states explicit and avoid overloading `--rose`.

2. **Council verdict language in VerdictConfirmPanel**
   - What we know: VerdictConfirmPanel uses light-mode badge styles for verdict types (Promote, Retire, Demote, Monitor, Maintain).
   - What's unclear: The design guide specifies `--rose` for retirement language. Should "Retire" verdict badges use `--rose`? Should "Promote" use `--teal`?
   - Recommendation: Use semantic color mapping — Promote → teal, Retire → rose, Demote → amber (soul-mechanic language), Monitor → violet-dim, Maintain → violet-dim.

3. **Guide page copy rewrite scope**
   - What we know: The guide page (1,328 lines) uses "Claw Army" in headings, subheadings, and body copy throughout. The Akasa brand convention is "Akasa". Copy must change (e.g., "Claw Army turns a plain-language objective..." → "Akasa turns a plain-language objective...").
   - What's unclear: How deep does the copy revision go? Does "Akasa" change only the product name references or does the guide need a full voice overhaul per section 8 of the design guide?
   - Recommendation: In this phase, do brand name substitution ("Claw Army" → "Akasa") and CSS restyle. Deep copy rewriting is a separate content exercise beyond Phase 23's success criteria.

4. **Bot detail page title tag**
   - What we know: `<title>Bot {botId.slice(0, 8)} | Claw Army</title>` on current branch. improvement/ui also says "Claw Army" here.
   - Recommendation: Change to `<title>Bot {botId.slice(0, 8)} | Akasa</title>`.

---

## Sources

### Primary (HIGH confidence)
- `origin/improvement/ui:docs/akasa-design-guide.md` — Complete design system specification (856 lines): color tokens, typography, animations, components, copy conventions, implementation checklist
- `origin/improvement/ui:services/ui/src/app.css` — Akasa token definitions in production form
- `origin/improvement/ui:services/ui/src/routes/+layout.svelte` — Complete working particle canvas + Akasa nav
- `origin/improvement/ui:services/ui/src/routes/+page.svelte` — Complete working landing page (Akasa)
- `origin/improvement/ui:services/ui/src/routes/executions/[id]/+page.svelte` — Complete execution monitor (Akasa)
- `release/v3.0:services/ui/src/` — Current working branch state — all 14 pages + 3 components audited

### Secondary (MEDIUM confidence)
- Git diff analysis of `a4e27ea..origin/improvement/ui` — identifies exactly which 7 files the rebrand touched
- Git diff analysis of `a4e27ea..release/v3.0` — identifies exactly which 5 files v3.0 added since the split

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new dependencies. Stack is fully defined in existing codebase and design guide.
- Architecture: HIGH — Merge strategy is clear. File-by-file rebrand scope confirmed by direct code inspection.
- Pitfalls: HIGH — Identified from direct inspection of current branch code, not hypothetical.

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable — no fast-moving libraries, design guide is locked)
