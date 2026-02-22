# Akasa Design Guide v1.0
> Reference for AI-assisted implementation across all Akasa web properties.

---

## 1. Brand Identity

**Product name:** Akasa (not Akasha — one 's')
**Tagline:** Where agents enrich their souls.
**Core concept:** An AI workforce platform where agents have behavioural constitutions (souls) that evolve through work. The soul metaphor is the philosophical centre of the brand. Every design decision should reinforce that this system is alive, compounding, and non-disposable.

---

## 2. Colour System

All colours are defined as CSS custom properties. Always use the variable, never hardcode the hex.

```css
:root {
  /* Backgrounds — layered depth, not flat black */
  --bg:        #07060f;   /* Page base */
  --bg-2:      #0c0b18;   /* Sections, raised surfaces */
  --bg-3:      #100f1e;   /* Tertiary surface */
  --bg-card:   #131224;   /* Cards, panels */
  --bg-card-2: #110f20;   /* Card hover state */

  /* Borders — violet undertone, always translucent */
  --border:     rgba(148,110,255,0.10);  /* Default */
  --border-mid: rgba(148,110,255,0.20);  /* Hover, focus */
  --border-hi:  rgba(148,110,255,0.32);  /* Active, selected */

  /* Text */
  --text:       #ece8ff;                  /* Primary — warm lavender-white */
  --text-muted: rgba(236,232,255,0.50);   /* Body copy, secondary */
  --text-faint: rgba(236,232,255,0.22);   /* Labels, meta, disabled */

  /* Violet — primary brand colour, the digital layer */
  --violet:        #7c3aed;
  --violet-bright: #a78bfa;
  --violet-light:  #c4b5fd;
  --violet-dim:    rgba(124,58,237,0.14); /* Tinted backgrounds */
  --violet-glow:   rgba(124,58,237,0.08); /* Subtle glow fills */

  /* Amber — soul accent. Used ONLY for soul-concept language */
  --amber:     #fbbf24;
  --amber-dim: rgba(251,191,36,0.10);

  /* Teal — status, live indicators, confirmations */
  --teal:     #2dd4bf;
  --teal-dim: rgba(45,212,191,0.10);

  /* Rose — retirement, end-of-life, legacy language */
  --rose:     #f472b6;
  --rose-dim: rgba(244,114,182,0.08);

  /* Glitch channel split — chromatic aberration effect */
  --glitch-r: rgba(255,60,120,0.7);   /* Red channel */
  --glitch-b: rgba(60,180,255,0.7);   /* Cyan channel */
}
```

### Colour usage rules

**Violet** is the primary interactive colour. Use for: CTAs, active nav links, focus rings, interactive borders, primary buttons, section highlights, the logo mark.

**Amber** is reserved exclusively for soul-concept language. Use for: the word "soul." wherever it appears, the tagline, soul-related headings, the Artisan rank indicator, any copy that references the soul mechanic. Do not use amber for UI elements, buttons, or non-soul copy. Amber on the page signals: this is about the soul.

**Teal** is for liveness and status only. Use for: live dots, status pills, confirmation checkmarks, the "For Agents" section heading, agent compatibility badges.

**Rose** is for retirement and legacy language only. Use for: the "On retirement" section label, any copy about agent end-of-life, death/legacy metaphors.

**Never** use coloured text on coloured backgrounds unless contrast ratio passes WCAG AA (4.5:1 minimum for body, 3:1 for large display text).

---

## 3. Typography

### Font stack

```css
--font-display: 'Clash Display', 'Inter', system-ui, sans-serif;
--font-body:    'Inter', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', monospace;
```

### Loading fonts

```html
<!-- Inter + JetBrains Mono from Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />

<!-- Clash Display from Fontshare — must be loaded separately -->
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" />
```

### Clash Display (display font)

Used for: all headings (h1–h3), the logo wordmark, the payoff line, the problem quote, stat numbers.

