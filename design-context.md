# Claw Army — Design Language

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5 (runes API: `$state`, `$derived`, `$effect`, `$props`)
- **Styling**: Vanilla CSS with CSS custom properties — no Tailwind, no CSS modules, no preprocessors
- **Components**: Fully bespoke — no component library (no shadcn, no Radix, no DaisyUI)
- **Scoped styles**: Every component uses Svelte `<style>` blocks (auto-scoped)
- **Fonts**: Google Fonts (Inter, JetBrains Mono) + Fontshare (Clash Display)
- **Theme**: Dark mode only — no light mode, no theme toggle

---

## Color System

### Backgrounds (deep near-black purples)

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#07060f` | Page base |
| `--bg-2` | `#0c0b18` | Alternating sections, table headers |
| `--bg-3` | `#100f1e` | Inputs, form elements, alternating rows |
| `--bg-card` | `#131224` | Cards, panels |
| `--bg-card-2` | `#110f20` | Card/row hover state |

### Borders (violet-tinted, translucent)

| Token | Value | Use |
|---|---|---|
| `--border` | `rgba(148,110,255, 0.10)` | Default/subtle |
| `--border-mid` | `rgba(148,110,255, 0.20)` | Hover, focus |
| `--border-hi` | `rgba(148,110,255, 0.32)` | Active, selected, focus ring |

### Text

| Token | Value | Use |
|---|---|---|
| `--text` | `#ece8ff` | Primary text (near-white, violet tint) |
| `--text-muted` | `rgba(236,232,255, 0.50)` | Secondary, descriptions |
| `--text-faint` | `rgba(236,232,255, 0.22)` | Labels, hints, table headers |

### Primary — Violet

| Token | Value | Use |
|---|---|---|
| `--violet` | `#7c3aed` | Primary actions, buttons, accents |
| `--violet-bright` | `#a78bfa` | Links, highlights, emphasis |
| `--violet-light` | `#c4b5fd` | Soft accent |
| `--violet-dim` | `rgba(124,58,237, 0.14)` | Selected state backgrounds |
| `--violet-glow` | `rgba(124,58,237, 0.08)` | Very subtle tint |

### Semantic Accent Colors

| Color | Solid | Dim | Semantic Use |
|---|---|---|---|
| Amber | `#fbbf24` | `rgba(251,191,36, 0.10)` | Spawning, idle, stopping, Artisan tier |
| Teal | `#2dd4bf` | `rgba(45,212,191, 0.10)` | Running, working, completed, Understudy tier |
| Rose | `#f472b6` | `rgba(244,114,182, 0.08)` | Retired tier, retirement concept |
| Error | `#f87171` | `rgba(248,113,113, 0.10)` | Failures, validation errors |

### Glitch Effect

| Token | Value |
|---|---|
| `--glitch-r` | `rgba(255,60,120, 0.7)` — red/magenta channel |
| `--glitch-b` | `rgba(60,180,255, 0.7)` — cyan/blue channel |

---

## Typography

### Font Families

| Token | Stack | Use |
|---|---|---|
| `--font-display` | `'Clash Display', 'Inter', system-ui, sans-serif` | Headings, logos, large display text |
| `--font-body` | `'Inter', system-ui, sans-serif` | Body copy, UI text, buttons |
| `--font-mono` | `'JetBrains Mono', monospace` | Labels, badges, IDs, stats, code, terminal |

### Font Loading

- **Inter**: Google Fonts — weights 300, 400, 500
- **JetBrains Mono**: Google Fonts — weights 300, 400
- **Clash Display**: Fontshare — weights 400, 500, 600, 700

### Type Scale

