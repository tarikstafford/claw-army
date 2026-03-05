# Claw Army — Interface Design System

## Intent

**Who:** Technical operators and founders in mission-launch mode. Decisive, comfortable with domain/provider concepts, wants to configure and fire fast.

**What they do:** Launch AI bot crews against objectives. Monitor live execution. Review performance.

**Feel:** Mission control terminal. Deep navy canvas, electric blue as the single signal color. Dense but not cluttered. Every element earns its place.

---

## Palette

```
--canvas:    #090d18   /* deep space navy — the ground everything sits on */
--surface-0: #0d1221
--surface-1: #121a2c   /* card background */
--surface-2: #192236   /* input background, inner panels */
--surface-3: #1e293f   /* hover state */

--signal:        #3d7eff   /* electric blue — ONE accent, used sparingly */
--signal-tint:   rgba(61, 126, 255, 0.10)
--signal-border: rgba(61, 126, 255, 0.32)

--active:        #22c55e   /* green — live, selected, allowed */
--active-tint:   rgba(34, 197, 94, 0.10)
--active-border: rgba(34, 197, 94, 0.30)

--alert:    #f59e0b   /* amber — warnings, budget events */
--critical: #ef4444   /* red — errors, failures */
```

**Why this palette:** Deep navy reads as command infrastructure — server rooms, terminals, mission dashboards. Blue is the only accent because restraint signals confidence. Green is reserved for live/active states only.

---

## Typography

System stack: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

Monospace stack: `ui-monospace, 'SF Mono', 'Cascadia Mono', monospace`

- **Monospace is used for:** numbers, metrics, codes, tags, status badges, domain lists, technical identifiers
- **Prose font is used for:** labels, descriptions, body copy

**Why system fonts:** The product lives in the browser alongside DevTools, terminals, dashboards. Matching the OS font reads as native infrastructure, not a consumer app.

---

## Depth

Borders only — no shadows on cards or panels. Surfaces elevate strictly through background color:

```
canvas → surface-0 → surface-1 → surface-2 → surface-3
```

**Why no shadows:** Shadows imply physical depth and warmth. This product is a control surface — flat, layered planes read as a terminal, not a card deck.

---

## Spacing

Base unit: 8px (`--s-4 = 1rem`)

Scale: `--s-1` (2px) through `--s-24` (6rem). Use the scale — never raw pixel values.

---

## Radius

```
--r-sm: 3px   /* inputs, buttons, badges — tight, not pill */
--r-md: 6px   /* cards, panels */
--r-lg: 10px  /* large containers */
```

---

## Components

### Panel

The primary container unit in forms and dashboards.

```css
background: var(--surface-1);
border: 1px solid var(--border);
border-radius: var(--r-md);
padding: var(--s-5) var(--s-6);
```

Panel label uses uppercase tracking + monospace step number in signal color.

### Toggle Button (tool-toggle)

Used for binary or single-select choices (provider selection, feature flags). NOT checkbox-style — clicking once selects, clicking another deselects.

- **Inactive:** surface-2 background, faint border, circle SVG in indicator
- **Active:** active-tint background, active-border, checkmark SVG, green badge

Badge text conventions:
- Feature toggles: `ALLOWED` / `BLOCKED`
- Single-select (provider): `SELECTED` on active only, nothing on inactive

### Monospace Input

For technical values (domain lists, API keys, identifiers):

```css
font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', monospace;
font-size: 0.8125rem;
line-height: 1.7;
```

Applied as an additional class on the shared `textarea` base.

### Status Badges

```
font-family: monospace
font-size: 0.625rem
font-weight: 700
letter-spacing: 0.08em
padding: 0.1875rem 0.4375rem
border-radius: var(--r-sm)
```

Colors follow semantic tokens: signal (info), active (live/ok), alert (warning), critical (error).

### Row Panels

Two equal-width panels side by side, gap `--s-4`. Used for paired config controls (Crew Size + Budget, LLM Provider + Egress Perimeter).

