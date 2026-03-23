# Phase 2: Design System Tokens and Typography - Research

**Researched:** 2026-03-23
**Domain:** CSS custom properties, self-hosted fonts, SvelteKit layout patterns, token migration
**Confidence:** HIGH

## Summary

This phase replaces the existing v5.0 `app.css` entirely with a complete two-world CSS token system (Front Office `--fo-*` and Back Office `--bo-*`) drawn verbatim from `tasks/akasa-design-guide-v2.md`. The token system also defines semantic aliases (`--bg`, `--card`, `--text`, `--border`) that auto-switch via a `body.back-office` class, three self-hosted typefaces loaded through `@fontsource` packages, and a `lint:tokens` grep script to enforce removal of all v5.0 token names.

The design guide v2 provides every exact hex value, opacity value, spacing step, and radius value — there is no creative work in this phase. The challenge is faithful transcription, correct cascade structure, zero-flash mode persistence via an inline blocking script in `app.html`, and ensuring that 22+ existing `.svelte` files using old v5 tokens (`--bg`, `--text`, `--violet`, `--s-*`, etc.) are updated to the new semantic aliases or `--fo-*`/`--bo-*` raw tokens. Removing old tokens without updating the components that consume them will break the UI visually.

**Primary recommendation:** Write `app.css` clean (no migration shim), update every consumer file in the same task batch, and add the `lint:tokens` script at the end to lock the new state. Do not leave any file referencing old token names when the phase closes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Clean slate — replace `app.css` entirely with the v2 token system. No backward compatibility shims. v5.0 content (glitch effects, scroll-reveal, buttons, landing page styles) are v5 artifacts rebuilt in Phase 3/4.
- **D-02:** Semantic aliases that auto-switch between modes. Define `--bg`, `--card`, `--text`, `--text-muted`, `--border` etc. in `:root` pointing to `--fo-*` values, then override in `body.back-office` to point to `--bo-*` values. Components use semantic aliases, never `--fo-*`/`--bo-*` directly.
- **D-03:** localStorage + inline blocking script in `app.html`. Tiny `<script>` reads stored preference and sets `body.back-office` class BEFORE first paint — zero flash of wrong theme.
- **D-04:** `lint:tokens` grep script in root `package.json`. Greps for banned patterns (`--h-*`, `--d-*`, `--ak-*`, and bare v5 names). No extra dependencies.
- **D-05:** Cormorant Garamond: weights 300, 400, 600 + italic via `@fontsource/cormorant-garamond`. DM Sans: variable weight via `@fontsource-variable/dm-sans`. Press Start 2P: single weight via `@fontsource/press-start-2p`. Latin subset only.
- **D-06:** Font CSS imports go in `+layout.svelte` (root layout). Vite processes and bundles font files with content hashes.
- **D-07:** Font vars: `--font-display` = Cormorant Garamond, `--font-body` = DM Sans, `--font-label` = Press Start 2P. Replaces v5's Clash Display and Inter.