| Element | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Hero H1 | `clamp(52px, 7.5vw, 102px)` | 600 | `-0.025em` | `1.0` |
| Section H2 | `clamp(36px, 4.5vw, 64px)` | 600 | `-0.02em` | `1.05` |
| Page H1 (inner) | `clamp(1.75rem, 4vw, 2.5rem)` | 600 | `-0.02em` | `1.1` |
| Body text | `16.5px` | 300 | normal | `1.82` |
| Body (UI) | `14–15px` | 300–400 | normal | `1.65–1.78` |
| Base body | `16px` | 300 | normal | `1.65` |
| Metric values | `1.75–2.25rem` | 400 (mono) | `-0.02em` | — |
| Section labels | `10px` | 400 (mono) | `0.22em` | — |
| Badges/pills | `9–10px` | 400 (mono) | `0.10–0.18em` | — |
| Buttons | `13–14px` | 400–500 (body) | `0.03–0.04em` | — |

### Type Rules

- Section labels: always `--font-mono`, `10px`, `uppercase`, `letter-spacing: 0.22em`, `color: var(--text-faint)`
- All data/metadata: `--font-mono` (IDs, stats, status text, table headers)
- Headlines use tight negative tracking (`-0.02em` to `-0.025em`)
- Body text is light weight (300) for readability on dark backgrounds

---

## Spacing

4px base scale defined as CSS custom properties:

```
--s-1:  4px     --s-5:  20px    --s-9:  36px
--s-2:  8px     --s-6:  24px    --s-10: 40px
--s-3:  12px    --s-7:  28px    --s-11: 44px
--s-4:  16px    --s-8:  32px    --s-12: 48px
```

---

## Border Radius

| Size | Value | Use |
|---|---|---|
| XS | `4px` | Close buttons, tiny elements |
| S | `6px` | Small chips, code blocks |
| M | `7–8px` | Inputs, buttons |
| L | `10–12px` | Metric cards, task rows |
| XL | `14px` | Cards, panels, toasts, primary containers |
| XXL | `16px` | Large section containers |
| Pill | `100px` / `9999px` | Status badges, tier tags, category pills |

---

## Layout

### Content Wrappers

```css
.w  { max-width: 1160px; margin: 0 auto; padding: 0 36px; }  /* full-width */
.ws { max-width: 700px;  margin: 0 auto; padding: 0 36px; }  /* narrow/centered */
```

### Inner App Page Containers

```css
max-width: 760px   /* forms (new-execution) */
max-width: 960px   /* detail pages */
max-width: 1000px  /* dashboards (objectives, billing) */
margin: 0 auto; padding: 96–100px 36px 80px;
```

### Grid Patterns

| Pattern | Columns | Use |
|---|---|---|
| 2-col equal | `1fr 1fr` | Problem/soul/agent sections |
| 3-col equal | `repeat(3, 1fr)` | Steps, human cards, tier cards |
| 4-col metrics | `repeat(4, 1fr)` | Metric dashboards |
| Auto-fill | `repeat(auto-fill, minmax(200px, 1fr))` | Bot card grids |

### Section Spacing

- Marketing sections: `padding: 128px 0`
- Inner app sections: `margin-bottom: 32px` between groups

---

## Components

### Cards

```css
background: var(--bg-card);
border: 1px solid var(--border);
border-radius: 14px;
padding: 16–44px;
transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
```

**Hover state:**
```css
border-color: var(--border-mid);
transform: translateY(-4px);
box-shadow: 0 12px 40px rgba(0,0,0,0.5);
```

**Top-edge highlight** (common on interactive cards via `::before`):
```css
background: linear-gradient(90deg, transparent, rgba(167,139,250,0.25), transparent);
height: 1px; top: 0;
```

**Status left-border variant** (bot cards, event rows):
```css
border-left: 3px solid var(--teal | --error | --amber);
```

### Buttons

**Primary** (`btn-primary`):
```css
padding: 15px 36px;
background: var(--violet);
color: #fff;
border-radius: 7px;
font-size: 14px; font-weight: 500; letter-spacing: 0.03em;
box-shadow: 0 4px 28px rgba(124,58,237,0.35);
/* hover: translateY(-2px), deeper shadow, opacity 0.88 */
```

