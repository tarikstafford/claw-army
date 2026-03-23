# Phase 2: Design System Tokens and Typography - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

CSS token foundation for both Front Office and Back Office worlds, plus self-hosted font loading. This phase delivers the complete token layer (colours, spacing, radii, opacity scale, semantic colour constants, model tier colours, agent identity colours) and the three typefaces (Cormorant Garamond, DM Sans, Press Start 2P). No components — those are Phase 3.

Requirements covered: DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, DS-07

</domain>

<decisions>
## Implementation Decisions

### Token Migration
- **D-01:** Clean slate — replace `app.css` entirely with the v2 token system. The existing v5.0 content (glitch effects, scroll-reveal, buttons, landing page styles) are v5 artifacts that will be rebuilt using new tokens in Phase 3/4 when needed. No backward compatibility shims.
- **D-02:** Semantic aliases that auto-switch between modes. Define `--bg`, `--card`, `--text`, `--text-muted`, `--border` etc. in `:root` pointing to `--fo-*` values, then override in `body.back-office` to point to `--bo-*` values. Components never reference `--fo-*` or `--bo-*` directly — they use the semantic aliases. Both raw tokens and semantic aliases are defined (raw for design guide compliance, aliases for component ergonomics).

### World Toggle Persistence
- **D-03:** localStorage + inline blocking script in `app.html`. A tiny `<script>` reads the stored preference and sets `body.back-office` class BEFORE first paint — zero flash of wrong theme, no server dependency, works offline. The toggle function in JS updates both the class and localStorage.

### Deprecated Token Enforcement
- **D-04:** `lint:tokens` grep script in root `package.json`. Greps for banned patterns (`--h-*`, `--d-*`, `--ak-*`, and bare v5 names that shouldn't be used in new code). Lightweight, no extra dependencies. Can be wired into CI later.

### Font Loading
- **D-05:** Cormorant Garamond: weights 300, 400, 600 + italic via `@fontsource/cormorant-garamond`. DM Sans: variable weight via `@fontsource-variable/dm-sans`. Press Start 2P: single weight via `@fontsource/press-start-2p`. Latin subset only.
- **D-06:** Font CSS imports go in `+layout.svelte` (root layout). Vite processes and bundles font files with content hashes. Standard SvelteKit pattern.
- **D-07:** Font vars: `--font-display` = Cormorant Garamond, `--font-body` = DM Sans, `--font-label` = Press Start 2P. Replaces v5's Clash Display and Inter.

### Claude's Discretion
- Exact spacing scale naming convention (`--space-xs` through `--space-3xl` per DS-07, replacing v5's `--s-1` through `--s-12`)
- Border radius scale values (`--radius-sm/md/lg`)
- How to structure the app.css file internally (sections, comments, ordering)
- Whether to split tokens into separate files or keep in one app.css
- Exact semantic alias names beyond the obvious (--bg, --card, --text, --border)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System Specification
- `tasks/akasa-design-guide-v2.md` — THE authoritative reference for all token values. Contains exact hex values, opacity scales, font specs, spacing values, component patterns, and semantic colour rules. Every CSS custom property must match this document.
- `tasks/akasa-design-guide.md` — v1 design guide (superseded by v2 for token values, but may have additional context)

### Existing Code
- `services/ui/src/app.css` — Current v5.0 token system being replaced. Read to understand what exists before overwriting.
- `services/ui/src/routes/+layout.svelte` — Where font imports will be added
- `services/ui/src/app.html` — Where the blocking mode-detection script goes

### Architecture
- `tasks/prd-akasa-mvp.md` — Product requirements, defines the two-world concept (Screenplay = Front Office, Director's Cut = Back Office)
- `.planning/PROJECT.md` — v6.0 architecture decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/ui/src/app.css` — File location is correct, structure will be completely replaced
- `services/ui/src/app.html` — Exists, will need the inline mode-detection script added

### Established Patterns
- Pure CSS custom properties in scoped `<style>` blocks — no Tailwind, no CSS modules
- `@claw/source` custom condition for dev-time resolution
- ESM everywhere with `"type": "module"`
- SvelteKit v2 + Svelte 5 runes

### Integration Points
- `app.css` — global token definitions consumed by every component
- `+layout.svelte` — font import location, mode toggle state management
- `app.html` — blocking script for flash prevention
- `package.json` (root) — `lint:tokens` script addition
- `services/ui/package.json` — `@fontsource` package dependencies

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The v2 design guide is highly prescriptive about values; this phase is about faithful implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-design-system-tokens-and-typography*
*Context gathered: 2026-03-23*
