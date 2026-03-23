# Phase 3: Design System Components and Motion - Research

**Researched:** 2026-03-23
**Domain:** Svelte 5 component authoring, CSS transitions, design system implementation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Props-first API.** Components take typed props for all configuration. Svelte 5 snippets (`{@render children()}`) only for complex nested content (modal body, accordion expanded content).
- **D-02: Nav structure.** 4 tabs: INDRA (`/indra`), OFFICE (`/office`), CHAT (`/chat`), SANCTUM (`/sanctum`). NavBar visual fidelity only in Phase 3 — actual route wiring deferred to Phase 4. Tabs may link to placeholder/current v5 routes temporarily.
- **D-03: World-native only.** Back Office components: MechanicCard, Accordion, SlidePanel, Modal, KarmaCallout. Front Office components: ChatBubble, MetricTile. Shared (explicit both-world styles): NavBar. No cross-world custom styles added beyond semantic aliases.
- **D-04: Product naming in nav + new components only.** SANCTUM tab, "karma" not "score", "work" not "run". Do NOT rename strings in existing v5 pages. No naming constants file needed yet.

### Claude's Discretion

- Component file organization within `services/ui/src/lib/components/` (flat vs subdirectory)
- Whether to keep or replace existing v5 components (ParticleCanvas, SoulInspectorPanel, SoulTierBadge, VerdictConfirmPanel)
- Exact Svelte 5 snippet patterns for accordion/modal nested content
- Whether NavBar active tab state uses SvelteKit `$page.url` or a prop
- Motion system implementation approach (global CSS vs per-component scoped transitions)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-08 | Core component patterns implemented — nav bar (44px fixed, mode toggle), mechanic cards, accordion, slide panel, modal, chat bubbles, metric tiles, karma callout | Full CSS specs extracted from design guide §6; Svelte 5 implementation patterns documented |
| DS-09 | Model tier colours shared across modes — `--tier-junior` (Haiku/blue), `--tier-mid` (Sonnet/violet), `--tier-senior` (Opus/amber) | Tokens already in app.css from Phase 2; TierBadge pattern documented |
| DS-10 | Agent identity colours — `--agent-indra`, `--agent-contr` + per-named-agent colours for office/chat/dashboard | Tokens already in app.css; usage pattern documented |
| DS-11 | Motion system — GPU-composited transforms only, mode switch 0.4s, card hover 0.15s, slide panel 0.38s cubic-bezier, gem-spin logo | All transition specs extracted from design guide §8; GPU-compositing rules documented |
| DS-12 | Product naming — Sanctum, The Chronicle, The Record, "Karma" not "score", agents "work" not "run" | Complete naming rules extracted from design guide §10; only applied to new components and nav |
</phase_requirements>

---

## Summary

Phase 3 delivers the full reusable component library that all future feature phases consume. The design guide v2 (`tasks/akasa-design-guide-v2.md`) is completely prescriptive — every component has exact CSS specs already written. Implementation is primarily a CSS fidelity + Svelte 5 API design exercise, not a research/discovery exercise.

The existing (app) layout uses a v5 sidebar pattern that must be replaced by the new horizontal NavBar. The sidebar currently imports old Google Fonts CDN fonts (Inter + Clash Display via Fontshare) — Phase 2 replaced these with self-hosted `@fontsource` packages, but the `<svelte:head>` block in `(app)/+layout.svelte` still has the old CDN links and must be removed when the NavBar replaces the layout. The main-content offset (`margin-left: 220px`) will also change to `padding-top: 44px` when the sidebar becomes a top nav.

The token system from Phase 2 is complete and correct. Components use semantic aliases (`--bg`, `--card`, `--text`, `--border`, `--accent`, `--karma`, `--text-muted`) rather than raw `--fo-*` / `--bo-*` tokens directly. The exceptions are Back Office-specific components (SlidePanel, Modal, Accordion) which reference `--bo-*` tokens directly since they are Back Office-native per D-03.