**Ghost** (`btn-ghost`):
```css
background: none; border: none;
color: var(--text-muted);
font-size: 14px; font-weight: 400;
/* hover: color var(--text) */
```

**Nav/Outline** (`btn-nav`):
```css
padding: 9px 22px;
background: var(--violet-dim);
border: 1px solid rgba(167,139,250,0.28);
border-radius: 7px;
color: var(--violet-bright);
font-size: 13px; letter-spacing: 0.04em;
/* hover: fills with --violet, white text */
```

**Secondary** (analysis/action buttons):
```css
background: var(--bg-3);
border: 1px solid var(--border);
/* hover: bg-2 + border-mid */
```

**Disabled**: `opacity: 0.45; cursor: not-allowed;`

### Badges / Pills

Universal pattern:
```css
font-family: var(--font-mono);
font-size: 9–10px;
text-transform: uppercase;
letter-spacing: 0.10–0.18em;
padding: 3px 8–12px;
border-radius: 100px;
```

**Status color mapping:**

| Status | Color | Background |
|---|---|---|
| `running` / `working` / `completed` | `--teal` | `--teal-dim` |
| `spawning` / `idle` / `stopping` / `paused` | `--amber` | `--amber-dim` |
| `failed` / `error` | `--error` | `--error-dim` |
| `completed` (objectives) | `--violet-bright` | `--violet-dim` |
| `queued` | `--text-faint` | transparent |

**Agent tier mapping:**

| Tier | Color | Background | Extra |
|---|---|---|---|
| Novice | `--text-muted` | transparent | — |
| Understudy | `--teal` | `--teal-dim` | — |
| Artisan | `--amber` | `--amber-dim` | Animated breathing dot |
| Retired | `--rose` | `--rose-dim` | — |

### Form Elements

```css
background: var(--bg-3);
border: 1px solid var(--border);
border-radius: 8px;
color: var(--text);
font-family: var(--font-body);
font-weight: 300;
```

**Focus state:**
```css
border-color: var(--border-hi);
box-shadow: 0 0 0 3px var(--violet-dim);
```

**Numbered panel pattern** (multi-step forms):
```css
.panel { background: var(--bg-card); border-radius: 14px; border: 1px solid var(--border); }
.panel-label { font-family: var(--font-mono); 10px; 0.22em tracking; uppercase; }
.panel-tag { color: var(--violet-bright); /* "01", "02", etc. */ }
/* focus-within: border-color var(--border-mid) */
```

### Tables

```css
/* Header */
thead th { background: var(--bg-3); font-family: var(--font-mono); font-size: 9.5–10px;
           text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-faint); }

/* Body */
tbody td { background: var(--bg-card); }
/* alternating rows: var(--bg-3) */
/* hover: var(--bg-card-2) */
border-bottom: 1px solid var(--border);

/* Wrapper */
.table-wrapper { overflow-x: auto; border-radius: 14px; border: 1px solid var(--border); }
```

### Slide-over Panel

```css
position: fixed; right: 0; top: 0; bottom: 0;
width: 100%; max-width: 480px;
background: var(--bg-card);
border-left: 1px solid var(--border-mid);
box-shadow: -4px 0 40px rgba(7,6,15,0.6);
animation: slideIn 0.25s ease-out; /* translateX(100%) → 0 */
```

Backdrop: `rgba(7,6,15, 0.7)` full-screen overlay.

### Toast Notifications

```css
position: fixed; top: 80px; right: 20px; z-index: 600;
background: var(--bg-card);
border-radius: 10px;
border: 1px solid var(--border);
border-left: 3px solid <status-color>;
box-shadow: 0 8px 24px rgba(0,0,0,0.4);
animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1);
```

### Section Headings (app pages)

Mono-font label with gradient line:
```css
font-family: var(--font-mono);
font-size: 10px;
letter-spacing: 0.22em;
text-transform: uppercase;
color: var(--text-faint);

/* Gradient line extends right */
h3::after {
  flex: 1; height: 1px;
  background: linear-gradient(90deg, var(--border-mid), transparent);
}
```

