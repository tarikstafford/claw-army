# Akasa Design Guide

**Visual Language Reference v2.0**

> For designers and engineers building on the Akasa platform. This guide covers the complete visual language of the product — colour, typography, spacing, components, motion, and the rules behind every decision.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [The Two Modes](#2-the-two-modes)
3. [Colour](#3-colour)
4. [Typography](#4-typography)
5. [Spacing and Layout](#5-spacing-and-layout)
6. [Components](#6-components)
7. [Product States](#7-product-states)
8. [Motion and Animation](#8-motion-and-animation)
9. [Iconography and Symbols](#9-iconography-and-symbols)
10. [Voice and Copy](#10-voice-and-copy)
11. [Do / Don't](#11-do--dont)
12. [CSS Variables Reference](#12-css-variables-reference)
13. [Font Loading](#13-font-loading)

---

## 1. Design Principles

### Execution over decoration

Every visual decision earns its place by making the product faster to understand or easier to trust. If a design element does not communicate something, it should not exist.

### Two modes, one product

The Front Office and Back Office are not separate products. They are the same product in two registers — one for running the business day to day, one for understanding how the system works. Every colour, every font, every spacing decision must work coherently in both.

### Legibility is not optional

Press Start 2P is a branding element, not a reading font. Anything that needs to be read at length uses DM Sans. Anything that needs to make an editorial impression uses Cormorant Garamond. Press Start 2P handles labels, tags, and UI chrome only — and only at sizes between 6px and 8px.

### The product compounds, so does the craft

Akasa is built on the idea that systems improve over time. The design should reflect that: considered, not rushed, with genuine precision in every detail. Inconsistency is a product bug.

### Karma is amber, execution is teal, coordination is violet

Colour has meaning in Akasa. These three mappings are semantic constants. Using amber for decoration, teal for a non-execution context, or violet for something unrelated to coordination/intelligence is always wrong.

---

## 2. The Two Modes

### Front Office

The operational surface. Where users run their business — chat with agents, watch the office, review the Sanctum dashboard, manage their crew.

**Visual register:** Warm, editorial, considered. Cream paper tones, deep plum, burnished gold. Feels premium and approachable — like a high-quality product that respects your time.

**When to use it:** Any screen where the user is interacting with the business or its agents. Onboarding, chat, the virtual office, the Sanctum.

```css
/* Front Office is the default — no body class needed */
body {
  background: var(--fo-bg);
  color: var(--ink);
}
```

### Back Office

The system view. Where users understand how Akasa works — architecture, karma mechanics, model tiers, soul mutation, integrations.

**Visual register:** Deep, technical, authoritative. Near-black background, violet accents, amber for the karma and IP moat systems. Feels like infrastructure — serious without being cold.

**When to use it:** Architecture diagrams, mechanics documentation, integration management, advanced configuration.

```css
/* Back Office — activated by body class */
body.back-office {
  background: var(--bo-bg);
  color: var(--bo-text);
}
```

### Switching Between Modes

```js
function setMode(mode) {
  document.body.classList.toggle('back-office', mode === 'back-office');
}
```

```css
/* Mode toggle button — active state */
.mode-btn.front  { background: var(--fo-plum);  color: #fff; }
.mode-btn.back   { background: var(--bo-violet); color: #fff; }
```

---

## 3. Colour

### 3.1 Front Office Palette

The warm paper palette. Creams, plum, and gold.

```css
:root {
  /* Backgrounds */
  --fo-bg:      #F5F2EC;   /* Warm paper — primary surface */
  --fo-bg2:     #EDE9E0;   /* Slightly deeper paper — section alternates */
  --fo-bg3:     #E5E0D5;   /* Deepest paper — active states */
  --fo-card:    #FDFAF6;   /* Card surface */
  --fo-border:  #D9CEBB;   /* Default border */
  --fo-rule:    rgba(14, 13, 11, 0.10);

  /* Text */
  --ink:        #0E0D0B;   /* Primary — warm black */
  --muted:      #7A766D;   /* Secondary */

  /* Brand */
  --fo-plum:    #3D3560;   /* Primary — Indra, primary actions, CTAs */
  --fo-plum-m:  #6B5FA0;   /* Mid plum — hover states, active links */
  --fo-plum-p:  #E8E5F4;   /* Pale plum — avatar backgrounds, light fills */
  --fo-gold:    #B8965A;   /* Karma score, premium signal */
  --fo-gold-l:  #D4B47A;   /* Light gold */
  --fo-gold-p:  #F0E6D0;   /* Pale gold — very light fills */
}
```

### 3.2 Back Office Palette

The deep void palette. Near-black with violet and amber accents.

```css
:root {
  /* Backgrounds */
  --bo-bg:      #06050E;   /* Near-black — not pure black, has warmth */
  --bo-card:    #100F20;   /* Card and surface background */
  --bo-border:  rgba(148, 110, 255, 0.13);  /* Default border */
  --bo-bhi:     rgba(148, 110, 255, 0.32);  /* Hover / active border */

  /* Text */
  --bo-text:    #ECE8FF;                    /* Primary */
  --bo-muted:   rgba(236, 232, 255, 0.52);  /* Secondary */
  --bo-faint:   rgba(236, 232, 255, 0.24);  /* Tertiary / eyebrows */

  /* Accents — each carries a specific meaning */
  --bo-violet:  #7C3AED;   /* Coordination, Indra, primary actions */
  --bo-vb:      #A78BFA;   /* Tags, labels, soul mechanics */
  --bo-amber:   #FBBF24;   /* Karma, IP moat, compounding value */
  --bo-teal:    #2DD4BF;   /* Execution in progress, active agents */
  --bo-rose:    #F472B6;   /* Contractors, Tool Nexus, temporary */
}
```

### 3.3 Semantic Colour Mapping

These meanings are constants. Do not use these colours for other purposes.

| Colour | Role | Use |
|--------|------|-----|
| Violet `#7C3AED` | Coordination | Indra, task routing, primary CTAs |
| Violet bright `#A78BFA` | Soul mechanics | Tags, labels, soul-related content |
| Amber `#FBBF24` | Karma / compounding | Karma scores, IP moat callouts, The Record |
| Teal `#2DD4BF` | Execution | Active agents, tasks in progress, evaluation |
| Rose `#F472B6` | Contractors / tools | Temporary agents, Tool Nexus, integrations |

### 3.4 Model Tier Colours

Shared across both modes. Used wherever a model tier is displayed.

```css
/* Agent rank / model tier */
--tier-junior: #3B82F6;   /* Junior — Haiku */
--tier-mid:    #8B5CF6;   /* Mid-level — Sonnet */
--tier-senior: #D97706;   /* Senior — Opus */
```

```css
/* Tier badge */
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

### 3.5 Opacity Scale (Back Office)

Text hierarchy in the Back Office uses opacity variants of `--bo-text` (`#ECE8FF`) — not separate grey hex values. This ensures all text comes from the same warm white base and degrades consistently.

| Role | Value |
|------|-------|
| Primary | `#ECE8FF` |
| Secondary | `rgba(236, 232, 255, 0.52)` |
| Tertiary / captions | `rgba(236, 232, 255, 0.42)` |
| Eyebrows / faint labels | `rgba(236, 232, 255, 0.24)` |
| Barely-there / decorative | `rgba(236, 232, 255, 0.14)` |

### 3.6 Agent Identity Colours

Each named agent has a consistent identity colour used across the virtual office, chat avatars, and status indicators.

```css
--agent-indra: #6B46A8;   /* Chief of Staff */
--agent-mira:  #D97706;   /* Marketing — Senior */
--agent-kael:  #8B5CF6;   /* Sales — Mid */
--agent-asha:  #8B5CF6;   /* Ops — Mid */
--agent-contr: #3B82F6;   /* Contractors — always Junior */
```

---

## 4. Typography

### 4.1 The Three Typefaces

| Typeface | Role | Permitted sizes |
|----------|------|-----------------|
| Cormorant Garamond | Display — headings, titles, pull quotes | 16px and above only |
| DM Sans | Body — all readable text, UI, descriptions | Any size |
| Press Start 2P | Labels — tags, badges, eyebrows, UI chrome | 6px to 8px only |

These roles are strict. Mixing them outside their roles is always wrong.

### 4.2 Type Scale

#### Cormorant Garamond

```css
/* Hero headline */
.t-hero {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 300;
  line-height: 1.05;
  letter-spacing: -0.01em;
}

/* Section heading */
.t-h1 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: clamp(26px, 3.5vw, 38px);
  font-weight: 600;
  line-height: 1.1;
}

/* Card title */
.t-h2 {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

/* Italic accent — taglines, pull quotes, emphasis within display */
.t-italic {
  font-style: italic;
  color: var(--bo-vb);   /* Back Office */
  color: var(--fo-gold); /* Front Office */
}
```

#### DM Sans

```css
/* Primary body */
.t-body {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.8;
  color: var(--bo-muted);
}

/* UI text */
.t-ui {
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
}

/* Caption / supporting */
.t-caption {
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 400;
  font-style: italic;
  line-height: 1.55;
  color: var(--bo-muted);
}

/* Emphasis within body */
.t-body strong {
  color: var(--bo-text);
  font-weight: 500;
}
```

#### Press Start 2P

```css
/* Standard tag / label */
.t-tag {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  letter-spacing: 0.10em;
  color: var(--bo-vb);
}

/* Section eyebrow */
.t-eyebrow {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  letter-spacing: 0.18em;
  color: rgba(167, 139, 250, 0.55);
  margin-bottom: 10px;
}

/* Step number */
.t-step {
  font-family: 'Press Start 2P', monospace;
  font-size: 9px;
  color: var(--bo-vb);
}

/* System status */
.t-status {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  letter-spacing: 0.14em;
  color: var(--bo-faint);
}
```

### 4.3 Italics

Italics in Cormorant Garamond are a primary design tool — they carry the editorial warmth of the brand. Use them for:

- Taglines: *"Where agents enrich their souls."*
- Card summary lines
- Pull quotes
- One or two accent words within a display heading

```css
/* Accent word in heading — Back Office */
.t-h1 em { font-style: italic; color: var(--bo-vb); }

/* Accent word in heading — Front Office */
.t-h1 em { font-style: italic; color: var(--fo-gold); }
```

---

## 5. Spacing and Layout

### 5.1 Spacing Scale

```css
:root {
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  14px;
  --space-lg:  20px;
  --space-xl:  28px;
  --space-2xl: 40px;
  --space-3xl: 60px;
}
```

### 5.2 Section Padding

```css
.section          { padding: 28px 40px; }
.section-tight    { padding: 20px 40px; }
.section-terminal { padding: 24px 40px 80px; } /* last section, extra bottom */
```

### 5.3 Card Padding

```css
.card         { padding: 18px 20px; }
.card-compact { padding: 14px 16px; } /* inside grids */
.card-feature { padding: 20px 22px; } /* standalone featured card */
```

### 5.4 Grid Systems

```css
/* 4-column — "How it works" steps, integrations */
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* 3-column — mechanic cards, model tiers */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

/* 2-column — feature pairs, before/after */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

/* Dashboard metrics — 4 tight tiles */
.grid-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
```

### 5.5 Dividers

```css
/* Standard section divider — Back Office */
.divider {
  border: none;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
  margin: 0 40px;
}

/* Within-section divider */
.divider-inner {
  border: none;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
  margin: 20px 0;
}

/* Front Office divider */
.divider-fo {
  border: none;
  border-top: 1px solid var(--fo-rule);
  margin: 24px 0;
}
```

### 5.6 Border Radius

```css
--radius-sm: 3px;   /* Tags, badges */
--radius-md: 6px;   /* Cards, panels */
--radius-lg: 8px;   /* Modals, large panels */
--radius-xl: 50%;   /* Avatar circles, close buttons */
```

---

## 6. Components

### 6.1 Navigation Bar

The fixed top bar present in both modes.

```html
<div id="nav-bar">
  <div class="nav-logo">
    <div class="logo-gem"></div>
    Akasa
  </div>
  <div class="nav-tabs">
    <button class="nav-tab on">INDRA</button>
    <button class="nav-tab">OFFICE</button>
    <button class="nav-tab">CHAT</button>
    <button class="nav-tab">SANCTUM</button>
  </div>
  <div class="nav-mode">
    <button class="mode-btn front on">FRONT OFFICE</button>
    <button class="mode-btn back">BACK OFFICE</button>
  </div>
</div>
```

```css
#nav-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 44px;
  z-index: 9999;
  display: flex;
  align-items: stretch;
  backdrop-filter: blur(12px);
}

/* Front Office nav */
#nav-bar          { background: rgba(245, 242, 236, 0.96); border-bottom: 1px solid var(--fo-rule); }
body.back-office #nav-bar { background: rgba(6, 5, 14, 0.96);   border-bottom: 1px solid var(--bo-border); }

.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--fo-plum);
  border-right: 1px solid var(--fo-rule);
}
body.back-office .nav-logo { color: var(--bo-vb); border-color: var(--bo-border); }

.logo-gem {
  width: 10px;
  height: 10px;
  background: var(--fo-gold);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  animation: gem-spin 5s linear infinite;
  flex-shrink: 0;
}
@keyframes gem-spin { to { transform: rotate(360deg); } }

.nav-tab {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 0 14px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--fo-rule);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.05em;
}
.nav-tab:hover         { color: var(--fo-plum); background: var(--fo-bg2); }
.nav-tab.on            { background: var(--fo-plum); color: #fff; }
body.back-office .nav-tab         { border-color: var(--bo-border); color: var(--bo-faint); }
body.back-office .nav-tab:hover   { color: var(--bo-text); background: rgba(124, 58, 237, 0.10); }
body.back-office .nav-tab.on      { background: var(--bo-violet); color: #fff; }

.mode-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 0 16px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.05em;
}
.mode-btn.front        { background: var(--fo-plum); color: #fff; }
.mode-btn.back         { background: transparent; color: var(--muted); }
body.back-office .mode-btn.front  { background: transparent; color: var(--bo-faint); }
body.back-office .mode-btn.back   { background: var(--bo-violet); color: #fff; }
```

### 6.2 Mechanic Cards

The primary expandable content unit in the Back Office.

```html
<div class="mcard" onclick="openModal(index)">
  <div class="mcard-tag">SOUL ARCHITECTURE</div>
  <div class="mcard-title">The Soul — SOUL.md</div>
  <div class="mcard-summary">The behavioural constitution that lives inside every agent.</div>
  <div class="mcard-cta">CLICK TO EXPAND →</div>
</div>
```

```css
.mcard {
  background: var(--bo-card);
  border: 1px solid var(--bo-border);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.mcard:hover {
  border-color: rgba(148, 110, 255, 0.38);
  transform: translateY(-2px);
}
.mcard-tag {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--bo-vb);
  letter-spacing: 0.10em;
  margin-bottom: 9px;
}
.mcard-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-weight: 600;
  color: var(--bo-text);
  margin-bottom: 6px;
}
.mcard-summary {
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-style: italic;
  color: rgba(236, 232, 255, 0.42);
  line-height: 1.5;
}
.mcard-cta {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: var(--bo-vb);
  margin-top: 10px;
  opacity: 0.65;
}
```

### 6.3 Accordion

Used for model tiers and technical sections.

```html
<div class="accordion" style="--acc-color: rgba(59,130,246,.25);">
  <div class="accordion-header" onclick="toggleAccordion(0)">
    <div class="accordion-left">
      <div class="accordion-dot" style="background: #3B82F6;"></div>
      <div>
        <div class="accordion-label" style="color: #3B82F6;">JUNIOR</div>
        <div class="accordion-sub">Claude Haiku - Fastest and cheapest</div>
      </div>
    </div>
    <div class="accordion-right">
      <span class="accordion-meta">~$0.25 / 1M</span>
      <span class="accordion-arrow" id="arrow-0">▼</span>
    </div>
  </div>
  <div class="accordion-body" id="body-0">
    <div class="accordion-inner">
      <!-- expanded content -->
    </div>
  </div>
</div>
```

```css
.accordion {
  background: var(--bo-card);
  border: 1px solid var(--acc-color, var(--bo-border));
  border-radius: var(--radius-md);
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
.accordion-meta {
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
.accordion-inner {
  padding: 0 20px 20px;
  border-top: 1px solid rgba(148, 110, 255, 0.12);
}

/* Body text inside accordion */
.accordion-inner p {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  color: rgba(236, 232, 255, 0.55);
  line-height: 1.8;
  margin-bottom: 10px;
}
.accordion-inner p:last-child { margin-bottom: 0; }
.accordion-inner strong       { color: var(--bo-text); font-weight: 500; }
```

```js
function toggleAccordion(i) {
  const body  = document.getElementById('body-' + i);
  const arrow = document.getElementById('arrow-' + i);
  const open  = body.style.maxHeight && body.style.maxHeight !== '0px';
  body.style.maxHeight        = open ? '0px' : '600px';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(180deg)';
}
```

### 6.4 Slide Panel

Right-side info panel. Triggered by clicking SVG nodes in the architecture diagram.

```css
.slide-panel {
  position: fixed;
  top: 44px;
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

.slide-panel.open { transform: translateX(0); }

.panel-header {
  padding: 20px 22px;
  border-bottom: 1px solid rgba(148, 110, 255, 0.12);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.panel-tag {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: var(--bo-vb);
  letter-spacing: 0.10em;
  margin-bottom: 7px;
}
.panel-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 600;
  color: var(--bo-text);
  line-height: 1.2;
}
.panel-close {
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
.panel-close:hover { background: var(--bo-violet); color: #fff; }

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 22px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 110, 255, 0.20) transparent;
}
.panel-body p        { font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--bo-muted); line-height: 1.8; margin-bottom: 9px; }
.panel-body strong   { color: var(--bo-text); font-weight: 500; }
```

### 6.5 Karma Callout

The amber highlight block for compounding / moat concepts.

```html
<div class="karma-callout">
  ◆ Cannot be replicated without run history. Compounds with every task.
</div>
```

```css
.karma-callout {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  background: rgba(251, 191, 36, 0.10);
  border: 1px solid rgba(251, 191, 36, 0.30);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  margin-top: 8px;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: var(--bo-amber);
  line-height: 1.6;
}
```

### 6.6 Modal

Full-screen overlay for expanded mechanic content.

```html
<div class="modal-overlay" onclick="closeModal(event)">
  <div class="modal-box" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div>
        <div class="modal-tag" id="modal-tag"></div>
        <div class="modal-title" id="modal-title"></div>
      </div>
      <div class="panel-close" onclick="closeModal()">✕</div>
    </div>
    <div class="modal-body" id="modal-body"></div>
  </div>
</div>
```

```css
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(6, 5, 14, 0.88);
  backdrop-filter: blur(8px);
  align-items: center;
  justify-content: center;
}
.modal-overlay.open { display: flex; }

.modal-box {
  background: #0D0C1E;
  border: 1px solid rgba(148, 110, 255, 0.35);
  border-radius: var(--radius-lg);
  width: 560px;
  max-height: 80vh;
  overflow-y: auto;
}
.modal-header {
  padding: 22px 26px;
  border-bottom: 1px solid rgba(148, 110, 255, 0.12);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: sticky;
  top: 0;
  background: #0D0C1E;
  z-index: 1;
}
.modal-tag   { font-family: 'Press Start 2P', monospace; font-size: 6px; color: var(--bo-vb); letter-spacing: 0.10em; margin-bottom: 7px; }
.modal-title { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 600; color: var(--bo-text); }
.modal-body  { padding: 22px 26px; }
.modal-body p        { font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--bo-muted); line-height: 1.85; margin-bottom: 10px; }
.modal-body p:last-child { margin-bottom: 0; }
.modal-body strong   { color: var(--bo-text); font-weight: 500; }
```

### 6.7 SVG Architecture Diagram

```css
/* Node labels */
.nl  { font-family: 'Press Start 2P', monospace; fill: #ECE8FF; text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
.nsl { font-family: 'DM Sans', sans-serif;       fill: rgba(236, 232, 255, 0.45); text-anchor: middle; pointer-events: none; }

/* Animated edges */
.fe   { fill: none; stroke-width: 1.5; stroke-dasharray: 6 4; animation: edge-flow 2s linear infinite; }
.fe.v { stroke: rgba(124, 58, 237, 0.5); }  /* violet — instruction / coordination */
.fe.a { stroke: rgba(251, 191, 36, 0.5);  }  /* amber  — karma loop */
.fe.t { stroke: rgba(45, 212, 191, 0.4);  }  /* teal   — evaluation */
.fe.r { stroke: rgba(244, 114, 182, 0.35);}  /* rose   — contractors */

@keyframes edge-flow { to { stroke-dashoffset: -40; } }

/* Clickable node hover */
.fn rect, .fn circle { transition: filter 0.2s; }
.fn:hover rect, .fn:hover circle { filter: brightness(1.5); }
```

### 6.8 Chat Bubbles (Front Office)

```css
.chat-bubble {
  background: var(--fo-bg2);
  border: 1px solid var(--fo-rule);
  padding: 9px 13px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  line-height: 1.65;
  color: var(--ink);
  max-width: 76%;
}

/* User message */
.chat-bubble.user {
  background: var(--fo-plum);
  color: #fff;
  border-color: transparent;
  align-self: flex-end;
}

/* Agent sender label */
.chat-sender {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: var(--muted);
  margin-bottom: 4px;
  letter-spacing: 0.08em;
}

/* Quick-reply chips */
.reply-chip {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  padding: 7px 11px;
  background: var(--fo-bg);
  border: 1px solid var(--fo-rule);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s;
}
.reply-chip:hover { background: var(--fo-bg3); color: var(--ink); }

/* Typing indicator */
.typing-dot {
  width: 5px; height: 5px;
  background: var(--fo-plum);
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

### 6.9 Dashboard Metric Tile (Sanctum)

```css
.metric-tile {
  background: #fff;
  border: 1px solid var(--fo-rule);
  box-shadow: 2px 2px 0 var(--fo-bg3);
  padding: 12px 14px;
}
.metric-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 5px;
  color: var(--muted);
  margin-bottom: 7px;
  letter-spacing: 0.10em;
}
.metric-value {
  font-family: 'Press Start 2P', monospace;
  font-size: 20px;
  color: var(--ink);
  line-height: 1;
}
.metric-sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 10px;
  color: var(--muted);
  margin-top: 3px;
}
```

---

## 7. Product States

Akasa agents have five distinct states. Each state has a specific visual treatment across the virtual office, chat, and dashboard.

### 7.1 State Reference

| State | Office sprite | Chat status | Dashboard | Colour signal |
|-------|--------------|-------------|-----------|---------------|
| **Idle** | At desk, slow bob, no work anim | Grey dot | No active bar | Neutral |
| **Working** | Arms animating, typing | Amber dot | Progress bar filling | Amber `--bo-amber` |
| **Complete** | Confetti burst, wander | Green dot | Bar fills, tick appears | Teal `--bo-teal` |
| **Waiting** | At desk, looking around | Grey dot, italic | Bar paused | Faint violet |
| **Elevated** | Name tag glows | Gold dot | Karma score rising | Gold `--fo-gold` |

### 7.2 Karma Promotion Event

When an agent earns a promotion, it is the most significant UI event in the product. It should feel earned.

```css
/* Promotion particle burst — triggered on karma threshold */
.promotion-burst {
  animation: burst-scale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes burst-scale {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* Karma score number transition */
.karma-score { transition: color 0.6s ease; }
.karma-score.promoted { color: var(--fo-gold); }
```

### 7.3 Indra Routing State

When Indra is actively routing a task — the most important coordination moment.

```css
/* Live dot on Indra's node in architecture diagram */
.live-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; r: 5; }
  50%       { opacity: 0.4; r: 3; }
}

/* Indra HUD status — Front Office */
.indra-hud {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  background: rgba(255, 252, 248, 0.92);
  border: 1px solid var(--fo-rule);
  padding: 5px 9px;
  color: var(--fo-plum);
}
.indra-hud.routing { color: var(--fo-gold); }
```

---

## 8. Motion and Animation

### 8.1 Principles

- **Purposeful only.** Animation communicates state or guides attention. Never purely decorative — with the single exception of the logo gem.
- **Fast in, slow out.** Entrance animations under 400ms. Exits can be slower.
- **One key animation per interaction.** Never stack simultaneous animations on the same element.
- **GPU-composited transforms only.** Use `transform` and `opacity`. Never animate `height`, `width`, `top`, `left`, or `background-color` directly — they trigger layout reflow.

### 8.2 Standard Transitions

```css
/* Mode switch */
.mode-world   { transition: opacity 0.4s ease, transform 0.4s ease; }

/* Card hover */
.mcard        { transition: border-color 0.2s, transform 0.15s; }

/* Slide panel */
.slide-panel  { transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1); }

/* Accordion */
.accordion-body { transition: max-height 0.3s ease; }

/* Close buttons */
.panel-close  { transition: all 0.2s; }

/* Arrow rotation */
.accordion-arrow { transition: transform 0.2s; }
```

### 8.3 The Karma Loop (SVG)

The animated amber particle that travels the karma loop path in the architecture diagram.

```html
<circle r="3" fill="#FBBF24" opacity=".8">
  <animateMotion
    dur="5s"
    repeatCount="indefinite"
    begin=".3s"
    path="M 1060 155 C 1060 60 800 40 600 40 C 450 40 380 80 340 130"/>
  <animate attributeName="opacity"
    values="0;.8;.8;0"
    dur="5s"
    repeatCount="indefinite"/>
</circle>
```

### 8.4 The Logo Gem

The only purely decorative animation in the product. It is part of the brand identity and must not be removed.

```css
.logo-gem { animation: gem-spin 5s linear infinite; }
@keyframes gem-spin { to { transform: rotate(360deg); } }
```

### 8.5 Virtual Office Sprite Animation

Agents in the virtual office use frame-based canvas animation at 60fps.

```js
// Walking bob — applied to y position
const bob = state === 'walking'
  ? Math.sin(phase) * 1.8
  : Math.sin(phase * 0.4) * 0.6;

// Working arm animation
const armY = -S * 0.02 + Math.sin(workPhase) * S * 0.08;

// Promotion particles — burst on task complete
for (let i = 0; i < 12; i++) {
  particles.push({
    x: agent.x + (Math.random() - 0.5) * 0.05,
    y: agent.y - 0.02,
    color: [agent.color, '#FBBF24', '#2DD4BF', '#fff'][Math.floor(Math.random() * 4)],
    vy: -0.008 - Math.random() * 0.012,
    life: 1.0,
  });
}
```

---

## 9. Iconography and Symbols

Akasa does not use an icon library. It uses a defined set of Unicode and ASCII symbols that are part of the brand voice.

### 9.1 Symbol Set

| Symbol | Name | Usage |
|--------|------|-------|
| `◆` | Diamond | Karma, IP moat, section markers — always amber/gold |
| `◈` | Diamond with dot | Start / new — plum on Front Office |
| `⟳` | Cycle arrow | Connect / existing business |
| `▶` | Play arrow | Action buttons, send, task start |
| `▼` | Down arrow | Accordion closed state |
| `✕` | Cross | Close panel, close modal |
| `→` | Right arrow | CTA follow-on label ("CLICK TO EXPAND →") |
| `★` | Star | Task token in office animation — amber |
| `·` | Middle dot | Separator within role/rank strings |

### 9.2 The Diamond (`◆`)

The diamond is Akasa's primary brand mark in text contexts. It signals compounding value and the IP moat concept.

**Rules:**
- Always rendered in the amber/gold colour family
- Never rendered in violet, teal, or any other accent colour
- Appears before section eyebrows, karma scores, and moat callouts
- Precedes the most important statement in a section

```html
<!-- Correct usage -->
<div class="t-eyebrow">◆ THE IP MOAT</div>
<div class="karma-callout">◆ Cannot be replicated without run history.</div>

<!-- Wrong — diamond in violet -->
<div style="color: #A78BFA;">◆ SOUL ARCHITECTURE</div>
```

---

## 10. Voice and Copy

### 10.1 Core Rules

**Plain language first.** Akasa executes complex things. The copy should make that feel effortless, not complicated.

**No em dashes.** Use a simple hyphen with spaces ( - ) or restructure the sentence. Em dashes read as AI-generated text.

**Sentence case everywhere.** Not Title Case. Not ALL CAPS for body copy. Press Start 2P labels are caps by rendering — that is the only exception.

**Indra speaks in short sentences.** The Chief of Staff does not ramble. "I'll route this to Mira. Back in 2 hours." is better than "I will now proceed to route this task to Mira, who will handle the research component of your request."

**Karma, not points.** Always "karma" not "score", "points", or "rating". The karma system is named deliberately.

**Agents do not "run".** They work, execute, complete, act. "Running" sounds like a script. "Mira is working on this" is correct. "Mira is running" is not.

### 10.2 Mode Names

| Mode | Name | Never say |
|------|------|-----------|
| Light / operational | Front Office | Screenplay, User View, Light Mode |
| Dark / technical | Back Office | Director's Cut, System View, Dark Mode |

### 10.3 Agent Language

| Correct | Wrong |
|---------|-------|
| "Mira completed the task" | "Task executed successfully" |
| "Kael is working on this" | "Agent is running" |
| "Indra is routing" | "System is processing" |
| "Your crew is assembled" | "Agents have been deployed" |
| "Karma earned" | "Score updated" |
| "Sit on the bench" | "Deactivated" or "Retired" |
| "Contractor" | "Temporary agent" or "Task agent" |

### 10.4 Product Feature Names

| Feature | Name | Notes |
|---------|------|-------|
| Main dashboard | Sanctum | Not "Dashboard" |
| Audit trail | The Chronicle | Not "History" or "Log" |
| Soul storage | The Record | Not "Library" (reserved for Skill Bazaar) |
| Task routing engine | Indra | Not "Orchestrator" |
| Soul evolution file | SOUL.md | Always in code style |
| Skill file | SKILL.md | Always in code style |

---

## 11. Do / Don't

### Typography

**Do** use Press Start 2P at 6-8px for labels and tags only.

**Don't** use it for anything read as a sentence — it becomes illegible and looks like a mistake.

```css
/* Wrong */
.description { font-family: 'Press Start 2P', monospace; font-size: 12px; }

/* Right */
.description { font-family: 'DM Sans', sans-serif; font-size: 13px; }
```

---

**Do** use Cormorant Garamond at 16px and above for display text only.

**Don't** use it for form labels, inputs, small captions, or anything functional.

```css
/* Wrong */
.form-label { font-family: 'Cormorant Garamond', serif; font-size: 12px; }

/* Right */
.form-label { font-family: 'DM Sans', sans-serif; font-size: 13px; }
```

---

**Do** use the `rgba(236, 232, 255, N)` opacity scale for text hierarchy in the Back Office.

**Don't** invent grey hex values for muted text — they lose the warm undertone and break at different opacities.

```css
/* Wrong */
.secondary { color: #888888; }

/* Right */
.secondary { color: rgba(236, 232, 255, 0.52); }
```

---

### Colour

**Do** use amber exclusively for karma, IP moat, and compounding value.

**Don't** use it for general emphasis — it has a specific semantic meaning.

```css
/* Wrong */
.highlight { color: #FBBF24; } /* generic emphasis */

/* Right */
.karma-score  { color: var(--bo-amber); }
.moat-callout { border-color: rgba(251, 191, 36, 0.30); }
```

---

**Do** use opacity variants of the brand violet for borders and backgrounds.

**Don't** use solid violet for large surfaces.

```css
/* Wrong */
.card { background: #7C3AED; }

/* Right */
.card { background: rgba(124, 58, 237, 0.08); border: 1px solid rgba(148, 110, 255, 0.15); }
```

---

**Do** use `#06050E` for the Back Office background.

**Don't** use pure `#000000` — it has no relationship to the violet accent family.

---

**Do** maintain the three-colour semantic system (amber = karma, teal = execution, violet = coordination).

**Don't** use semantic colours outside their meaning. If a button is violet, it should relate to coordination or intelligence, not just because violet looks good.

---

### Components

**Do** scope font-family and colour explicitly on every element inside dynamically injected HTML.

**Don't** rely on CSS inheritance for injected content — browser defaults override correctly themed styles.

```css
/* Wrong — assumes inheritance */
#modal-body { color: rgba(236, 232, 255, 0.55); }

/* Right — scoped to children */
#modal-body p      { font-family: 'DM Sans', sans-serif; color: rgba(236, 232, 255, 0.55); font-size: 14px; }
#modal-body strong { color: #ECE8FF; font-weight: 500; }
```

---

**Do** use `max-height` transitions for accordions.

**Don't** use `display: none / block` — no animation, layout jump.

```css
/* Wrong */
.body { display: none; }
.body.open { display: block; }

/* Right */
.body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
.body.open { max-height: 600px; }
```

---

**Do** use `transform: translateX(100%)` for slide panels.

**Don't** use `right: -100%` — it triggers layout recalculation on every frame.

```css
/* Wrong */
.panel { right: -380px; transition: right 0.38s; }
.panel.open { right: 0; }

/* Right */
.panel { transform: translateX(100%); transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1); }
.panel.open { transform: translateX(0); }
```

---

### SVG Diagrams

**Do** set `fill`, `font-family`, `text-anchor`, and `dominant-baseline` explicitly on every SVG `<text>` element.

**Don't** let SVG text inherit colour from CSS — SVG elements have their own attribute system.

```html
<!-- Wrong -->
<text x="300" y="150">INDRA</text>

<!-- Right -->
<text x="315" y="190" class="nl" font-size="9">INDRA</text>
```

---

**Do** use `text-anchor: middle` and `dominant-baseline: middle` for centered node labels.

**Don't** manually offset x/y coordinates to approximate centering — it breaks at different zoom levels.

---

### JavaScript

**Do** define `showScene` (or any navigation function) exactly once. Call all hooks from inside the single definition.

**Don't** wrap and redefine it from a second script block — the captured closure reference causes infinite recursion and a maximum call stack error.

```js
// Wrong — causes maximum call stack exceeded
const _orig = showScene;
function showScene(i, btn) { _orig(i, btn); }

// Right — one definition
function showScene(i, btn) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.scene')[i].classList.add('on');
  if (i === 1) setTimeout(() => { if (!OFFICE.running) initOffice(); }, 50);
}
```

---

**Do** wrap canvas initialisation in a `setTimeout` of at least 50ms after making the canvas visible.

**Don't** call `canvas.getContext()` or measure canvas dimensions synchronously after changing display state — the layout has not been computed yet.

```js
// Wrong
function showScene(i) {
  scenes[i].style.display = 'block';
  initCanvas(); // dimensions are 0x0
}

// Right
function showScene(i) {
  scenes[i].style.display = 'block';
  setTimeout(() => initCanvas(), 50);
}
```

---

## 12. CSS Variables Reference

Complete `:root` block.

```css
:root {
  /* Front Office */
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

  /* Back Office */
  --bo-bg:      #06050E;
  --bo-card:    #100F20;
  --bo-border:  rgba(148, 110, 255, 0.13);
  --bo-bhi:     rgba(148, 110, 255, 0.32);
  --bo-text:    #ECE8FF;
  --bo-muted:   rgba(236, 232, 255, 0.52);
  --bo-faint:   rgba(236, 232, 255, 0.24);
  --bo-violet:  #7C3AED;
  --bo-vb:      #A78BFA;
  --bo-amber:   #FBBF24;
  --bo-teal:    #2DD4BF;
  --bo-rose:    #F472B6;

  /* Model tiers — shared */
  --tier-junior: #3B82F6;
  --tier-mid:    #8B5CF6;
  --tier-senior: #D97706;

  /* Agent identity — shared */
  --agent-indra: #6B46A8;
  --agent-contr: #3B82F6;

  /* Spacing */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  14px;
  --space-lg:  20px;
  --space-xl:  28px;
  --space-2xl: 40px;
  --space-3xl: 60px;

  /* Radius */
  --radius-sm: 3px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Fonts */
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body:    'DM Sans', system-ui, sans-serif;
  --font-label:   'Press Start 2P', monospace;
}
```

---

## 13. Font Loading

Load all three families in a single request. Place in `<head>` before any stylesheets.

```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link
  href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&family=Press+Start+2P&display=swap"
  rel="stylesheet"/>
```

### Weights loaded

| Family | Weights |
|--------|---------|
| Cormorant Garamond | 300, 300 italic, 400, 400 italic, 600 |
| DM Sans | 300, 400, 500 |
| Press Start 2P | 400 (only weight available) |

### Fallback stacks

```css
font-family: 'Cormorant Garamond', Georgia, serif;
font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
font-family: 'Press Start 2P', monospace;
```

---

*Akasa Design Guide v2.0 — Jungle Punk Ventures*