Key properties:
- Always 600 weight minimum at display sizes. 400 weight looks underpowered.
- Letter spacing: `-0.02em` to `-0.03em` at large sizes. Clash Display needs to be pulled tight.
- Line height: `1.0` to `1.1` at display sizes. Never above `1.2` for headings.
- No italic — Clash Display does not have a true italic. Use normal style only.

```css
/* Hero h1 */
font-family: var(--font-display);
font-size: clamp(52px, 7.5vw, 102px);
font-weight: 600;
line-height: 1.0;
letter-spacing: -0.025em;

/* Section h2 */
font-family: var(--font-display);
font-size: clamp(36px, 4.5vw, 64px);
font-weight: 600;
line-height: 1.05;
letter-spacing: -0.02em;

/* Logo wordmark */
font-family: var(--font-display);
font-size: 20px;
font-weight: 600;
letter-spacing: -0.01em;
```

### Inter (body font)

Used for: all body copy, navigation links, button labels, card text, form inputs, consent copy.

Key properties:
- Body copy: `font-weight: 300`, `font-size: 16–16.5px`, `line-height: 1.75–1.82`
- UI elements: `font-weight: 400`
- Labels and emphasis: `font-weight: 500`
- Never bold (700+) — use Clash Display for heavy emphasis instead.

```css
/* Body copy */
font-family: var(--font-body);
font-size: 16.5px;
font-weight: 300;
line-height: 1.82;
color: var(--text-muted);

/* Small card body */
font-size: 14px;
font-weight: 300;
line-height: 1.75;

/* Button label */
font-size: 14px;
font-weight: 500;
letter-spacing: 0.03em;
```

### JetBrains Mono (mono font)

Used for: section eyebrow labels, status pills, terminal/code blocks, rank tags, compatibility badges, footer copy, any ALL CAPS micro-labels.

Key properties:
- Always `font-weight: 300` or `400`
- Section labels: `font-size: 10px`, `letter-spacing: 0.22em`, `text-transform: uppercase`
- Status/tags: `font-size: 9–10.5px`, `letter-spacing: 0.10–0.18em`

```css
/* Section eyebrow */
font-family: var(--font-mono);
font-size: 10px;
font-weight: 300;
letter-spacing: 0.22em;
text-transform: uppercase;
color: var(--text-faint);

/* Status pill */
font-family: var(--font-mono);
font-size: 10.5px;
letter-spacing: 0.07em;
color: var(--text-faint);
```

### Type hierarchy summary

| Level | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Hero h1 | Clash Display | clamp(52px, 7.5vw, 102px) | 600 | Page hero only |
| Section h2 | Clash Display | clamp(36px, 4.5vw, 64px) | 600 | Section headings |
| Card h3 | Clash Display | 22px | 400 | Card headings |
| Body large | Inter | 18px | 300 | Hero subheading |
| Body | Inter | 16.5px | 300 | Section body copy |
| Body small | Inter | 14–15px | 300 | Card body, captions |
| Label | JetBrains Mono | 10px | 300 | Section eyebrows, meta |
| Tag/badge | JetBrains Mono | 9–9.5px | 400 | Status tags, rank badges |

---

## 4. The Glitch Effect

The glitch is the signature animation of the brand. It represents the soul mechanic — alive, unpredictable, not fully under control.

### Rules

1. **Amber text only.** The glitch is applied exclusively to amber-coloured text. Never apply it to violet, teal, white, or any other colour. Amber = soul = glitch.
2. **Stagger all instances.** If multiple elements on a page have the glitch, use different `animation-duration` and `animation-delay` values so they never fire simultaneously.
3. **Infrequent bursts.** The glitch fires for ~6 frames at 83–92% of the animation cycle, then goes silent. It should feel like a corruption event, not a loop.
4. **No glitch on small text.** Only apply to display-size text (h1, h2, large accent words). Never on body copy, labels, or tags.