### Terminal Widget (landing page)

```css
background: var(--bg-card);
border-radius: 14px;
border: 1px solid var(--border);

/* Title bar with macOS dots */
.t-bar { background: var(--bg-2); /* red/yellow/green dots at 50% opacity */ }

/* Body */
font-family: var(--font-mono);
font-size: 12.5px;
/* Color coding: violet=prompt, teal=keys, amber=values, faint=comments */
/* Blinking cursor: violet-bright with glow box-shadow */
```

---

## Animation & Motion

### Transition Defaults

| Duration | Properties | Use |
|---|---|---|
| `0.2s` | color, opacity, border-color | Standard hover |
| `0.3s` | background, border-color | Card state changes |
| `0.35s` | transform, box-shadow | Lift/hover effects |

### Keyframe Animations

| Name | Duration | Description |
|---|---|---|
| `af1` / `af2` / `af3` | 18–30s | Aurora blob floating movement |
| `glitch-top` / `glitch-bot` | 5–8s | Chromatic aberration text effect |
| `lm-spin` / `lm-spin-r` | 12–18s | Logo polygon rotation (counter-rotating) |
| `lm-pulse` | 3s | Logo core dot opacity |
| `breathe` | 3s | Artisan tier pip scale + glow pulse |
| `pulse-dot` | 2.5s | Live status dot opacity |
| `cur` | 1.1s | Terminal cursor blink |
| `pulse-verdict` | 2s | Verdict pending button pulse |
| `slideIn` | 0.25s | Toast/panel slide from right |
| `spin` | 0.65s | Loading spinner |

### Scroll Reveal System

```css
.r    { opacity: 0; transform: translateY(20px);
        transition: 0.85s cubic-bezier(0.16,1,0.3,1); }
.r.on { opacity: 1; transform: none; }
.d1–.d5 { transition-delay: 0.07s → 0.50s; } /* staggered */
```

Triggered via `IntersectionObserver` on the landing page.

---

## Background Effects

| Effect | Implementation |
|---|---|
| **Particle canvas** | 130 floating micro-particles (violet/amber/teal) in fixed `<canvas>` |
| **Aurora blobs** | `filter: blur(60–80px)` radial gradient divs, animated with `af1/2/3` |
| **Noise grain** | Fixed SVG `fractalNoise` filter on `body::after`, `opacity: 0.032` |
| **Perspective grid** | CSS `linear-gradient` grid lines with `mask-image` radial fade on hero |

---

## Responsive Breakpoints

| Breakpoint | Changes |
|---|---|
| `960px` | Nav links hide, 2-col → 1-col, padding 36px → 24px |
| `768px` | Billing stats 3-col → 2-col |
| `640px` | Metrics 4-col → 2-col |
| `600px` | Form row panels collapse, page padding → 20px |
| `480px` | Stats grid → 1-col |

---

## Visual Identity Summary

The aesthetic is **dark sci-fi / hacker-terminal SaaS** — cyberpunk-influenced with an "operational intelligence" feel.

**Key signature choices:**
- Near-black violet-tinted backgrounds — never pure black
- Violet as primary action color; teal/amber/rose as semantic status colors
- Heavy use of `JetBrains Mono` for all data, labels, and metadata — conveys technical/operational feel
- `Clash Display` for all headlines with tight negative tracking
- Glowing dots, animated particles, aurora blob backgrounds
- Numbered panel steps in forms (`01`, `02`, etc.)
- Section labels in 10px uppercase mono with gradient-line decorators
- Pill badges everywhere with semantic color coding
- Cards have no shadow at rest — shadow + lift appears on hover (`translateY(-4px)`)
- Subtle top-edge highlight via `::before` linear-gradient on interactive cards
- Film grain overlay on entire UI via SVG noise filter