**Primary recommendation:** Build components in the exact order: NavBar first (integrates mode toggle, replaces layout), then Back Office components (MechanicCard, Accordion, SlidePanel, Modal, KarmaCallout), then Front Office components (ChatBubble, MetricTile). Each component is independently testable.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit v2 | ^2.52.0 | Routing + SSR framework | Established in this repo |
| Svelte 5 | ^5.51.3 | Component runtime | Established in this repo |
| `@fontsource/cormorant-garamond` | latest | Self-hosted display font | Installed Phase 2 |
| `@fontsource-variable/dm-sans` | latest | Self-hosted body font | Installed Phase 2 |
| `@fontsource/press-start-2p` | latest | Self-hosted label font | Installed Phase 2 |

### No New Packages Required

Phase 3 is pure CSS + Svelte component work. No additional npm packages are needed. The entire design system is implemented through:
- CSS custom properties (already in `app.css`)
- CSS transitions (`transform`, `opacity`) — GPU-composited, no JavaScript animation library needed
- Svelte 5 reactive primitives (`$state`, `$derived`, `$effect`, `$props`)
- SvelteKit `$page` store for NavBar active tab detection

### Installation

None required. Phase 2 installed all font packages.

---

## Architecture Patterns

### Recommended Component Organization

```
services/ui/src/lib/components/
├── NavBar.svelte              # Shared — explicit Front+Back Office styles
├── MechanicCard.svelte        # Back Office
├── Accordion.svelte           # Back Office
├── SlidePanel.svelte          # Back Office
├── Modal.svelte               # Back Office
├── KarmaCallout.svelte        # Back Office
├── ChatBubble.svelte          # Front Office
├── MetricTile.svelte          # Front Office
│
│   # Existing — keep, do not replace
├── ParticleCanvas.svelte      # Keep (canvas animation)
├── SoulInspectorPanel.svelte  # Keep (functional, already uses v2 tokens)
├── SoulTierBadge.svelte       # Keep (already correct)
└── VerdictConfirmPanel.svelte # Keep (functional)
```