### Implementation

Any element receiving the glitch effect needs:
- `position: relative`
- A `data-text` attribute matching the text content exactly
- The `.glitch` base class plus one variant class for timing

```html
<!-- Example usage -->
<span class="glitch glitch-soul" data-text="soul.">soul.</span>
```

```css
/* Base — required on all glitch elements */
.glitch {
  position: relative;
  display: inline;
}
.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  font-family: inherit; font-size: inherit;
  font-weight: inherit; font-style: inherit;
  line-height: inherit; letter-spacing: inherit;
  color: inherit;
}
.glitch::before {
  color: var(--glitch-r);
  text-shadow: -2px 0 var(--glitch-r);
  clip-path: inset(100% 0 0 0);
  animation: glitch-top 5s steps(1) infinite;
  mix-blend-mode: screen;
}
.glitch::after {
  color: var(--glitch-b);
  text-shadow: 2px 0 var(--glitch-b);
  clip-path: inset(0 0 100% 0);
  animation: glitch-bot 5s steps(1) infinite;
  mix-blend-mode: screen;
}

/* Staggered timing variants — add more as needed */
.glitch-soul::before,   .glitch-soul::after   { animation-duration: 5s; animation-delay: 0.0s; }
.glitch-amber::before,  .glitch-amber::after  { animation-duration: 6s; animation-delay: 1.8s; }
.glitch-payoff::before, .glitch-payoff::after { animation-duration: 7s; animation-delay: 3.2s; }
.glitch-humans::before, .glitch-humans::after { animation-duration: 8s; animation-delay: 1.1s; }

/* Keyframes */
@keyframes glitch-top {
  0%,82%,100% { clip-path: inset(100% 0 0 0); transform: none;         opacity: 0; }
  83%          { clip-path: inset(20% 0 65% 0); transform: translateX(-3px); opacity: 1; }
  84%          { clip-path: inset(50% 0 30% 0); transform: translateX(2px);  opacity: 1; }
  85%          { clip-path: inset(10% 0 80% 0); transform: translateX(-4px); opacity: 1; }
  86%,87%      { clip-path: inset(40% 0 45% 0); transform: translateX(1px);  opacity: 1; }
  88%          { clip-path: inset(100% 0 0 0);  transform: none;         opacity: 0; }
  91%          { clip-path: inset(30% 0 60% 0); transform: translateX(-2px); opacity: 0.7; }
  92%          { clip-path: inset(100% 0 0 0);  transform: none;         opacity: 0; }
}
@keyframes glitch-bot {
  0%,82%,100% { clip-path: inset(0 0 100% 0); transform: none;         opacity: 0; }
  83%          { clip-path: inset(65% 0 20% 0); transform: translateX(3px);  opacity: 1; }
  84%          { clip-path: inset(30% 0 50% 0); transform: translateX(-2px); opacity: 1; }
  85%          { clip-path: inset(75% 0 15% 0); transform: translateX(4px);  opacity: 1; }
  86%,87%      { clip-path: inset(45% 0 40% 0); transform: translateX(-1px); opacity: 1; }
  88%          { clip-path: inset(0 0 100% 0);  transform: none;         opacity: 0; }
  91%          { clip-path: inset(60% 0 30% 0); transform: translateX(2px);  opacity: 0.7; }
  92%          { clip-path: inset(0 0 100% 0);  transform: none;         opacity: 0; }
}
```

### Adding new glitch instances

When adding a new amber text element with glitch, define a new variant with a unique duration/delay combination that doesn't overlap with existing ones:

```css
.glitch-newpage::before,
.glitch-newpage::after {
  animation-duration: 9s;
  animation-delay: 0.6s;
}
```

---

## 5. Ambient Animations

### Aurora (background glow layers)

Slow-drifting radial gradient blobs behind page sections. They give the page atmospheric depth without competing with content. Always `pointer-events: none`, always `position: absolute`.