### Claude's Discretion
- Exact spacing scale naming convention (`--space-xs` through `--space-3xl` per DS-07, replacing v5's `--s-1` through `--s-12`)
- Border radius scale values (`--radius-sm/md/lg`)
- How to structure the app.css file internally (sections, comments, ordering)
- Whether to split tokens into separate files or keep in one app.css
- Exact semantic alias names beyond the obvious (`--bg`, `--card`, `--text`, `--border`)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | CSS token system for Front Office — `--fo-bg`, `--fo-card`, `--fo-plum`, `--fo-gold`, `--ink`, `--muted` and all variants per akasa-design-guide-v2.md | Complete palette in Section 3.1 + Section 12 of v2 guide. All hex values verified. |
| DS-02 | CSS token system for Back Office — `--bo-bg`, `--bo-card`, `--bo-violet`, `--bo-amber`, `--bo-teal`, `--bo-rose`, `--bo-text/muted/faint` per v2 guide | Complete palette in Section 3.2 + Section 12 of v2 guide. All hex and rgba values verified. |
| DS-03 | `body.back-office` class toggle switches between modes, persisted in user preferences. Front Office is default. | localStorage blocking script pattern documented. Inline script placement in `app.html` verified safe for SvelteKit. |
| DS-04 | Three typefaces loaded — Cormorant Garamond (display, 16px min), DM Sans (body/default), Press Start 2P (labels/tags, 6-8px max). Font vars: `--font-display`, `--font-body`, `--font-label` | `@fontsource` packages confirmed available. Import pattern for SvelteKit `+layout.svelte` verified. |
| DS-05 | Opacity scale for Back Office text hierarchy — rgba(236, 232, 255, 0.52/0.42/0.24/0.14), never arbitrary grey hex values | Values confirmed in Section 3.5 of v2 guide. Maps to `--bo-muted`, `--bo-faint`, and two additional opacity steps. |
| DS-06 | Semantic colour constants enforced — violet=coordination, amber=karma/compounding, teal=execution, rose=contractors/tools. Near-black (#06050E), #000000 banned | Section 3.3 semantic mapping table confirms role assignments. |
| DS-07 | Spacing scale (`--space-xs` through `--space-3xl`), border radius scale (`--radius-sm/md/lg`), section/card/grid padding per v2 guide | Spacing scale in Section 5.1, radius in Section 5.6, card/section padding in Sections 5.2–5.3. All values confirmed. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fontsource/cormorant-garamond` | 5.2.11 | Self-hosted Cormorant Garamond (weights 300/400/600 + italic) | Vite-native, GDPR-safe, removes Google Fonts CDN dependency, content-hashed by Vite |
| `@fontsource-variable/dm-sans` | 5.2.8 | Self-hosted DM Sans variable font (full weight axis) | Variable font = single file covers all weights, smaller than multiple static files |
| `@fontsource/press-start-2p` | 5.2.7 | Self-hosted Press Start 2P (single weight) | Same self-hosting rationale; only one weight available upstream |

**No additional packages required.** All other work is pure CSS custom properties (no library needed) and a vanilla JS inline script (no library needed).

**Installation:**
```bash
pnpm --filter @claw/ui add @fontsource/cormorant-garamond @fontsource-variable/dm-sans @fontsource/press-start-2p
```

**Version verification:** Confirmed against npm registry on 2026-03-23. All three packages are at `5.2.x` — part of the unified fontsource 5.x release line.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource-variable/dm-sans` | `@fontsource/dm-sans` (static) | Variable font covers all weights in one file. Static requires separate files per weight. Variable is strictly better here. |
| Self-hosted via `@fontsource` | Google Fonts CDN link | CDN version adds external DNS + TLS round-trip (~300ms on desktop, 1s+ on 3G), GDPR exposure, offline failure. Self-hosted is locked decision D-05/D-06. |

---

## Architecture Patterns

### Token File Structure

The design guide provides a complete `:root` block in Section 12. The recommended structure for `app.css` is a single file with clearly sectioned comments. Splitting into multiple files adds import complexity in SvelteKit without meaningful benefit at this token volume (~60 custom properties).

```css
/* app.css structure (recommended) */

/* 1. Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* 2. Token definitions — all raw tokens + semantic aliases */
:root {
  /* Front Office raw tokens */
  /* Back Office raw tokens */
  /* Shared tokens (tiers, agents, spacing, radius, fonts) */
  /* Semantic aliases — point to --fo-* by default */
}

/* 3. Back Office override — flip semantic aliases */
body.back-office {
  /* Override semantic aliases to point to --bo-* */
}

/* 4. Base element styles — body, html, a */
/* (thin — just enough to apply font-family and color) */
```

### Pattern 1: Semantic Alias Cascade

**What:** Define semantic aliases in `:root` pointing to Front Office values, then override in `body.back-office` to point to Back Office values. Components reference only semantic aliases.

**When to use:** Every component that needs a background, text colour, or border colour.

```css
/* Source: tasks/akasa-design-guide-v2.md Section 2 + D-02 decision */

:root {
  /* Semantic aliases — default to Front Office */
  --bg:          var(--fo-bg);
  --bg2:         var(--fo-bg2);
  --bg3:         var(--fo-bg3);
  --card:        var(--fo-card);
  --border:      var(--fo-border);
  --text:        var(--ink);
  --text-muted:  var(--muted);
  --accent:      var(--fo-plum);
  --accent-dim:  var(--fo-plum-p);
}

body.back-office {
  /* Override semantic aliases — Back Office values */
  --bg:          var(--bo-bg);
  --bg2:         var(--bo-card);       /* bo has no bg2 — card is the step */
  --bg3:         var(--bo-card);
  --card:        var(--bo-card);
  --border:      var(--bo-border);
  --text:        var(--bo-text);
  --text-muted:  var(--bo-muted);
  --accent:      var(--bo-violet);
  --accent-dim:  rgba(124, 58, 237, 0.10);
}
```

### Pattern 2: Zero-Flash Mode Detection (Blocking Script)

**What:** An inline `<script>` in `app.html` runs synchronously before the parser reaches `<body>`, setting the class before first paint.

**When to use:** Any site with a stored theme preference that must not flash on load.

```html
<!-- Source: D-03 decision, standard technique for theme persistence -->
<!-- services/ui/src/app.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      // Runs synchronously — sets class before first paint
      try {
        if (localStorage.getItem('akasa-mode') === 'back-office') {
          document.documentElement.classList.add('back-office-pending');
        }
      } catch (_) {}
    </script>
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

**Note:** The blocking script should add the class to `<html>` (not `<body>`) if it runs before `<body>` is parsed. The CSS selector then needs `html.back-office-pending body` or the script must target `document.body` — but `document.body` is null before `<body>` parses. The safest approach: target `document.documentElement` in the script, then in CSS have both `body.back-office` (set by the Svelte toggle) and `html.back-office-pending` selectors apply the same overrides. Alternatively, the script can be placed directly before the closing `</body>` tag — it will be blocking but `document.body` is available.

**Recommended placement:** Just before `%sveltekit.body%` closes, or as the first child of `<body>`:
```html
<body data-sveltekit-preload-data="hover">
  <script>
    try {
      if (localStorage.getItem('akasa-mode') === 'back-office') {
        document.body.classList.add('back-office');
      }
    } catch (_) {}
  </script>
  <div style="display: contents">%sveltekit.body%</div>
</body>
```

The `try/catch` handles private browsing contexts where `localStorage` throws.

### Pattern 3: Font Import in Root Layout

**What:** Import `@fontsource` CSS files at the top of the root `+layout.svelte`. Vite processes them — font files get content-hashed and emitted to `static/`.

**When to use:** All self-hosted font loading in SvelteKit.

```svelte
<!-- Source: tasks/akasa-design-guide-v2.md Section 13 + D-06 decision -->
<!-- services/ui/src/routes/+layout.svelte -->
<script lang="ts">
  import '@fontsource/cormorant-garamond/300.css';
  import '@fontsource/cormorant-garamond/300-italic.css';
  import '@fontsource/cormorant-garamond/400.css';
  import '@fontsource/cormorant-garamond/400-italic.css';
  import '@fontsource/cormorant-garamond/600.css';
  import '@fontsource-variable/dm-sans/index.css';
  import '@fontsource/press-start-2p/400.css';

  let { children } = $props();
</script>

{@render children()}
```

**Why individual weight imports (not `/index.css` for Cormorant):** The full `@fontsource/cormorant-garamond/index.css` loads all weights including ones not needed (700, 800, etc.). Individual weight imports reduce payload. `@fontsource-variable/dm-sans` uses a variable font file — `/index.css` is correct because the variable axis covers all weights.

### Pattern 4: lint:tokens Script

**What:** A `package.json` script at the workspace root that greps for banned token names. Fails with exit code 1 if any matches are found.

```json
// Source: D-04 decision
// package.json (root)
{
  "scripts": {
    "lint:tokens": "! grep -rn --include='*.svelte' --include='*.css' --include='*.ts' -e '--h-' -e '--d-' -e '--ak-' -e 'var(--bg-card)' -e 'var(--bg-2)' -e 'var(--bg-3)' -e 'var(--text-faint)' -e 'var(--border-mid)' -e 'var(--border-hi)' -e 'var(--violet-bright)' -e 'var(--violet-dim)' -e 'var(--violet-glow)' -e 'var(--amber-dim)' -e 'var(--teal-dim)' -e 'var(--rose-dim)' -e \"var(--s-\" services/ui/src/"
  }
}
```

The `!` prefix inverts grep's exit code: grep returns 0 (success) if matches found, `!` flips it to 1 (failure). The script passes if grep finds nothing.

### Anti-Patterns to Avoid

- **Semantic alias bypass:** Never use `--fo-*` or `--bo-*` directly in component styles. The whole point of semantic aliases is that components don't know which world they're in.
- **Arbitrary hex values for text:** `color: #888` in Back Office context breaks the warm undertone system. Always use `rgba(236, 232, 255, N)` for muted text.
- **Pure black `#000000` for Back Office bg:** The guide explicitly bans this. Use `--bo-bg` (#06050E) which has violet warmth.
- **Semantic colour misuse:** Amber is only for karma/compounding. Teal is only for execution in progress. Violet is only for coordination. Using these for generic emphasis breaks the semantic system.
- **Cormorant Garamond below 16px:** The guide is explicit — Cormorant is display only at 16px+. Form labels, captions, functional text use DM Sans.
- **Press Start 2P above 8px:** The guide caps it at 8px. Larger sizes become illegible and look like errors.
- **Updating `app.css` without updating consumer files:** The semantic aliases preserve token names like `--bg`, `--text`, `--border` — so existing components using these names will keep working. But components using bare v5-specific names (`--bg-card`, `--text-faint`, `--violet-bright`, `--s-4`, etc.) will get `undefined` and render incorrectly. All 22 files identified as using old-style tokens must be updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Self-hosted fonts | Custom font file management, manual WOFF2 conversion | `@fontsource/*` packages | Pre-subsetted WOFF2, correct `@font-face` declarations, Vite integration, content hashing |
| Theme persistence | Custom cookie-based theme storage | localStorage + inline blocking script | No server round-trip, works offline, zero-flash is well-understood pattern |
| Token enforcement | Custom AST linter or PostCSS plugin | grep script in `package.json` | Zero dependencies, trivially correct, CI-compatible, the token set is small and stable |

**Key insight:** The font and token work in this phase is fundamentally a transcription exercise from the design guide. The value is in faithfulness to the spec, not in novel infrastructure.

---

## Common Pitfalls

### Pitfall 1: Component Token Breakage on Clean Slate

**What goes wrong:** `app.css` is replaced with new tokens. Existing components that reference old v5 token names (`--bg-card`, `--text-faint`, `--violet-bright`, `--s-4`, etc.) silently get `undefined` values, causing invisible text, missing backgrounds, or collapsed spacing.

**Why it happens:** v5 tokens are referenced in 22+ Svelte component files. The clean-slate decision (D-01) removes them without a shim.

**How to avoid:** Map every old token to its replacement before writing the new `app.css`. Audit files with:
```bash
grep -rn "var(--" services/ui/src/ --include="*.svelte" | grep -v "fo-\|bo-\|space-\|radius-\|font-\|tier-\|agent-"
```
Then update each consumer in the same plan as the `app.css` rewrite.

**Warning signs:** Pages that render without colour or with wrong layouts after `app.css` is replaced.

### Pitfall 2: Flash of Unstyled Mode (FOUM)

**What goes wrong:** User stored `back-office` preference, but the page renders Front Office for ~100ms before JavaScript runs and applies the class.

**Why it happens:** If the mode-detection logic runs in a Svelte `onMount()` or `$effect()`, it runs after the initial paint.

**How to avoid:** The blocking inline script in `app.html` (D-03) must be synchronous and placed before the main content renders. It must run before Svelte hydration, not after.

**Warning signs:** Visible light-to-dark flash on page load when Back Office is the stored preference.

### Pitfall 3: `@fontsource` Import Scope

**What goes wrong:** Fonts are imported in a nested route layout instead of the root `+layout.svelte`, causing font CSS to be scoped to specific routes only.

**Why it happens:** SvelteKit route layouts are hierarchical. CSS imported in a non-root layout only applies to children of that layout.

**How to avoid:** Always import font CSS in `services/ui/src/routes/+layout.svelte` (the root layout), not in `(app)/+layout.svelte` or `(marketing)/+layout.svelte`.

**Warning signs:** Fonts appear on some routes but fall back to system fonts on others (e.g., marketing pages vs app pages).

### Pitfall 4: Semantic Alias Naming Collision

**What goes wrong:** Semantic aliases like `--text` or `--border` are too generic and collide with existing component CSS that uses those names with different semantic intent.

**Why it happens:** v5.0 `app.css` already defines `--text`, `--border` etc. with the same names (just different values pointing to the dark palette). The semantic aliases must carry the same names so existing components get the auto-switching behaviour for free.

**How to avoid:** The v5.0 names (`--text`, `--bg`, `--border`) are deliberately preserved as semantic alias names. The new `--bg` points to `--fo-bg` in `:root` and to `--bo-bg` in `body.back-office`. Components using these names will automatically switch worlds without being modified. Only components using names that did NOT survive the rename need updating.

### Pitfall 5: DM Sans Variable vs Static Import

**What goes wrong:** Importing `@fontsource/dm-sans/400.css` (static package) instead of `@fontsource-variable/dm-sans/index.css` (variable package). The static package requires separate imports for each weight; using an unimported weight renders in 400 by default.

**Why it happens:** `@fontsource/dm-sans` and `@fontsource-variable/dm-sans` are different packages. The variable package provides a single font file covering the full weight axis.

**How to avoid:** Install and import `@fontsource-variable/dm-sans` — note the `-variable` segment. The CSS variable `font-weight` on `--font-body` elements will then work across the full 100–900 range.

### Pitfall 6: Missing Opacity Level in DS-05

**What goes wrong:** DS-05 requires `rgba(236, 232, 255, 0.52/0.42/0.24/0.14)`. The v2 guide Section 3.5 defines 5 levels but the `:root` reference block in Section 12 only names 3 (`--bo-text`, `--bo-muted`, `--bo-faint`). The 0.42 and 0.14 levels are used inline in component examples but not named as tokens.

**How to avoid:** Define all 5 opacity levels as named tokens in `:root`:
```css
--bo-text:    #ECE8FF;
--bo-muted:   rgba(236, 232, 255, 0.52);
--bo-caption: rgba(236, 232, 255, 0.42);   /* captions, accordion subs */
--bo-faint:   rgba(236, 232, 255, 0.24);
--bo-ghost:   rgba(236, 232, 255, 0.14);   /* barely-there */
```
This prevents inline rgba values from appearing in components (which would violate DS-05's spirit).

---

## Code Examples

### Complete `:root` Token Block

```css
/* Source: tasks/akasa-design-guide-v2.md Section 12 */
:root {
  /* ── FRONT OFFICE ──────────────────────────── */
  --fo-bg:      #F5F2EC;
  --fo-bg2:     #EDE9E0;
  --fo-bg3:     #E5E0D5;
  --fo-card:    #FDFAF6;
  --fo-border:  #D9CEBB;
  --fo-rule:    rgba(14, 13, 11, 0.10);
  --ink:        #0E0D0B;
  --muted:      #7A766D;
  --fo-plum:    #3D3560;
  --fo-plum-m:  #6B5FA0;
  --fo-plum-p:  #E8E5F4;
  --fo-gold:    #B8965A;
  --fo-gold-l:  #D4B47A;
  --fo-gold-p:  #F0E6D0;

  /* ── BACK OFFICE ───────────────────────────── */
  --bo-bg:      #06050E;
  --bo-card:    #100F20;
  --bo-border:  rgba(148, 110, 255, 0.13);
  --bo-bhi:     rgba(148, 110, 255, 0.32);
  --bo-text:    #ECE8FF;
  --bo-muted:   rgba(236, 232, 255, 0.52);
  --bo-caption: rgba(236, 232, 255, 0.42);
  --bo-faint:   rgba(236, 232, 255, 0.24);
  --bo-ghost:   rgba(236, 232, 255, 0.14);
  --bo-violet:  #7C3AED;
  --bo-vb:      #A78BFA;
  --bo-amber:   #FBBF24;
  --bo-teal:    #2DD4BF;
  --bo-rose:    #F472B6;

  /* ── SHARED — model tiers ─────────────────── */
  --tier-junior: #3B82F6;
  --tier-mid:    #8B5CF6;
  --tier-senior: #D97706;

  /* ── SHARED — agent identity ──────────────── */
  --agent-indra: #6B46A8;
  --agent-mira:  #D97706;
  --agent-kael:  #8B5CF6;
  --agent-asha:  #8B5CF6;
  --agent-contr: #3B82F6;

  /* ── SPACING ──────────────────────────────── */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  14px;
  --space-lg:  20px;
  --space-xl:  28px;
  --space-2xl: 40px;
  --space-3xl: 60px;

  /* ── RADIUS ───────────────────────────────── */
  --radius-sm: 3px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 50%;

  /* ── FONTS ────────────────────────────────── */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body:    'DM Sans', system-ui, -apple-system, sans-serif;
  --font-label:   'Press Start 2P', monospace;

  /* ── SEMANTIC ALIASES — default Front Office ─ */
  --bg:         var(--fo-bg);
  --bg2:        var(--fo-bg2);
  --bg3:        var(--fo-bg3);
  --card:       var(--fo-card);
  --border:     var(--fo-border);
  --rule:       var(--fo-rule);
  --text:       var(--ink);
  --text-muted: var(--muted);
  --accent:     var(--fo-plum);
  --accent-m:   var(--fo-plum-m);
  --accent-dim: var(--fo-plum-p);
  --karma:      var(--fo-gold);
}

/* ── BACK OFFICE OVERRIDE ──────────────────────── */
body.back-office {
  --bg:         var(--bo-bg);
  --bg2:        var(--bo-card);
  --bg3:        var(--bo-card);
  --card:       var(--bo-card);
  --border:     var(--bo-border);
  --rule:       var(--bo-border);
  --text:       var(--bo-text);
  --text-muted: var(--bo-muted);
  --accent:     var(--bo-violet);
  --accent-m:   var(--bo-vb);
  --accent-dim: rgba(124, 58, 237, 0.10);
  --karma:      var(--bo-amber);
}
```

### V5 Token Migration Map

The following old v5 token names have replacements. Components must be updated:

| Old (v5) | New Semantic Alias | Notes |
|----------|--------------------|-------|
| `--bg` | `--bg` | Preserved name, value auto-switches |
| `--bg-2` | `--bg2` | Renamed (hyphen removed) |
| `--bg-3` | `--bg3` | Renamed |
| `--bg-card` | `--card` | Renamed |
| `--bg-card-2` | `--card` | Collapsed — no second card level in v2 |
| `--border` | `--border` | Preserved name, value auto-switches |
| `--border-mid` | `--bo-border` / `var(--fo-rule)` | Context-specific; use raw token |
| `--border-hi` | `--bo-bhi` | Back Office only |
| `--text` | `--text` | Preserved name |
| `--text-muted` | `--text-muted` | Preserved name |
| `--text-faint` | `--bo-faint` | Back Office only |
| `--violet` | `--accent` / `--bo-violet` | Context-dependent |
| `--violet-bright` | `--bo-vb` | Back Office only |
| `--violet-light` | `--bo-vb` | Use `--bo-vb` |
| `--violet-dim` | `--accent-dim` / `rgba(124,58,237,0.10)` | Context-dependent |
| `--violet-glow` | `rgba(124, 58, 237, 0.08)` | Inline; no named token |
| `--amber` | `--karma` / `--bo-amber` | `--karma` in semantic context |
| `--amber-dim` | `rgba(251, 191, 36, 0.10)` | Inline |
| `--teal` | `--bo-teal` | Back Office only |
| `--teal-dim` | `rgba(45, 212, 191, 0.10)` | Inline |
| `--rose` | `--bo-rose` | Back Office only |
| `--rose-dim` | `rgba(244, 114, 182, 0.08)` | Inline |
| `--error` | (not in v2 guide) | Keep as-is or add `--error: #f87171` to shared tokens |
| `--font-display` | `--font-display` | Same name, new value (Cormorant Garamond) |
| `--font-body` | `--font-body` | Same name, new value (DM Sans) |
| `--font-mono` | not in v2 guide | Remove unless needed; JetBrains Mono not part of v2 system |
| `--s-1` | `--space-xs` (4px) | Renamed scale |
| `--s-2` | `--space-sm` (8px) | Renamed scale |
| `--s-3` | (no direct match — 12px) | Use `--space-sm` + `--space-md` or hardcode 12px |
| `--s-4` | `--space-lg` (20px? no — v5 was 16px) | **Mismatch**: v5 `--s-4` = 16px, v2 `--space-lg` = 20px. For 16px use `--space-md` (14px) or explicit value. |
| `--s-6` | `--space-2xl` (40px? no — v5 was 24px) | **Mismatch**: v5 `--s-6` = 24px. No direct v2 equivalent. Closest: `--space-xl` (28px). |
| `--s-8` | `--space-2xl` (40px? no — v5 was 32px) | **Mismatch**: v5 `--s-8` = 32px. Between `--space-xl` (28px) and `--space-2xl` (40px). |
| `--s-12` | `--space-3xl` (60px? no — v5 was 48px) | **Mismatch**: v5 `--s-12` = 48px, v2 `--space-3xl` = 60px. |

**Spacing mismatch is notable:** v5 used a pure 4px grid (4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48). v2 uses a non-linear scale (4, 8, 14, 20, 28, 40, 60). Components using v5 spacing tokens cannot be mechanically substituted — each use site needs visual review. This is acceptable because D-01 treats existing components as v5 artifacts to be rebuilt in Phase 3/4.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Fonts CDN link in `<head>` | `@fontsource` self-hosted packages | Industry shift 2022-2023 | No CDN dependency, GDPR-safe, offline-capable, Vite-integrated |
| `prefers-color-scheme` media query | Explicit class toggle (`body.back-office`) | Deliberate design choice | Akasa's two worlds are not light/dark mode — they are operational mode vs system mode. User controls explicitly, not OS preference. |
| Numeric spacing scale (`--s-1` through `--s-12`) | Named semantic scale (`--space-xs` through `--space-3xl`) | v2 guide introduces this | More readable, non-linear steps match actual design needs |

---

## Open Questions

1. **Error token inclusion**
   - What we know: v5.0 `app.css` defines `--error: #f87171` and `--error-dim`. The v2 design guide Section 12 CSS variables reference block does not include an error token.
   - What's unclear: Whether the v2 guide intentionally omits error states or simply did not document them (v2 is focused on brand tokens, not utility tokens).
   - Recommendation: Retain `--error: #f87171` as a utility token outside the `--fo-*`/`--bo-*` namespaces. It is unlikely to cause confusion and avoids breaking any form validation UI.

2. **Spacing mismatches for existing components**
   - What we know: v5 spacing is a pure 4px grid; v2 spacing is non-linear. 22 existing component files use `--s-*` tokens.
   - What's unclear: Whether those components are scheduled for visual rebuild in Phase 3/4 or if they need to remain functional between Phase 2 and Phase 3.
   - Recommendation: Per D-01, existing components are v5 artifacts. Plan Phase 2 to update the token names they use to the closest v2 equivalents (not visual perfection — just prevent CSS `undefined` breakage). Phase 3/4 does the visual rebuild with correct values.

3. **`--font-mono` removal**
   - What we know: v5 defines `--font-mono: 'JetBrains Mono', monospace`. The v2 guide does not include a monospace font.
   - What's unclear: Whether any existing component (code blocks, terminal outputs, log views) relies on `--font-mono`.
   - Recommendation: Grep for `--font-mono` uses before removing. If found, keep the token but remove the JetBrains Mono reference (use `monospace` fallback) since JetBrains Mono is not part of the v2 self-hosted font set.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely CSS, font packages, and build script changes with no external runtime dependencies beyond npm registry access (already available).

---

## Validation Architecture

`nyquist_validation` key absent from `.planning/config.json` — treating as enabled.

### Test Framework

No test infrastructure exists in `services/ui/` — no `vitest.config.*`, no `__tests__/` directory, no test script in `package.json`. This phase's deliverables are CSS tokens and font loading, which are not suitable for unit tests. Validation is visual inspection and CI lint.

| Property | Value |
|----------|-------|
| Framework | None — CSS/visual phase, no unit test framework |
| Config file | None |
| Quick run command | `pnpm lint:tokens` (verifies no banned token names) |
| Full suite command | `pnpm --filter @claw/ui build` (Vite build catches import errors) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | `--fo-*` tokens defined in `:root` with correct hex values | Lint + Visual | `pnpm lint:tokens` (negative — checks for banned patterns) | ❌ Wave 0 |
| DS-02 | `--bo-*` tokens defined in `:root` with correct values | Lint + Visual | `pnpm lint:tokens` | ❌ Wave 0 |
| DS-03 | `body.back-office` switches palette; localStorage persists choice | Manual/Visual | Browser test — toggle, reload, verify no flash | Manual only |
| DS-04 | Three fonts load from self-hosted packages, no Google Fonts requests | Build + Network | `pnpm --filter @claw/ui build` + DevTools Network tab | ❌ Wave 0 |
| DS-05 | Back Office text uses `rgba(236, 232, 255, N)` opacity scale only | Grep/Lint | `grep -rn "#[89][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]" services/ui/src/` (catches grey hex) | Manual only |
| DS-06 | Semantic colour constants in correct roles; no `#000000` | Lint | `grep -rn "#000000" services/ui/src/` | ❌ Wave 0 |
| DS-07 | Spacing/radius tokens match v2 guide values | Visual | Manual spot-check of spacing in browser | Manual only |

### Sampling Rate

- **Per task commit:** `pnpm lint:tokens` (blocks re-introduction of banned names)
- **Per wave merge:** `pnpm --filter @claw/ui build` (catches import errors, missing fonts)
- **Phase gate:** lint:tokens green + Vite build succeeds + visual verification in browser (both modes, both route groups)

### Wave 0 Gaps

- [ ] `lint:tokens` script — does not exist in root `package.json` yet; must be created as first task
- [ ] `pnpm --filter @claw/ui build` is available but must be confirmed to pass after token changes

*(No test framework setup needed — CSS phases do not warrant Vitest infrastructure at this stage)*

---

## Sources

### Primary (HIGH confidence)
- `tasks/akasa-design-guide-v2.md` — Complete CSS variables reference (Section 12), font loading spec (Section 13), colour palettes (Sections 3.1–3.6), spacing/radius (Sections 5.1–5.6). All token values read directly from this file.
- `services/ui/src/app.css` — Full v5.0 token inventory read directly. All 22 files using old tokens identified via grep.
- `services/ui/src/routes/+layout.svelte` — Confirmed minimal structure (4 lines), ready for font imports.
- `services/ui/src/app.html` — Confirmed structure; location for blocking mode-detection script.
- `services/ui/package.json` — No `@fontsource` packages installed yet. Dependencies confirmed.
- `.planning/phases/02-design-system-tokens-and-typography/02-CONTEXT.md` — All locked decisions (D-01 through D-07) read verbatim.

### Secondary (MEDIUM confidence)
- npm registry — `@fontsource/cormorant-garamond@5.2.11`, `@fontsource-variable/dm-sans@5.2.8`, `@fontsource/press-start-2p@5.2.7` — versions verified against live registry on 2026-03-23.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Token values: HIGH — read directly from `akasa-design-guide-v2.md` Section 12 (the authoritative source)
- Font packages: HIGH — version confirmed against npm registry
- SvelteKit font import pattern: HIGH — standard `@fontsource` + Vite integration pattern, confirmed via package structure inspection
- Blocking script pattern: HIGH — well-established zero-flash technique; exact placement variant (before `%sveltekit.body%`) verified safe by SvelteKit HTML template rules
- Component token impact (22 files): HIGH — grep confirmed the set of affected files; migration map derived from direct comparison of v5 and v2 token sets

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (token specs stable; fontsource packages update incrementally, patch versions safe to use)