```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: var(--s-4);
```

Collapses to single column below 600px.

---

## Copy Conventions

- **Mission language throughout:** "crew", "deploy", "mission", "objective", "perimeter" — not "team", "run", "task", "goal", "filter"
- **Step numbers:** monospace `01` / `02` etc — signal colored, no period
- **Section tags:** 2-letter monospace all-caps in a tinted pill (`EP`, `EX`, `MC`)
- **Metric display:** large monospace number + small muted label below
- **Hints:** `0.8125rem`, `--text-muted`, 1.5 line height — below the label, above the input

### Page Header

Every admin page uses the same header stack:

```
back-link → sec-label → Clash Display h1
```

- **Back-link:** inline-flex with left-arrow SVG, mono 12px, `--text-muted`, hover → `--violet-bright`
- **sec-label:** mono 10px, uppercase, 0.22em tracking, `--text-faint`, with `::after` gradient line
- **h1:** `font-family: var(--font-display)`, `clamp(1.75rem, 4vw, 2.5rem)`, weight 600, -0.02em tracking
- IDs in h1 use `<code>` with `--font-mono` in `--violet-bright`

### Identity Strip

A contained bar below the page header showing entity metadata (status, class, tier, live indicator). Actions right-aligned.

```css
display: flex;
align-items: center;
justify-content: space-between;
padding: var(--s-4) var(--s-5);
background: var(--bg-card);
border: 1px solid var(--border);
border-radius: 6px;
```

### Hero Metrics

Top-level KPIs displayed large before detail grids. Primary metric gets signal-colored value and `--border-mid` border.

```css
.hero-row {
  display: grid;
  grid-template-columns: 1.4fr repeat(3, 1fr); /* primary wider */
  gap: var(--s-4);
}

.hero-value {
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 700;
}

.hero-primary .hero-value {
  color: var(--violet-bright);
}
```

### Detail Grid (borderless)

Dense secondary metrics using 1px gap dividers instead of card borders. Feels like a data table without the table.

```css
display: grid;
grid-template-columns: repeat(5, 1fr);
gap: 1px;
background: var(--border);
border: 1px solid var(--border);
border-radius: 6px;
overflow: hidden;
```

Each cell: `background: var(--bg-card)`, value above label.

### Dimension Cards (soul detail)

Each behavioral dimension gets a card with a 2-letter signal-colored tag + uppercase mono label.

```css
.dimension-tag {
  width: 28px; height: 20px;
  border-radius: 3px;
  background: var(--violet-dim);
  color: var(--violet-bright);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
}
```

### Action Buttons (inline)

Used in identity strips and table rows. Not primary CTAs — those use `.btn-primary`.

```css
font-family: var(--font-mono);
font-size: 0.6875rem;
font-weight: 600;
letter-spacing: 0.06em;
text-transform: uppercase;
padding: 6px var(--s-4);
border-radius: 3px;
border: 1px solid var(--border);
background: transparent;
color: var(--violet-bright);
```

### Error Cards

Left-border accent pattern for inline errors:

```css
background: var(--error-dim);
border: 1px solid rgba(248, 113, 113, 0.2);
border-left: 3px solid var(--error);
border-radius: 6px;
```

---

## What to Avoid

- Shadows on cards (breaks the terminal feel)
- More than one accent color per view
- Pill/full-radius buttons or badges (use `--r-sm` = 3px)
- `border-radius: 9999px` on anything — use 3px for badges, 6px for cards
- `border-radius: 14px` — too rounded for terminal aesthetic, use 6px
- Warm surface colors (beige, cream — wrong world entirely)
- Emoji in UI copy
- "Clean", "modern", "minimal" as design goals — describe the *world*, not the aesthetic
- Raw pixel values for spacing — always use `--s-*` tokens
- `box-shadow` on cards or panels — depth comes from background color only
- Plain `font-size: 1.75rem` on h1 — always use Clash Display with clamp()
