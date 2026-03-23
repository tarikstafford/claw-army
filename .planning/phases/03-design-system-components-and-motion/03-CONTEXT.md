# Phase 3: Design System Components and Motion - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Reusable Svelte 5 component library for the Akasa design system plus the motion system and product naming in new components. This phase delivers: NavBar, MechanicCard, Accordion, SlidePanel, Modal, ChatBubble, MetricTile, KarmaCallout — each faithful to the v2 design guide CSS specs. Also delivers the motion system (GPU-composited transitions at specified durations) and applies DS-12 product naming in new components and nav.

Requirements covered: DS-08, DS-09, DS-10, DS-11, DS-12

</domain>

<decisions>
## Implementation Decisions

### Component API Patterns
- **D-01:** Props-first API design. Components take typed props for all configuration (`<MechanicCard tag="SOUL" title="..." summary="..." />`). Svelte 5 snippets (`{@render children()}`) used only for complex nested content like modal body and accordion expanded content. Keeps the API simple for downstream agents to consume.

### Nav Tab Routing
- **D-02:** New v6 navigation structure with 4 canonical tabs from the design guide: INDRA (`/indra` — CEO briefing, fleet overview), OFFICE (`/office` — virtual office, agent cards), CHAT (`/chat` — command channel, threads), SANCTUM (`/sanctum` — metrics, karma, chronicle). Phase 3 builds the NavBar component with visual fidelity (logo gem, tabs, mode toggle). Actual route wiring happens in Phase 4 when pages are rebuilt. Tabs can link to placeholder routes or current v5 routes temporarily.

### Dual-World Component Scope
- **D-03:** World-native only. Build each component for its native world as specified in the design guide:
  - **Back Office components:** MechanicCard, Accordion, SlidePanel, Modal, KarmaCallout — styled per Back Office spec. Readable in Front Office via semantic aliases but no custom Front Office styles added.
  - **Front Office components:** ChatBubble, MetricTile — styled per Front Office spec. Readable in Back Office via semantic aliases.
  - **Shared (both worlds explicitly styled):** NavBar — has explicit Front Office and Back Office styles in the design guide.

### Product Naming (DS-12)
- **D-04:** Nav + new components only. Apply product naming in the NavBar tabs (SANCTUM not Dashboard) and all new Phase 3 components. Use "karma" not "score", "work" not "run". Do NOT rename strings in existing v5 pages — they get rebuilt with correct naming in Phase 4. No naming constants file needed yet.

### Claude's Discretion
- Component file organization within `services/ui/src/lib/components/` (flat vs subdirectory)
- Whether to keep or replace existing v5 components (ParticleCanvas, SoulInspectorPanel, SoulTierBadge, VerdictConfirmPanel)
- Exact Svelte 5 snippet patterns for accordion/modal nested content
- Whether NavBar active tab state uses SvelteKit `$page.url` or a prop
- Motion system implementation approach (global CSS vs per-component scoped transitions)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System Specification
- `tasks/akasa-design-guide-v2.md` — THE authoritative reference for all component CSS, motion specs, product states, and naming rules. Sections 6 (Components), 7 (Product States), 8 (Motion and Animation), 9 (Iconography), 10 (Voice and Copy), 11 (Do/Don't) are all relevant.
- `tasks/akasa-design-guide-v2.md` §6.1 — NavBar: 44px fixed, backdrop-filter blur, mode toggle, logo gem, Press Start 2P tabs at 6px
- `tasks/akasa-design-guide-v2.md` §6.2 — MechanicCard: Back Office expandable card with hover transform
- `tasks/akasa-design-guide-v2.md` §6.3 — Accordion: colour-coded tiers, max-height transition
- `tasks/akasa-design-guide-v2.md` §6.4 — SlidePanel: 380px fixed right, cubic-bezier slide
- `tasks/akasa-design-guide-v2.md` §6.5 — KarmaCallout: amber highlight block
- `tasks/akasa-design-guide-v2.md` §6.6 — Modal: full-screen overlay, backdrop-filter blur
- `tasks/akasa-design-guide-v2.md` §6.8 — ChatBubble: Front Office, user vs agent, typing indicator
- `tasks/akasa-design-guide-v2.md` §6.9 — MetricTile: Front Office, Press Start 2P values
- `tasks/akasa-design-guide-v2.md` §8 — Motion system: all transition durations and easing curves
- `tasks/akasa-design-guide-v2.md` §10.4 — Product feature names: Sanctum, The Chronicle, The Record

### Prior Phase Output
- `.planning/phases/02-design-system-tokens-and-typography/02-CONTEXT.md` — Phase 2 token decisions (semantic aliases, font loading, mode persistence)
- `services/ui/src/app.css` — Complete v2 token system (consumed by all new components)
- `services/ui/src/lib/mode.ts` — setMode()/getMode()/toggleMode() for NavBar mode toggle

### Architecture
- `tasks/prd-akasa-mvp.md` — Product requirements, two-world concept
- `.planning/PROJECT.md` — v6.0 architecture decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/ui/src/lib/mode.ts` — toggleMode() ready for NavBar mode toggle button
- `services/ui/src/lib/components/SoulTierBadge.svelte` — Existing tier badge, uses model tier tokens
- `services/ui/src/lib/components/SoulInspectorPanel.svelte` — Existing slide panel pattern (can inform SlidePanel API)
- `services/ui/src/lib/components/VerdictConfirmPanel.svelte` — Existing modal-like pattern
- `services/ui/src/lib/components/ParticleCanvas.svelte` — Canvas animation pattern

### Established Patterns
- Pure CSS custom properties in scoped `<style>` blocks — no Tailwind, no CSS modules
- Svelte 5 runes: `$props()`, `$state()`, `$derived()`, `$effect()`
- SvelteKit v2 with `$page` store for route awareness
- ESM everywhere with `"type": "module"`

### Integration Points
- `services/ui/src/routes/(app)/+layout.svelte` — Where NavBar component will be rendered
- `services/ui/src/app.css` — Token system consumed by all components (already complete from Phase 2)
- `services/ui/src/lib/mode.ts` — Mode toggle utility for NavBar
- Existing component directory: `services/ui/src/lib/components/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the v2 design guide is highly prescriptive about every component's visual treatment. Faithful implementation of the spec is the goal.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-design-system-components-and-motion*
*Context gathered: 2026-03-23*
