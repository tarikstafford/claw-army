# Akasa Design Guide
### Visual Language Reference v1.0

> This guide is for designers and engineers building on the Akasa platform. It covers both product worlds — the Screenplay (light) and the Director's Cut (dark) — with complete specs, code snippets, and explicit do/don't rules.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [The Two Worlds](#2-the-two-worlds)
3. [Colour](#3-colour)
4. [Typography](#4-typography)
5. [Spacing and Layout](#5-spacing-and-layout)
6. [Components](#6-components)
7. [Motion and Animation](#7-motion-and-animation)
8. [Iconography and Symbols](#8-iconography-and-symbols)
9. [Do / Don't](#9-do--dont)
10. [CSS Variables Reference](#10-css-variables-reference)
11. [Font Loading](#11-font-loading)

---

## 1. Design Principles

**Execution over decoration.** Every visual decision earns its place by making the product faster to understand or easier to trust. Decoration for its own sake is always wrong.

**Two modes, one product.** The Screenplay and Director's Cut are not separate products with separate aesthetics. They are the same product in two registers — one for founders demonstrating, one for engineers building. Every colour, every font, every spacing decision must work in both.

**Legibility is not optional.** Press Start 2P is a branding element, not a reading font. If something needs to be read at length, it uses DM Sans. If it needs to make an editorial impression, it uses Cormorant Garamond. Press Start 2P handles labels, tags, and UI chrome only.

**Karma compounds, so does craft.** The product is about systems that improve over time. The design should feel like it was built to last — considered, not rushed, with genuine precision in the details.

---

## 2. The Two Worlds

Akasa has two rendering contexts that share the same token set but apply it differently.

### Screenplay (Light / Warm)

Used for: user-facing demo, onboarding flow, chat interface, the Office scene.

The paper palette. Warm creams, deep plum, burnished gold. Feels like an editorial product — considered and premium without being cold.

### Director's Cut (Dark / Deep)

Used for: co-founder technical view, system architecture, mechanics documentation, integrations.

The void palette. Near-black background, violet accents, amber for the karma/IP moat system. Feels like infrastructure — serious, technical, authoritative.

### Switching Between Worlds

The `body.system` class controls which world is active. All dark-world styles are scoped to this class.

```css
/* Default: Screenplay (light) */
body { background: var(--h-bg); color: var(--ink); }

/* Director's Cut active */
body.system { background: var(--d-bg); color: var(--d-text); }
```

Toggle in JS:

```js
function setMode(mode) {
  document.body.classList.toggle('system', mode === 'system');
}
```

---

## 3. Colour

### 3.1 Director's Cut — Dark Palette

```css
:root {
  --d-bg:       #06050E;   /* Page background — near black, not pure black */
  --d-card:     #100F20;   /* Card and surface background */
  --d-border:   rgba(148, 110, 255, 0.13);  /* Default border */
  --d-bhi:      rgba(148, 110, 255, 0.32);  /* Hover/active border */
  --d-text:     #ECE8FF;   /* Primary text */
  --d-muted:    rgba(236, 232, 255, 0.52);  /* Secondary text */
  --d-faint:    rgba(236, 232, 255, 0.24);  /* Tertiary text / labels */
  --d-vio:      #7C3AED;   /* Violet — Indra, primary actions */
  --d-vb:       #A78BFA;   /* Violet bright — tags, accents */
  --d-amb:      #FBBF24;   /* Amber — karma, IP moat, compounding */
  --d-teal:     #2DD4BF;   /* Teal — execution, agents active */
  --d-rose:     #F472B6;   /* Rose — contractors, Tool Nexus */
}
```

**Colour meaning in the dark world:**

| Colour | Variable | Meaning |
|--------|----------|---------|
| Violet `#7C3AED` | `--d-vio` | Indra, coordination, primary actions |
| Violet bright `#A78BFA` | `--d-vb` | Tags, labels, soul mechanics |
| Amber `#FBBF24` | `--d-amb` | Karma, IP moat, compounding value |
| Teal `#2DD4BF` | `--d-teal` | Execution in progress, agents active |
| Rose `#F472B6` | `--d-rose` | Contractors, Tool Nexus, temporary |
| Blue `#3B82F6` | — | Junior tier / Haiku model |
| Violet mid `#8B5CF6` | — | Mid-level tier / Sonnet model |
| Amber dark `#D97706` | — | Senior tier / Opus model |

### 3.2 Screenplay — Light Palette

```css
:root {
  --h-bg:       #F5F2EC;   /* Warm paper — primary background */
  --h-bg2:      #EDE9E0;   /* Slightly darker paper — alternating sections */
  --h-bg3:      #E5E0D5;   /* Deepest paper — active state backgrounds */
  --h-card:     #FDFAF6;   /* Card surface — near white warm */
  --h-border:   #D9CEBB;   /* Default border */
  --ink:        #0E0D0B;   /* Primary text — warm black */
  --muted:      #7A766D;   /* Secondary text */
  --rule:       rgba(14, 13, 11, 0.10);  /* Dividers */
  --plum:       #3D3560;   /* Primary brand — Indra, CTAs */
  --plum-m:     #6B5FA0;   /* Mid plum — hover states, links */
  --plum-p:     #E8E5F4;   /* Pale plum — light backgrounds, avatars */
  --gold:       #B8965A;   /* Gold — karma score, premium signal */
  --gold-l:     #D4B47A;   /* Light gold */
  --gold-p:     #F0E6D0;   /* Pale gold — very light backgrounds */
}
```

### 3.3 Model Tier Colours

These are shared across both worlds and used consistently everywhere a model tier is displayed.

```css
/* These are NOT on :root — use inline or define per-component */
--junior:  #3B82F6;   /* Haiku — blue */
--mid:     #8B5CF6;   /* Sonnet — violet */
--senior:  #D97706;   /* Opus — amber/gold */
```

**Tier badge CSS:**

```css
.tier-badge {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  padding: 3px 7px;
  border-radius: 2px;
  letter-spacing: 0.08em;
}

.tier-junior {
  background: rgba(59, 130, 246, 0.12);
  color: #3B82F6;
  border: 1px solid rgba(59, 130, 246, 0.30);
}

.tier-mid {
  background: rgba(139, 92, 246, 0.12);
  color: #8B5CF6;
  border: 1px solid rgba(139, 92, 246, 0.30);
}

.tier-senior {
  background: rgba(217, 119, 6, 0.12);
  color: #D97706;
  border: 1px solid rgba(217, 119, 6, 0.30);
}
```

### 3.4 Opacity Scale

Akasa uses opacity variants of `#ECE8FF` (the primary light text colour) for text hierarchy in the dark world — not multiple grey hex values.

| Role | Value |
|------|-------|
| Primary text | `#ECE8FF` — full opacity |
| Secondary text | `rgba(236, 232, 255, 0.52)` |
| Tertiary text / captions | `rgba(236, 232, 255, 0.42)` |
| Faint / labels | `rgba(236, 232, 255, 0.24)` |
| Barely-there | `rgba(236, 232, 255, 0.14)` |

---

## 4. Typography

### 4.1 The Three Typefaces

| Typeface | Role | Use |
|----------|------|-----|
| Cormorant Garamond | Display | Headings, titles, pull quotes, section names |
| DM Sans | Body | All body copy, UI text, descriptions, anything read at length |
| Press Start 2P | Labels | Tags, badges, micro-labels, step numbers, system indicators |

**Non-negotiable rules:**
- Press Start 2P is never used above 8px in production
- Cormorant Garamond is never used for body copy or anything below 14px
- DM Sans is the fallback for everything — when in doubt, DM Sans

### 4.2 Type Scale

#### Cormorant Garamond (Display)

```css
/* Hero / section title */
.display-hero {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 300;
  line-height: 1.05;
  letter-spacing: -0.01em;
  color: var(--d-text);
}

/* Section heading */
.display-h1 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(26px, 3.5vw, 38px);
  font-weight: 600;
  line-height: 1.1;
  color: var(--d-text);
}

/* Card title */
.display-h2 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--d-text);
}

/* Italic variant — for taglines and pull quotes */
.display-italic {
  font-style: italic;
  color: var(--d-vb);  /* Violet accent on dark */
  /* or */
  color: var(--gold);  /* Gold accent on light */
}
```

#### DM Sans (Body)

```css
/* Primary body text */
.body-primary {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.8;
  color: var(--d-muted);
}

/* UI text — buttons, labels, inputs */
.body-ui {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--d-text);
}

/* Small / captions */
.body-small {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--d-muted);
  font-style: italic;
}

/* Strong within body */
.body-primary strong {
  color: var(--d-text);
  font-weight: 500;
}
```

#### Press Start 2P (Labels)

```css
/* Standard label / tag */
.label-tag {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  letter-spacing: 0.10em;
  color: var(--d-vb);
  text-transform: uppercase;
}

/* Step number */
.label-step {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: var(--d-vb);
}

/* System status indicator */
.label-status {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  letter-spacing: 0.14em;
  color: rgba(236, 232, 255, 0.25);
}

/* Section eyebrow */
.label-eyebrow {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  letter-spacing: 0.18em;
  color: rgba(167, 139, 250, 0.55);
  margin-bottom: 10px;
}
```

### 4.3 Italic Usage

Italics in Cormorant Garamond are a primary design tool — they carry the editorial warmth of the brand. Use them for:
- Taglines: *"Where agents enrich their souls."*
- Pull quotes
- Card summary lines (at 42% opacity)
- Accent words within a display heading

```css
/* Accent word in heading */
.display-h1 em {
  font-style: italic;
  color: var(--d-vb);  /* dark mode */
}

.display-h1 em {
  font-style: italic;
  color: var(--gold);  /* light mode */
}
```

---

## 5. Spacing and Layout

### 5.1 Spacing Scale

Akasa uses a consistent spacing scale. Do not use arbitrary values.

```css
--space-xs:   4px;
--space-sm:   8px;
--space-md:   14px;
--space-lg:   20px;
--space-xl:   28px;
--space-2xl:  40px;
--space-3xl:  60px;
```

### 5.2 Section Padding

```css
/* Standard section */
.section {
  padding: 28px 40px;
}

/* Tight section */
.section-tight {
  padding: 20px 40px;
}

/* Bottom section with extra breathing room */
.section-terminal {
  padding: 24px 40px 80px;
}
```

### 5.3 Card Padding

```css
/* Standard card */
.card {
  padding: 18px 20px;
}

/* Compact card (inside grids) */
.card-compact {
  padding: 14px 16px;
}

/* Feature card */
.card-feature {
  padding: 20px 22px;
}
```

### 5.4 Grid Systems

```css
/* Mechanic cards — 3 col */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

/* Tier cards — 3 col */
.grid-tiers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

/* How it works — 4 col */
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* Integrations — 4 col */
.grid-integrations {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* Dashboard metrics — 4 col */
.grid-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
```

### 5.5 Dividers

```css
/* Standard divider */
.divider {
  border: none;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
  margin: 0 40px;
}

/* Divider within a section (no horizontal margin) */
.divider-inner {
  border: none;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
  margin: 20px 0;
}
```

---

## 6. Components

### 6.1 Mechanic Cards (Director's Cut)

The primary expandable content unit.

```html
<div class="mcard" onclick="openModal(i)">
  <div class="mcard-tag-line">SOUL ARCHITECTURE</div>
  <div class="mcard-title-line">The Soul — SOUL.md</div>
  <div class="mcard-summary-line">The behavioural constitution that lives inside every agent.</div>
  <div class="mcard-cta">CLICK TO EXPAND →</div>
</div>
```

```css
.mcard {
  background: #100F20;
  border: 1px solid rgba(148, 110, 255, 0.15);
  border-radius: 6px;
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}

.mcard:hover {
  border-color: rgba(148, 110, 255, 0.38);
  transform: translateY(-2px);
}

.mcard-tag-line {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: #A78BFA;
  letter-spacing: 0.10em;
  margin-bottom: 9px;
}

.mcard-title-line {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 600;
  color: #ECE8FF;
  margin-bottom: 6px;
}

.mcard-summary-line {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-style: italic;
  color: rgba(236, 232, 255, 0.42);
  line-height: 1.5;
}

.mcard-cta {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: #A78BFA;
  margin-top: 10px;
  opacity: 0.65;
}
```

### 6.2 Accordion Rows

Used for model tiers and technical vision sections.

```html
<div class="accordion-row" style="border-color: rgba(59,130,246,.25);">
  <div class="accordion-header" onclick="toggle(0)">
    <div class="accordion-left">
      <div class="accordion-dot" style="background:#3B82F6;"></div>
      <div>
        <div class="accordion-label" style="color:#3B82F6;">JUNIOR</div>
        <div class="accordion-sub">Claude Haiku - Fastest and cheapest</div>
      </div>
    </div>
    <div class="accordion-meta">
      <span class="accordion-cost">~$0.25 / 1M</span>
      <span class="accordion-arrow" id="arrow-0">▼</span>
    </div>
  </div>
  <div class="accordion-body" id="body-0">
    <!-- expanded content -->
  </div>
</div>
```

```css
.accordion-row {
  background: #100F20;
  border: 1px solid;
  border-radius: 6px;
  overflow: hidden;
}

.accordion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  gap: 14px;
}

.accordion-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.accordion-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  margin-bottom: 5px;
}

.accordion-sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: rgba(236, 232, 255, 0.40);
  margin-top: 3px;
}

.accordion-cost {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: rgba(236, 232, 255, 0.40);
}

.accordion-arrow {
  font-size: 11px;
  color: rgba(236, 232, 255, 0.35);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.accordion-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

/* Expanded state */
.accordion-body.open {
  max-height: 600px;
}

.accordion-body-inner {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
}
```

```js
function toggle(i) {
  const body = document.getElementById('body-' + i);
  const arrow = document.getElementById('arrow-' + i);
  const open = body.style.maxHeight && body.style.maxHeight !== '0px';
  body.style.maxHeight = open ? '0px' : '600px';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
}
```

### 6.3 Slide Panel (Node Info)

The right-side info panel that slides in when an SVG node is clicked.

```html
<div id="flow-info">
  <div class="fi-hdr">
    <div>
      <div id="fi-tag" class="fi-tag"></div>
      <div id="fi-title" class="fi-title"></div>
    </div>
    <div class="fi-close-btn" onclick="closeInfo()">✕</div>
  </div>
  <div id="fi-body" class="fi-body"></div>
</div>
```

```css
#flow-info {
  position: fixed;
  top: 44px;          /* below mode bar */
  right: 0;
  width: 380px;
  height: calc(100vh - 44px);
  background: #080714;
  border-left: 1px solid rgba(148, 110, 255, 0.30);
  transform: translateX(100%);
  transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fi-hdr {
  padding: 20px 22px;
  border-bottom: 1px solid rgba(148, 110, 255, 0.12);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.fi-tag {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: #A78BFA;
  letter-spacing: 0.10em;
  margin-bottom: 7px;
}

.fi-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 600;
  color: #ECE8FF;
  line-height: 1.2;
}

.fi-close-btn {
  width: 26px;
  height: 26px;
  background: rgba(148, 110, 255, 0.12);
  border: 1px solid rgba(148, 110, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(236, 232, 255, 0.5);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 10px;
  transition: all 0.2s;
}

.fi-close-btn:hover {
  background: #7C3AED;
  color: #fff;
}

.fi-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 22px;
}

.fi-body p {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  color: rgba(236, 232, 255, 0.55);
  line-height: 1.8;
  margin-bottom: 9px;
}

.fi-body strong {
  color: #ECE8FF;
  font-weight: 500;
}
```

### 6.4 IP Moat Callout

The amber highlight block used to signal compounding/moat concepts.

```html
<div class="fi-moat">
  ◆ Cannot be replicated without run history. Compounds with every task.
</div>
```

```css
.fi-moat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(251, 191, 36, 0.10);
  border: 1px solid rgba(251, 191, 36, 0.30);
  border-radius: 3px;
  padding: 7px 10px;
  margin-top: 7px;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: #FBBF24;
  line-height: 1.5;
}
```

### 6.5 Mode Bar (Navigation)

The fixed top bar shared by both worlds.

```css
#mode-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  z-index: 9999;
  display: flex;
  align-items: stretch;
  background: rgba(245, 242, 236, 0.96);
  border-bottom: 1px solid var(--rule);
  backdrop-filter: blur(12px);
}

body.system #mode-bar {
  background: rgba(6, 5, 14, 0.96);
  border-color: var(--d-border);
}

.mode-bar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--plum);
  border-right: 1px solid var(--rule);
}

body.system .mode-bar-logo {
  color: var(--d-vb);
  border-color: var(--d-border);
}

.logo-gem {
  width: 10px;
  height: 10px;
  background: var(--gold);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  animation: gem-spin 5s linear infinite;
}

@keyframes gem-spin {
  to { transform: rotate(360deg); }
}

.m-tab {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 0 14px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--rule);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.05em;
}

.m-tab:hover { color: var(--plum); background: var(--h-bg2); }
.m-tab.on   { background: var(--plum); color: #fff; }
```

### 6.6 Onboarding Chat Bubble

```css
.ob-bub {
  background: var(--h-bg2);
  border: 1px solid var(--rule);
  padding: 9px 13px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  line-height: 1.65;
  color: var(--ink);
  max-width: 84%;
}

/* User message */
.ob-msg.u .ob-bub {
  background: var(--plum);
  color: #fff;
  border-color: transparent;
}

/* Sender label inside bubble */
.ob-sender {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: var(--muted);
  margin-bottom: 4px;
}

/* Quick-reply chips */
.ob-chip {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 7px 11px;
  background: var(--h-bg);
  border: 1px solid var(--rule);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s;
}

.ob-chip:hover {
  background: var(--h-bg3);
  color: var(--ink);
}
```

### 6.7 SVG Diagram Nodes

Used in the architecture flowchart.

```css
/* Node label — primary text */
.nl {
  font-family: 'Press Start 2P', monospace;
  fill: #ECE8FF;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}

/* Node sub-label — secondary text */
.nsl {
  font-family: 'DM Sans', sans-serif;
  fill: rgba(236, 232, 255, 0.45);
  text-anchor: middle;
  pointer-events: none;
}

/* Animated edge */
.fe {
  fill: none;
  stroke-width: 1.5;
  stroke-dasharray: 6 4;
  animation: edge-flow 2s linear infinite;
}

.fe.v { stroke: rgba(124, 58, 237, 0.5); }  /* Violet — instruction */
.fe.a { stroke: rgba(251, 191, 36, 0.5);  }  /* Amber — karma loop */
.fe.t { stroke: rgba(45, 212, 191, 0.4);  }  /* Teal — evaluation */
.fe.r { stroke: rgba(244, 114, 182, 0.35);}  /* Rose — contractors */

@keyframes edge-flow {
  to { stroke-dashoffset: -40; }
}
```

---

## 7. Motion and Animation

### 7.1 Principles

- **Purposeful only.** Animation communicates state or guides attention. It is never decorative.
- **Fast in, slow out.** Elements enter quickly and can leave more slowly. Entrance animations under 400ms. Exit can be 600ms.
- **One key animation per interaction.** Don't stack multiple simultaneous animations.

### 7.2 Standard Transitions

```css
/* World switch (Screenplay ↔ Director's Cut) */
#story, #system {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

/* Card hover lift */
.mcard {
  transition: border-color 0.2s, transform 0.15s;
}
.mcard:hover {
  transform: translateY(-2px);
}

/* Slide panel */
#flow-info {
  transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Accordion */
.accordion-body {
  transition: max-height 0.3s ease;
}

/* Button close hover */
.fi-close-btn {
  transition: all 0.2s;
}
```

### 7.3 The Karma Loop Animation (SVG particle)

```html
<!-- Amber particle travels the karma loop path -->
<circle r="3" fill="#FBBF24" opacity=".8">
  <animateMotion dur="5s" repeatCount="indefinite" begin=".3s"
    path="M 1060 155 C 1060 60 800 40 600 40 C 450 40 380 80 340 130"/>
  <animate attributeName="opacity" values="0;.8;.8;0"
    dur="5s" repeatCount="indefinite"/>
</circle>
```

### 7.4 The Logo Gem

The rotating diamond in the mode bar is the only purely decorative animation in the product. Keep it.

```css
.logo-gem {
  animation: gem-spin 5s linear infinite;
}

@keyframes gem-spin {
  to { transform: rotate(360deg); }
}
```

### 7.5 Typing Indicator

Used in onboarding while Indra is processing.

```css
.typing-dot {
  width: 5px;
  height: 5px;
  background: var(--plum);
  border-radius: 50%;
  animation: typing-bounce 1.1s infinite;
}

.typing-dot:nth-child(2) { animation-delay: 0.18s; }
.typing-dot:nth-child(3) { animation-delay: 0.36s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40%           { transform: translateY(-5px); }
}
```

---

## 8. Iconography and Symbols

Akasa does not use an icon library. It uses a small set of Unicode and ASCII symbols that are part of the brand voice.

### 8.1 Symbol Set

| Symbol | Usage | Context |
|--------|-------|---------|
| `◆` | Karma, IP moat, section marker | Amber on dark, gold on light |
| `◈` | Start Mode indicator | Plum on light |
| `⟳` | Connect Mode indicator | Gold on light |
| `▶` | Play / action / send | White on plum button |
| `▼` | Accordion closed | Faint on dark |
| `✕` | Close panel or modal | Faint on dark |
| `→` | CTA micro-label | Follows "CLICK TO EXPAND" |
| `★` | Task token in office animation | Amber |
| `·` | Separator in role strings | Muted |

### 8.2 The Diamond (`◆`)

The `◆` character is Akasa's primary brand mark in text contexts. It appears:
- Before section eyebrows: `◆ SOUL ARCHITECTURE`
- In the IP moat callout: `◆ Cannot be replicated...`
- In the karma ledger: `◆ YOUR TEAM`
- Before amber-highlighted statements

Always rendered in the amber/gold colour family. Never violet.

---

## 9. Do / Don't

### Typography

**Do** use Press Start 2P exclusively for labels, tags, and UI chrome at 6-8px.

**Don't** use Press Start 2P for anything that needs to be read as a sentence. It becomes illegible at body sizes and looks like a mistake, not a style decision.

```css
/* WRONG */
.card-description {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px; /* unreadable */
}

/* RIGHT */
.card-description {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
}
```

---

**Do** use Cormorant Garamond for display text at 16px and above.

**Don't** use it for UI labels, form inputs, or anything functional. It was designed for editorial content, not interaction.

```css
/* WRONG */
.nav-label { font-family: 'Cormorant Garamond', serif; font-size: 13px; }
.input-field { font-family: 'Cormorant Garamond', serif; }

/* RIGHT */
.nav-label { font-family: 'Press Start 2P', monospace; font-size: 7px; }
.input-field { font-family: 'DM Sans', sans-serif; }
```

---

**Do** use the opacity scale for text hierarchy within `--d-text` (`#ECE8FF`).

**Don't** invent new grey hex values for muted text. The opacity system ensures all text in dark mode comes from the same warm white and degrades gracefully.

```css
/* WRONG */
.secondary-text { color: #888; }
.tertiary-text  { color: #666; }

/* RIGHT */
.secondary-text { color: rgba(236, 232, 255, 0.52); }
.tertiary-text  { color: rgba(236, 232, 255, 0.42); }
```

---

### Colour

**Do** use the `--d-amb` amber exclusively for karma, IP moat, and compounding value concepts.

**Don't** use amber for general emphasis or decoration. It has a specific semantic meaning. Using it elsewhere dilutes that signal.

```css
/* WRONG — amber used for a generic highlight */
.new-feature-badge { background: rgba(251, 191, 36, 0.2); color: #FBBF24; }

/* RIGHT — amber for karma */
.karma-score { color: var(--d-amb); }
.moat-callout { border-color: rgba(251, 191, 36, 0.30); }
```

---

**Do** use opacity variants of the brand violet for borders and backgrounds.

**Don't** use solid violet for large surfaces. It overpowers the content.

```css
/* WRONG */
.card { background: #7C3AED; }
.card { border: 2px solid #7C3AED; }

/* RIGHT */
.card { background: rgba(124, 58, 237, 0.08); }
.card { border: 1px solid rgba(148, 110, 255, 0.15); }
```

---

**Do** use `--d-bg` (`#06050E`) for the primary dark background. It is near-black with a barely perceptible blue-purple undertone.

**Don't** use pure `#000000` black. It has no warmth, no relationship to the violet accent family, and looks generic.

```css
/* WRONG */
body.system { background: #000000; }

/* RIGHT */
body.system { background: #06050E; }
```

---

### Components

**Do** scope text colour explicitly on every element inside dynamically injected HTML (modals, slide panels).

**Don't** rely on CSS inheritance for text colour inside injected content. Browser default colours will override correctly themed styles.

```css
/* WRONG — assumes inheritance */
#modal-body { color: rgba(236, 232, 255, 0.55); }

/* RIGHT — scope to children */
#modal-body p { color: rgba(236, 232, 255, 0.55); font-family: 'DM Sans', sans-serif; }
#modal-body strong { color: #ECE8FF; }
```

---

**Do** use `max-height` transitions for accordion open/close. They are performant and smooth.

**Don't** use `height` transitions (requires explicit pixel values and breaks on dynamic content) or `display: none / block` (causes layout jump with no animation).

```css
/* WRONG */
.accordion-body { display: none; }
.accordion-body.open { display: block; }

/* RIGHT */
.accordion-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
.accordion-body.open { max-height: 600px; }
```

---

**Do** use `transform: translateX(100%)` for sliding panels.

**Don't** use `right: -100%` or `display: none`. Transform is GPU-composited and does not trigger layout reflow.

```css
/* WRONG */
#flow-info { right: -100%; }
#flow-info.open { right: 0; }

/* RIGHT */
#flow-info { transform: translateX(100%); transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1); }
#flow-info.open { transform: translateX(0); }
```

---

**Do** always close slide panels and modals with a button inside the component.

**Don't** rely only on backdrop click. It is acceptable as a supplementary close mechanism but users on mobile cannot rely on it.

---

### SVG Diagrams

**Do** explicitly set `fill` and `font-family` on every `<text>` element in SVGs.

**Don't** let SVG text inherit colour from CSS. SVG text elements have their own `fill` attribute and ignore `color` unless `fill: currentColor` is set.

```html
<!-- WRONG — inherits nothing useful -->
<text x="300" y="150">INDRA</text>

<!-- RIGHT — explicit fill and font -->
<text x="300" y="150" class="nl" font-size="9">INDRA</text>
<!-- where .nl sets fill:#ECE8FF and font-family -->
```

---

**Do** use the `--d-border` CSS variable for SVG stroke colours on node borders.

**Don't** use hardcoded stroke colours that will not adapt if the theme changes.

```html
<!-- WRONG -->
<rect stroke="#888" />

<!-- RIGHT -->
<rect stroke="rgba(148,110,255,0.32)" stroke-width="1.5" />
```

---

**Do** use `text-anchor: middle` and `dominant-baseline: middle` for centered SVG node labels.

**Don't** calculate x/y offsets manually to approximate centering. It breaks on zoom and different font metrics.

```html
<!-- WRONG — fragile manual centering -->
<text x="285" y="147">INDRA</text>

<!-- RIGHT -->
<text x="315" y="190" text-anchor="middle" dominant-baseline="middle">INDRA</text>
```

---

### JavaScript

**Do** use `requestAnimationFrame` before calling `initOffice()` after a scene switch.

**Don't** call canvas initialisation synchronously immediately after changing display state. The canvas element may not have computed its dimensions yet.

```js
// WRONG
function showScene(i, btn) {
  // ... show scene ...
  if (i === 1) initOffice(); // canvas dimensions not computed yet
}

// RIGHT
function showScene(i, btn) {
  // ... show scene ...
  if (i === 1) {
    setTimeout(() => {
      if (typeof OFFICE !== 'undefined' && !OFFICE.running) initOffice();
    }, 50);
  }
}
```

---

**Do** define `showScene` exactly once. If canvas or office code needs to hook into scene changes, call the hook from inside the single `showScene` definition.

**Don't** wrap and redefine `showScene` from a second script block. JavaScript hoisting and the reference captured in the closure will cause infinite recursion.

```js
// WRONG — causes maximum call stack exceeded
const _orig = showScene;
function showScene(i, btn) {
  _orig(i, btn); // calls itself
}

// RIGHT — one definition, hooks called inside
function showScene(i, btn) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.m-tab').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.scene')[i].classList.add('on');
  if (btn) btn.classList.add('on');
  if (i === 1) {
    setTimeout(() => { if (!OFFICE.running) initOffice(); }, 50);
  }
}
```

---

## 10. CSS Variables Reference

Complete `:root` block for copy-paste.

```css
:root {
  /* Director's Cut — dark */
  --d-bg:     #06050E;
  --d-card:   #100F20;
  --d-border: rgba(148, 110, 255, 0.13);
  --d-bhi:    rgba(148, 110, 255, 0.32);
  --d-text:   #ECE8FF;
  --d-muted:  rgba(236, 232, 255, 0.52);
  --d-faint:  rgba(236, 232, 255, 0.24);
  --d-vio:    #7C3AED;
  --d-vb:     #A78BFA;
  --d-amb:    #FBBF24;
  --d-teal:   #2DD4BF;
  --d-rose:   #F472B6;

  /* Screenplay — light */
  --h-bg:     #F5F2EC;
  --h-bg2:    #EDE9E0;
  --h-bg3:    #E5E0D5;
  --h-card:   #FDFAF6;
  --h-border: #D9CEBB;
  --ink:      #0E0D0B;
  --muted:    #7A766D;
  --rule:     rgba(14, 13, 11, 0.10);
  --plum:     #3D3560;
  --plum-m:   #6B5FA0;
  --plum-p:   #E8E5F4;
  --gold:     #B8965A;
  --gold-l:   #D4B47A;
  --gold-p:   #F0E6D0;

  /* Fonts */
  --fd: 'Cormorant Garamond', Georgia, serif;
  --fb: 'DM Sans', sans-serif;
  --fm: 'Press Start 2P', monospace;

  /* Spacing */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  14px;
  --space-lg:  20px;
  --space-xl:  28px;
  --space-2xl: 40px;
  --space-3xl: 60px;
}
```

---

## 11. Font Loading

Always load all three families in a single Google Fonts request. Place in `<head>` before any `<style>` or `<link>` tags.

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&family=Press+Start+2P&display=swap" rel="stylesheet"/>
```

### Weights loaded

| Family | Weights |
|--------|---------|
| Cormorant Garamond | 300, 300 italic, 400, 400 italic, 600 |
| DM Sans | 300, 400, 500 |
| Press Start 2P | 400 (only weight available) |

### Fallback stack

```css
font-family: 'Cormorant Garamond', Georgia, serif;
font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
font-family: 'Press Start 2P', monospace;
```

---

*Akasa Design Guide v1.0 — Confidential — Jungle Punk Ventures*