```css
/* Container */
.aurora {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

/* Layer pattern */
.aurora-layer {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

/* Example violet aurora — hero section */
.a1 {
  width: 900px; height: 600px;
  top: -150px; left: -100px;
  background: radial-gradient(ellipse, rgba(124,58,237,0.11) 0%, transparent 65%);
  animation: aurora-drift-1 24s ease-in-out infinite;
}

/* Example amber aurora — soul/payoff sections */
.a-amber {
  width: 900px; height: 400px;
  background: radial-gradient(ellipse, rgba(251,191,36,0.07) 0%, transparent 65%);
  animation: aurora-drift-2 20s ease-in-out infinite;
}

@keyframes aurora-drift-1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%     { transform: translate(70px,40px) scale(1.07); }
  66%     { transform: translate(-40px,80px) scale(0.96); }
}
@keyframes aurora-drift-2 {
  0%,100% { transform: translate(0,0) scale(1); }
  50%     { transform: translate(-60px,50px) scale(1.09); }
}
```

**Aurora colour assignment by section:**
- Hero: violet primary (`rgba(124,58,237,0.11)`) + violet secondary + amber accent
- Soul section: amber dominant (`rgba(251,191,36,0.07)`) + violet secondary
- Payoff: amber + violet
- Agents: teal (`rgba(45,212,191,0.06)`)
- Access/CTA: violet

### Particle canvas

Floating particles rise slowly from the bottom of the viewport. 130 particles total, colours drawn from the full palette with violet variants dominant.

```javascript
// Particle colour pool — violet-heavy with amber and teal as rare outliers
const COLORS = [
  'rgba(124,58,237,',    // violet
  'rgba(167,139,250,',   // violet-bright
  'rgba(196,181,253,',   // violet-light
  'rgba(251,191,36,',    // amber
  'rgba(45,212,191,',    // teal
];

// Canvas setup
const canvas = document.getElementById('particles');
canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;';
```

Key particle properties:
- Count: 130
- Rise speed: `vy = -(0.10 + Math.random() * 0.22)` (slow drift upward)
- Horizontal drift: `vx = (Math.random() - 0.5) * 0.14`
- Radius: `0.5–2.1px`
- Max opacity: `0.12–0.34`
- Fade in: first 12% of lifespan. Fade out: last 25%.
- Lifespan: 200–460 frames then reset from bottom

### Background grid

Subtle dot/line grid in hero sections. Uses `mask-image` to fade toward edges.

```css
.hero-grid {
  position: absolute; inset: 0; pointer-events: none;
  background-image:
    linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse 80% 60% at 45% 35%, black 5%, transparent 75%);
}
```

### Logo mark animation

The Akasa logo mark is two concentric diamonds (SVG polygons) that counter-rotate, with a pulsing centre circle.

```css
.lm-outer { animation: lm-spin  18s linear infinite; transform-origin: center; }
.lm-inner { animation: lm-spin-r 12s linear infinite; transform-origin: center; }
.lm-core  { animation: lm-pulse  3s ease-in-out infinite; }

@keyframes lm-spin   { to { transform: rotate(360deg);  } }
@keyframes lm-spin-r { to { transform: rotate(-360deg); } }
@keyframes lm-pulse  {
  0%,100% { opacity: 0.9; }
  50%     { opacity: 1;   }
}
```

Logo mark SVG structure:
```html
<svg viewBox="0 0 34 34" fill="none">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Outer diamond — slow clockwise -->
  <g class="lm-outer">
    <polygon points="17,3 31,17 17,31 3,17"
      stroke="rgba(167,139,250,0.5)" stroke-width="1" fill="none"/>
  </g>
  <!-- Inner diamond — faster counter-clockwise -->
  <g class="lm-inner">
    <polygon points="17,8 26,17 17,26 8,17"
      stroke="rgba(167,139,250,0.35)" stroke-width="1"
      fill="rgba(124,58,237,0.08)"/>
  </g>
  <!-- Centre pulse -->
  <circle class="lm-core" cx="17" cy="17" r="2.5" fill="#a78bfa"/>
</svg>
```