**Recommendation (Claude's Discretion):** Flat structure. 8 new components, all in `src/lib/components/`. No subdirectories — the total count is manageable and subdirectories add import path complexity for marginal benefit.

### Pattern 1: Props-First Svelte 5 Component

```typescript
// Source: CONTEXT.md D-01 + Svelte 5 runes API
<script lang="ts">
  let {
    tag,
    title,
    summary,
    onclick,
  }: {
    tag: string;
    title: string;
    summary: string;
    onclick?: () => void;
  } = $props();
</script>
```

All props typed inline. No `interface Props` pattern needed unless props count exceeds 6.

### Pattern 2: Snippet for Nested Content (Accordion/Modal)

```typescript
// Source: Svelte 5 snippets documentation
// Used only when slot content is structurally complex (modal body, accordion expanded content)
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    children,
  }: {
    title: string;
    children?: Snippet;
  } = $props();
</script>

{#if children}
  {@render children()}
{/if}
```

### Pattern 3: NavBar Active Tab via $page

```typescript
// Source: SvelteKit $page store — established in existing (app)/+layout.svelte
import { page } from '$app/stores';

function isActive(href: string): boolean {
  return $page.url.pathname.startsWith(href);
}
```

**Recommendation (Claude's Discretion):** Use `$page.url` reactive approach — consistent with how the v5 sidebar already works, zero prop-drilling required, and naturally reactive to navigation.

### Pattern 4: CSS-Only Slide Panel Toggle

```css
/* Source: design guide §6.4 */
.slide-panel {
  transform: translateX(100%);
  transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-panel.open { transform: translateX(0); }
```

The `open` class is toggled by parent `$state(boolean)`. No JS animation library. Pure CSS transform — GPU-composited.

### Pattern 5: Accordion max-height Transition

```css
/* Source: design guide §6.3 and §11 (Do/Don't) */
.accordion-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
/* Open state — set via inline style or class */
.accordion-body.open { max-height: 600px; }
```

**Critical:** Never use `display: none / block` for accordion — no animation, layout jump. Always `max-height`. This is explicitly called out in the design guide §11 Do/Don't.

### Pattern 6: Modal Backdrop Close

```svelte
<!-- Source: design guide §6.6 -->
<div
  class="modal-overlay"
  class:open={isOpen}
  onclick={() => isOpen = false}
  role="dialog"
  aria-modal="true"
>
  <div class="modal-box" onclick={(e) => e.stopPropagation()}>
    <!-- modal content -->
  </div>
</div>
```

### Pattern 7: NavBar Layout Integration

When the NavBar component is added, the `(app)/+layout.svelte` must be refactored:

1. Remove the entire `<aside class="sidebar">` block and its styles
2. Remove the `<button class="hamburger">` and mobile sidebar machinery
3. Remove old Google Fonts CDN links from `<svelte:head>`
4. Add `<NavBar />` component
5. Change `.main-content { margin-left: 220px }` → `padding-top: 44px`
6. The lifecycle toasts system stays — it is mode-agnostic and correct

### Anti-Patterns to Avoid

- **Animating `height` instead of `max-height`:** Layout-triggering, causes jank. Always `max-height` for accordion reveal.
- **Animating `background-color`, `top`, `left`, `width`:** Triggers layout reflow. Use `transform` + `opacity` only (design guide §8.1).
- **Using `display: none` for slide panel:** Defeats transition. Panel must remain in DOM, hidden via `transform: translateX(100%)`.
- **Importing `--fo-*` / `--bo-*` raw tokens in shared components:** Use semantic aliases (`--bg`, `--card`, `--text`) so components respond to mode toggle automatically. Back Office-native components (SlidePanel, Modal, Accordion, MechanicCard, KarmaCallout) MAY reference `--bo-*` directly as they are designed only for that world.
- **Press Start 2P above 8px:** Design guide §4.1 is explicit — this font is for labels/tags/chrome at 6-8px only. Larger sizes are illegible and look like mistakes.
- **Using amber for non-karma contexts:** `--bo-amber` / `--karma` is a semantic constant meaning karma/compounding value. Never use it for general emphasis.
- **Using `#000000` as background:** Back Office background is `#06050E` — pure black has no relationship to the violet family.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Custom font CSS / Google Fonts CDN | `@fontsource/*` already installed | Already done Phase 2; CDN adds latency + GDPR exposure |
| Animation library | GSAP, Framer Motion, anime.js | Native CSS transitions | GPU-composited CSS transitions are sufficient; no JS overhead |
| CSS-in-JS / utility CSS | Tailwind, emotion | Pure CSS custom properties in scoped `<style>` | Already established pattern; conflicts with existing token system |
| Active route detection | Custom router tracking | SvelteKit `$page.url` | Already used in existing layout |
| Theme persistence | Custom cookie/SSR approach | `localStorage` + blocking script | Already implemented in Phase 2 via mode.ts |

**Key insight:** Every transition in this phase can be achieved with native CSS `transform` and `opacity`. Zero animation library needed.

---

## Common Pitfalls

### Pitfall 1: Old Layout Font CDN Links Not Removed

**What goes wrong:** `(app)/+layout.svelte` still has `<svelte:head>` links to Google Fonts (Inter + Clash Display via Fontshare). These will load after the self-hosted fonts and override them in some browsers, breaking the typography system.
**Why it happens:** Phase 2 added `@fontsource` imports but did not clean the layout's `<svelte:head>` block — that cleanup was deferred to Phase 3 NavBar work.
**How to avoid:** When replacing the sidebar layout with NavBar, explicitly remove the entire `<svelte:head>` block from `(app)/+layout.svelte`.
**Warning signs:** Press Start 2P shows as system monospace; Cormorant Garamond appears as Georgia.

### Pitfall 2: main-content Offset Not Updated

**What goes wrong:** After replacing the sidebar with a fixed-top NavBar, `.main-content { margin-left: 220px }` is no longer correct. Content appears with a 220px left indent.
**Why it happens:** The sidebar layout sets `margin-left` on `.main-content` to clear the sidebar. NavBar is fixed-top, so offset should be `padding-top: 44px` instead.
**How to avoid:** When refactoring `(app)/+layout.svelte`, change the main content offset simultaneously with NavBar addition.
**Warning signs:** All page content is shifted 220px to the right.

### Pitfall 3: Svelte 5 `$page` Store Used as Non-Reactive

**What goes wrong:** `$page.url.pathname` is used in a plain expression rather than a reactive context, so active tab state does not update on navigation.
**Why it happens:** In Svelte 5, `$page` is a store. Reading it outside a `$derived()` or template expression is non-reactive.
**How to avoid:** Use `$page.url.pathname` directly in the template or inside a `$derived()`. The existing layout's `isActive()` function called from the template is correct.
**Warning signs:** Clicking a nav tab changes the URL but the active state stays on the previous tab.

### Pitfall 4: Backdrop Filter Causing Composite Layer Issues

**What goes wrong:** The NavBar uses `backdrop-filter: blur(12px)` for the glass effect. If child elements also have `transform` or `will-change`, they may not blur correctly on some browsers.
**Why it happens:** `backdrop-filter` creates a new stacking context; elements with transforms inside it can escape the blur.
**How to avoid:** Do not apply `transform` or `will-change` to elements that are direct children of the NavBar. Apply `transform` effects to content below/beside the nav only.
**Warning signs:** The glass blur effect disappears or becomes a solid colour on Chrome.

### Pitfall 5: Accordion max-height Too Small

**What goes wrong:** `max-height: 600px` may clip taller accordion body content (long text, nested components).
**Why it happens:** `max-height` transition requires a fixed value to animate to. If content is taller, it gets clipped.
**How to avoid:** Use `max-height: 1000px` or a sufficiently large value. The transition speed feels identical to `600px` for content under that size; the excess range is never visible.
**Warning signs:** Accordion body content is cut off when expanded.

### Pitfall 6: SlidePanel z-index Conflicts with Lifecycle Toasts

**What goes wrong:** The existing lifecycle toasts in `(app)/+layout.svelte` use `z-index: 600`. The design guide's SlidePanel uses `z-index: 200`, which puts it behind the toasts — correct. But if the toast `z-index` is lowered, or if the Modal (z-index: 9000) is opened while a toast is visible, the toast appears behind the modal backdrop.
**Why it happens:** z-index layering: Modal backdrop (9000) > toasts (600) > SlidePanel (200) > NavBar (9999). Wait — NavBar at 9999 is above modal backdrop at 9000.
**How to avoid:** Use the z-index stack from design guide: NavBar `z-index: 9999`, Modal overlay `z-index: 9000`, lifecycle toasts `z-index: 600`, SlidePanel `z-index: 200`. This stack is intentional — the NavBar must render above modals (mode toggle must always be accessible).
**Warning signs:** Modal backdrop doesn't fully dim the NavBar.

### Pitfall 7: DS-12 Naming Contamination in Existing Pages

**What goes wrong:** D-04 says apply naming only in new components and nav. But a developer might also fix the old page strings seen nearby ("Dashboard" label in the sidebar, "runs" in the dashboard page).
**Why it happens:** Adjacent text makes the violation visible during development.
**How to avoid:** Existing pages rebuild with correct naming in Phase 4. Phase 3 scope is: NavBar tabs (SANCTUM, not Dashboard) and new components only. Do not touch any `/routes/(app)/` page content.
**Warning signs:** Git diff shows changes to `.svelte` route files other than `(app)/+layout.svelte`.

---

## Code Examples

Verified patterns from official design guide (source: `tasks/akasa-design-guide-v2.md`):

### NavBar CSS (both worlds)

```css
/* Source: design guide §6.1 */
#nav-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 44px;
  z-index: 9999;
  display: flex;
  align-items: stretch;
  backdrop-filter: blur(12px);
}

/* Front Office */
#nav-bar { background: rgba(245, 242, 236, 0.96); border-bottom: 1px solid var(--fo-rule); }
/* Back Office */
body.back-office #nav-bar { background: rgba(6, 5, 14, 0.96); border-bottom: 1px solid var(--bo-border); }

.logo-gem {
  width: 10px;
  height: 10px;
  background: var(--fo-gold);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  animation: gem-spin 5s linear infinite;
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
.nav-tab.on            { background: var(--fo-plum); color: #fff; }
body.back-office .nav-tab.on { background: var(--bo-violet); color: #fff; }
```

### MechanicCard CSS (Back Office)

```css
/* Source: design guide §6.2 */
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
.mcard-tag   { font-family: 'Press Start 2P', monospace; font-size: 6px; color: var(--bo-vb); letter-spacing: 0.10em; margin-bottom: 9px; }
.mcard-title { font-family: 'Cormorant Garamond', serif; font-size: 18px; font-weight: 600; color: var(--bo-text); margin-bottom: 6px; }
.mcard-summary { font-size: 12px; font-style: italic; color: rgba(236, 232, 255, 0.42); line-height: 1.5; }
.mcard-cta   { font-family: 'Press Start 2P', monospace; font-size: 5px; color: var(--bo-vb); margin-top: 10px; opacity: 0.65; }
```

### SlidePanel CSS (Back Office)

```css
/* Source: design guide §6.4 */
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
```

### KarmaCallout CSS

```css
/* Source: design guide §6.5 */
.karma-callout {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  background: rgba(251, 191, 36, 0.10);
  border: 1px solid rgba(251, 191, 36, 0.30);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  color: var(--bo-amber);
  line-height: 1.6;
}
```

### Modal CSS (Back Office)

```css
/* Source: design guide §6.6 */
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
```

### ChatBubble CSS (Front Office)

```css
/* Source: design guide §6.8 */
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
.chat-bubble.user {
  background: var(--fo-plum);
  color: #fff;
  border-color: transparent;
  align-self: flex-end;
}
.chat-sender { font-family: 'Press Start 2P', monospace; font-size: 5px; color: var(--muted); margin-bottom: 4px; letter-spacing: 0.08em; }
```

### MetricTile CSS (Front Office / Sanctum)

```css
/* Source: design guide §6.9 */
.metric-tile {
  background: #fff;
  border: 1px solid var(--fo-rule);
  box-shadow: 2px 2px 0 var(--fo-bg3);
  padding: 12px 14px;
}
.metric-label { font-family: 'Press Start 2P', monospace; font-size: 5px; color: var(--muted); margin-bottom: 7px; letter-spacing: 0.10em; }
.metric-value { font-family: 'Press Start 2P', monospace; font-size: 20px; color: var(--ink); line-height: 1; }
.metric-sub   { font-family: 'DM Sans', sans-serif; font-size: 10px; color: var(--muted); margin-top: 3px; }
```

### Typing Indicator (ChatBubble sub-component)

```css
/* Source: design guide §6.8 */
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

### Motion System — All Transition Durations

```css
/* Source: design guide §8.2 — authoritative transition spec */
.mode-world    { transition: opacity 0.4s ease, transform 0.4s ease; }   /* mode switch */
.mcard         { transition: border-color 0.2s, transform 0.15s; }        /* card hover */
.slide-panel   { transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1); } /* slide panel */
.accordion-body { transition: max-height 0.3s ease; }                      /* accordion */
.panel-close   { transition: all 0.2s; }                                   /* close buttons */
.accordion-arrow { transition: transform 0.2s; }                           /* arrow rotation */
.logo-gem      { animation: gem-spin 5s linear infinite; }                 /* brand-only */
```

### Svelte 5 NavBar — Active Tab Pattern

```svelte
<!-- Source: SvelteKit $page store — matches existing layout pattern -->
<script lang="ts">
  import { page } from '$app/stores';
  import { setMode, getMode, toggleMode, type AkasaMode } from '$lib/mode';

  const TABS = [
    { label: 'INDRA',   href: '/indra' },
    { label: 'OFFICE',  href: '/office' },
    { label: 'CHAT',    href: '/chat' },
    { label: 'SANCTUM', href: '/sanctum' },
  ] as const;

  function isActive(href: string): boolean {
    return $page.url.pathname.startsWith(href);
  }

  function handleToggle() {
    toggleMode();
  }
</script>
```

---

## Existing Code: What to Keep vs Replace

### `(app)/+layout.svelte` — Partial Refactor Required

The current layout has a **sidebar** pattern. Phase 3 replaces it with a **top NavBar**. Required changes:

| Element | Action |
|---------|--------|
| `<svelte:head>` with Google Fonts CDN | REMOVE — old fonts from v5, replaced by @fontsource in Phase 2 |
| `<aside class="sidebar">` and all sidebar styles | REMOVE — replaced by NavBar component |
| `<button class="hamburger">` and mobile sidebar | REMOVE — NavBar handles mobile differently |
| `<div class="lifecycle-toasts">` | KEEP — mode-agnostic, correct implementation |
| `connectLifecycleSSE` and notification logic | KEEP — functional, unrelated to nav structure |
| `.main-content { margin-left: 220px }` | CHANGE to `padding-top: 44px` |
| `<ParticleCanvas />` | KEEP for now (Claude's Discretion) |

### Existing Components — All Keep

| Component | Status | Notes |
|-----------|--------|-------|
| `SoulTierBadge.svelte` | Keep | Already uses `--karma`, `--bo-teal`, `--bo-rose` correctly |
| `SoulInspectorPanel.svelte` | Keep | Functional, uses v2 semantic tokens, different from new SlidePanel |
| `VerdictConfirmPanel.svelte` | Keep | Functional modal-like component with business logic |
| `ParticleCanvas.svelte` | Keep | Background animation, no design system coupling |

**Note on SoulInspectorPanel vs SlidePanel:** These are different components. `SoulInspectorPanel` is a data-displaying overlay with API integration. `SlidePanel` is a design primitive (the chrome/container pattern). Phase 4 may refactor SoulInspectorPanel to use SlidePanel internally, but that is out of scope for Phase 3.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sidebar vertical nav (`<aside>`) | Fixed horizontal NavBar (44px) | Phase 3 | Main content offset changes from `margin-left` to `padding-top` |
| Google Fonts CDN in `<svelte:head>` | `@fontsource` self-hosted in layout | Phase 2 | CDN links must be removed from `(app)/+layout.svelte` `<svelte:head>` |
| `body.system` class for dark mode | `body.back-office` class | Phase 2 | Matches v2 design system spec |
| v5 sidebar nav labels ("Dashboard", "Souls", "Guide") | v6 nav tabs (INDRA, OFFICE, CHAT, SANCTUM) | Phase 3 | Semantic restructuring; old page routes remain temporarily |

---

## Open Questions

1. **NavBar mode toggle — button pair or single toggle?**
   - What we know: Design guide shows two buttons ("FRONT OFFICE" / "BACK OFFICE") in a pair. `mode.ts` has `toggleMode()` which flips between states.
   - What's unclear: Should the NavBar render two discrete buttons (as in the design guide spec) or a single button showing current mode?
   - Recommendation: Implement the two-button pair as specified. More visually explicit, matches the guide exactly. Both buttons always visible; the inactive one is style-muted.

2. **SlidePanel trigger mechanism**
   - What we know: The design guide shows SlidePanel triggered by SVG node clicks in the architecture diagram. In Phase 3 we're building the component in isolation.
   - What's unclear: Should SlidePanel manage its own `open` state internally or be controlled by a parent prop?
   - Recommendation: Prop-controlled (`open: boolean` prop + `onClose` callback). This matches D-01 props-first principle and is more composable for Phase 4 feature pages.

3. **Modal vs SlidePanel — SoulInspectorPanel migration timing**
   - What we know: The existing `SoulInspectorPanel` essentially implements a slide panel with bespoke styles. It's kept in Phase 3.
   - What's unclear: Will Phase 4 refactor it to use the new SlidePanel component?
   - Recommendation: Document the intent (Phase 4 can wrap SoulInspectorPanel content in SlidePanel), but this is out of Phase 3 scope. No action needed now.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely Svelte/CSS component work. No external tools, services, runtimes, or CLI utilities beyond the existing dev environment are required.

---

## Validation Architecture

> `nyquist_validation` key absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `pnpm --filter @claw/execution-service exec vitest run`) |
| Config file | Vitest config in execution-service |
| Quick run command | `pnpm --filter @claw/ui exec svelte-check --tsconfig ./tsconfig.json` |
| Full suite command | `pnpm --filter @claw/ui exec svelte-check --tsconfig ./tsconfig.json` |

**Note:** The UI service has no Vitest tests. Validation for this phase is type-checking (`svelte-check`) plus visual verification of component rendering. There is no component unit test framework for SvelteKit in this repo.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-08 | All 8 components render without TypeScript errors | type-check | `pnpm --filter @claw/ui exec svelte-check` | ❌ components are Wave 0 deliverables |
| DS-09 | `--tier-junior/mid/senior` vars apply to TierBadge | visual + type-check | `pnpm --filter @claw/ui exec svelte-check` | ✅ SoulTierBadge.svelte exists |
| DS-10 | `--agent-*` vars visible in component styles | visual | manual browser inspection | ✅ vars in app.css |
| DS-11 | All transitions use `transform`/`opacity` only | lint + visual | `pnpm lint:tokens` (partial) | ✅ script exists |
| DS-12 | No "score", "run", "store" in new component strings | grep | `grep -rn '"score"\|"run"\|"store"' services/ui/src/lib/components/` | ❌ Wave 0 |

### Sampling Rate

- **Per component commit:** `pnpm --filter @claw/ui exec svelte-check`
- **Per wave merge:** `pnpm --filter @claw/ui exec svelte-check` + visual review in both worlds
- **Phase gate:** All 8 components render in both worlds with no svelte-check errors before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `services/ui/src/lib/components/NavBar.svelte` — covers DS-08, DS-12
- [ ] `services/ui/src/lib/components/MechanicCard.svelte` — covers DS-08
- [ ] `services/ui/src/lib/components/Accordion.svelte` — covers DS-08
- [ ] `services/ui/src/lib/components/SlidePanel.svelte` — covers DS-08, DS-11
- [ ] `services/ui/src/lib/components/Modal.svelte` — covers DS-08
- [ ] `services/ui/src/lib/components/KarmaCallout.svelte` — covers DS-08
- [ ] `services/ui/src/lib/components/ChatBubble.svelte` — covers DS-08
- [ ] `services/ui/src/lib/components/MetricTile.svelte` — covers DS-08, DS-09, DS-12

---

## Project Constraints (from CLAUDE.md)

All directives below are mandatory and override research recommendations:

| Directive | Implication for This Phase |
|-----------|---------------------------|
| Pure CSS custom properties in scoped `<style>` blocks — no Tailwind, no CSS modules | All component styles use scoped `<style>` in `.svelte` files. No Tailwind classes. |
| Svelte 5 runes: `$props()`, `$state()`, `$derived()`, `$effect()`, `{@render children()}` | Use runes API throughout. No Svelte 4 `export let` syntax. |
| Files: `kebab-case.ts`, `PascalCase.svelte` | Component files: `NavBar.svelte`, `MechanicCard.svelte`, etc. |
| Named exports only — never `export default` | Not directly applicable to `.svelte` files, but applies to any `.ts` utilities created |
| ESM everywhere — `"type": "module"` | Already satisfied by project setup |
| No Tailwind, no component library | Confirmed — pure CSS only |
| Two worlds: Screenplay (Front Office) and Director's Cut (Back Office), toggled via `body.back-office` | NavBar mode toggle sets `body.back-office` via existing `setMode()` in `mode.ts` |
| Cormorant Garamond (display/headlines, 16px min), DM Sans (body/UI), Press Start 2P (labels/tags at 6-8px only) | Enforced per component CSS specs; Press Start 2P never used above 8px |
| `lib/api.ts` (`apiFetch` wrapper) for API calls | Not applicable — Phase 3 has no API calls |
| No global state library — local `$state()` + SvelteKit load functions | Component state uses `$state()` only |

---

## Sources

### Primary (HIGH confidence)

- `tasks/akasa-design-guide-v2.md` §6 (Components), §8 (Motion), §9 (Iconography), §10 (Voice and Copy), §11 (Do/Don't) — all CSS specs extracted directly
- `services/ui/src/app.css` — complete Phase 2 token system, confirmed correct
- `services/ui/src/lib/mode.ts` — mode toggle utility, confirmed ready
- `services/ui/src/routes/(app)/+layout.svelte` — current sidebar layout, confirmed needs refactor
- `.planning/phases/03-design-system-components-and-motion/03-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- `services/ui/src/lib/components/SoulInspectorPanel.svelte` — existing slide panel pattern reference
- `services/ui/src/lib/components/SoulTierBadge.svelte` — tier badge reference, model tier token usage

### Tertiary (LOW confidence)

None — all findings verified against codebase and design guide.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all tooling verified in-repo
- Architecture: HIGH — design guide is fully prescriptive; CSS specs transcribed verbatim
- Pitfalls: HIGH — layout migration pitfalls confirmed by direct codebase inspection
- Motion system: HIGH — all transition values extracted directly from design guide §8.2

**Research date:** 2026-03-23
**Valid until:** 2026-05-23 (stable domain — CSS/Svelte patterns; design guide unlikely to change)