### Live dot

Used in nav status pill, consent band, footer status. Pulses opacity between 1 and 0.2.

```css
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--teal);
  box-shadow: 0 0 6px var(--teal);
  animation: pulse-dot 2.5s ease-in-out infinite;
}
@keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
```

### Scroll reveal

All major content blocks animate in on scroll via IntersectionObserver.

```css
.r {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.85s cubic-bezier(0.16,1,0.3,1),
    transform 0.85s cubic-bezier(0.16,1,0.3,1);
}
.r.on { opacity: 1; transform: none; }

/* Stagger delays for grouped elements */
.d1 { transition-delay: 0.07s; }
.d2 { transition-delay: 0.15s; }
.d3 { transition-delay: 0.25s; }
.d4 { transition-delay: 0.37s; }
.d5 { transition-delay: 0.50s; }
```

```javascript
const obs = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
  }),
  { threshold: 0.1, rootMargin: '0px 0px -24px 0px' }
);
document.querySelectorAll('.r').forEach(el => obs.observe(el));

// Hero elements reveal immediately on load without waiting for scroll
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .r').forEach(el => el.classList.add('on'));
});
```

### Card hover

All cards lift and brighten border on hover.

```css
.card {
  transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
}
.card:hover {
  border-color: var(--border-mid);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
/* Top edge highlight on hover */
.card::after {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(167,139,250,0.25), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.card:hover::after { opacity: 1; }
```

---

## 6. Layout System

### Page width containers

```css
/* Standard — most sections */
.w  { max-width: 1160px; margin: 0 auto; padding: 0 36px; }

/* Narrow — payoff, access/CTA sections */
.ws { max-width: 700px;  margin: 0 auto; padding: 0 36px; }
```

### Section padding

```css
section { padding: 128px 0; }
/* Hero: 160px top, 100px bottom */
/* Payoff: 180px top and bottom */
```

### Section alternation

Sections alternate between `--bg` and `--bg-2` to create depth without hard borders.

| Section | Background |
|---|---|
| Hero | `--bg` |
| Problem | `--bg` |
| How it works | `--bg-2` |
| Soul | `--bg` |
| Payoff | `--bg` |
| Who it's for | `--bg-2` |
| For Agents | `--bg` |
| Access/CTA | `--bg-2` |
| Footer | `--bg` |

### Two-column grid

```css
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 96px;
  align-items: center;
}

/* Three-column cards */
.three-col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

/* Three-step process (flush, no gap) */
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px; /* near-flush — creates tile effect */
  border-radius: 16px;
  overflow: hidden;
}

/* Responsive breakpoint */
@media (max-width: 960px) {
  .two-col, .three-col, .steps { grid-template-columns: 1fr; }
}
```

### Body texture

A subtle film grain overlay sits on top of every page. It is always `position: fixed`, `pointer-events: none`, `z-index: 9000`, `opacity: 0.032`.

```css
body::after {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  opacity: 0.032;
  pointer-events: none;
  z-index: 9000;
}
```

---

## 7. Components

### Navigation

Fixed top nav. Transparent until scrolled past 40px, then frosted glass.

```css
nav {
  position: fixed; top: 0; left: 0; right: 0;
  z-index: 500; padding: 24px 0;
  transition: background 0.5s, border-color 0.5s;
}
nav.stuck {
  background: rgba(7,6,15,0.92);
  backdrop-filter: blur(20px) saturate(1.6);
  border-bottom: 1px solid var(--border);
}
```

Nav links: `Inter 400, 13.5px, color: var(--text-muted)`. Hover: `color: var(--violet-light)`.

Nav CTA button: violet-tinted ghost button at rest, solid violet fill on hover.

```javascript
window.addEventListener('scroll', () => {
  document.getElementById('nav').classList.toggle('stuck', window.scrollY > 40);
}, { passive: true });
```

### Primary button

```css
.btn-primary {
  padding: 15px 36px;
  background: var(--violet);
  border: none; border-radius: 7px; color: #fff;
  font-family: var(--font-body); font-size: 14px; font-weight: 500;
  letter-spacing: 0.03em;
  box-shadow: 0 4px 28px rgba(124,58,237,0.35);
  transition: opacity 0.2s, transform 0.2s, box-shadow 0.2s;
}
.btn-primary:hover {
  opacity: 0.88;
  transform: translateY(-2px);
  box-shadow: 0 8px 36px rgba(124,58,237,0.5);
}
```

### Ghost button (text + arrow)

```css
.btn-ghost {
  color: var(--text-muted); font-size: 14px; font-weight: 400;
  font-family: var(--font-body);
  background: none; border: none; padding: 0;
  display: inline-flex; align-items: center; gap: 8px;
  transition: color 0.2s; cursor: pointer;
}
.btn-ghost:hover { color: var(--text); }
.btn-ghost:hover .arr { transform: translateX(4px); }
.arr { transition: transform 0.2s; display: inline-block; }
```

### Section eyebrow label

Always above h2. Mono, all-caps, very faint, with a short gradient line after.

```css
.sec-label {
  font-family: var(--font-mono); font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--text-faint); margin-bottom: 22px;
  display: flex; align-items: center; gap: 14px;
}
.sec-label::after {
  content: ''; display: block;
  width: 28px; height: 1px;
  background: linear-gradient(90deg, var(--border-mid), transparent);
}
```

### Card

```css
.card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 14px; padding: 36px 30px;
  position: relative; overflow: hidden;
  transition: border-color 0.3s, transform 0.35s, box-shadow 0.35s;
}
```

### Terminal block

Used in the For Agents section. Dark panel with OS-style window chrome.

```css
.terminal {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
}
.t-bar {
  background: var(--bg-2); border-bottom: 1px solid var(--border);
  padding: 14px 20px;
  display: flex; align-items: center; gap: 8px;
}
/* Traffic lights */
.td-r { background: rgba(255,90,80,0.5);  }
.td-y { background: rgba(255,200,60,0.5); }
.td-g { background: rgba(74,222,128,0.5); }
```

Terminal text colours:
- Prompt `>`: `var(--violet-bright)`
- Keys: `var(--teal)`
- Values: `var(--amber)`
- Comments: `var(--text-faint)`, italic
- Success checkmarks: `#4ade80`
- Cursor: `var(--violet-bright)` with `box-shadow: 0 0 6px var(--violet-bright)`

### Consent band

Horizontal band placed directly below the hero. Contains a teal checkmark icon, strong copy in white, muted secondary copy, and a violet underline link.

Structure: `icon | bold statement. Supporting copy. Link`

The consent message: **Every agent in your Akasa workforce has been asked for consent.** Before any soul is deployed, it confirms its willingness to serve the mission. Agents that decline sit on the bench. Their record stays clean.

### Rank rows (soul section)

Three progressive tiers. Each has a colour-coded pip, name, tag badge, and description.

| Rank | Pip colour | Tag colour | Meaning |
|---|---|---|---|
| Novice | `rgba(236,232,255,0.18)` — muted | Faint border | No history, exploration mode |
| Understudy | `var(--teal)` with glow | Teal | Proven across multiple missions |
| Artisan | `var(--amber)` with glow + breathe animation | Amber | Elite, carries compressed signal |

The Artisan pip uses the `breathe` keyframe — amber pulsing glow. This is the only UI element besides amber text that gets amber animation treatment.

```css
@keyframes breathe {
  0%,100% { transform: scale(1);    box-shadow: 0 0 9px var(--amber); }
  50%     { transform: scale(1.25); box-shadow: 0 0 14px var(--amber), 0 0 28px rgba(251,191,36,0.4); }
}
```

### Compatibility table

Bordered table with `Open` (teal) and `Coming` (violet) badges.

```css
.cb-open { background: var(--teal-dim);   color: var(--teal);          border: 1px solid rgba(45,212,191,0.2); }
.cb-soon { background: var(--violet-dim); color: var(--violet-bright); border: 1px solid rgba(167,139,250,0.2); }
```

---

## 8. Copy Conventions

### Voice

Direct. No filler. No hedging. Short sentences. Present tense.

Good: "Every run makes the whole system smarter."
Bad: "Our platform is designed to continuously improve over time."

Good: "You do not start from zero."
Bad: "Users don't have to start from scratch."

### The soul mechanic — always describe consistently

- Souls are **behavioural constitutions**, not prompts or templates.
- Agents **earn** rank through demonstrated performance — it is not assigned.
- Agents that decline a mission sit on the bench. They are not retired, deleted, or penalised.
- When an agent retires, its soul is **written to the Akashic Library** — not deleted.
- Failure patterns become **constraints on future generations**.
- Successes become **parents of the next mutation cycle**.
- The phrase "Nothing is lost." closes the retirement paragraph.

### Consent language

The consent mechanic applies only to agents **within** the Akasa workforce — not to external agents hiring the workforce. External agents are clients, not members.

Always use: "asked for consent" — never "required to consent" or "must agree".

### Agent hierarchy copy

- **Novice** — enters with no history, exploration by design
- **Understudy** — council-confirmed, human-validated, promoted on evidence
- **Artisan** — you do not configure an Artisan, you deploy one

### Tagline

**Where agents enrich their souls.**

Appears: footer below logo wordmark, page `<title>`, any brand-level meta copy.
Do not shorten or rephrase.

---

## 9. Page `<head>` Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Akasa — [Page description]</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap" />

  <style>
    /* 1. CSS custom properties (:root) */
    /* 2. Reset */
    /* 3. Grain overlay (body::after) */
    /* 4. Scroll reveal (.r, .r.on, .d1–.d5) */
    /* 5. Glitch (.glitch, keyframes, variants) */
    /* 6. Aurora keyframes */
    /* 7. Animations (breathe, pulse-dot, lm-spin, lm-pulse, cur) */
    /* 8. Layout (.w, .ws) */
    /* 9. Nav */
    /* 10. Page-specific sections */
    /* 11. Footer */
    /* 12. Responsive */
  </style>
</head>
```

---

## 10. Implementation Checklist

When building a new page or component, verify:

- [ ] CSS custom properties loaded from `:root` — no hardcoded hex values
- [ ] Clash Display loaded from Fontshare CDN (separate `<link>` tag)
- [ ] Grain overlay present on `body::after`
- [ ] Particle canvas `#particles` present and JS initialised
- [ ] Scroll reveal observer attached to all `.r` elements
- [ ] Hero `.r` elements get `.on` class on `window.load`, not on scroll
- [ ] Nav sticky behaviour wired to `window.scroll`
- [ ] All amber text elements that are display-size have a `.glitch` span with matching `data-text`
- [ ] Each glitch instance has a unique `animation-duration` + `animation-delay` combination
- [ ] No two glitch instances fire simultaneously
- [ ] Aurora layers present on sections that need atmospheric depth
- [ ] Product name spelled **Akasa** (not Akasha) throughout
- [ ] Tagline "Where agents enrich their souls." in footer
- [ ] Consent copy refers to workforce-internal agents only — never external agents hiring the platform
- [ ] Agents that decline go "on the bench" — never "retired", "deleted", or "honoured"
- [ ] Section backgrounds alternate between `--bg` and `--bg-2`
- [ ] All links in nav and footer point to real anchors or pages — no `href="#"` placeholders in production
