# Phase 2: Design System Tokens and Typography - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 02-design-system-tokens-and-typography
**Areas discussed:** Token migration strategy, World toggle persistence, Deprecated token enforcement, Font loading details

---

## Token Migration Strategy

### Q1: How should we handle the v5.0 app.css content?

| Option | Description | Selected |
|--------|-------------|----------|
| Clean slate | Replace app.css entirely with v2 token system. Existing landing page styles are v5 artifacts — rebuilt when needed in Phase 3/4. | ✓ |
| Keep landing styles, replace tokens only | Preserve glitch effects, buttons, scroll-reveal but update to new token names. More work now but landing page stays functional. | |
| Alias old names to new | Add --bg: var(--bo-bg) etc. so existing code still works. Safer for incremental migration but leaves tech debt. | |

**User's choice:** Clean slate
**Notes:** None

### Q2: Should components use semantic aliases or reference --fo-*/--bo-* directly?

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic aliases | Define --bg, --card, --text etc. that resolve to --fo-* or --bo-* based on body class. Components never think about modes. | ✓ |
| Direct --fo-*/--bo-* references | Components explicitly reference --fo-bg or --bo-bg, often inside mode-specific selectors. More verbose but explicit. | |
| Both layers | Define both raw --fo-*/--bo-* tokens AND semantic --bg/--text aliases. Raw for design guide compliance, aliases for ergonomics. | |

**User's choice:** Semantic aliases
**Notes:** None

---

## World Toggle Persistence

### Q1: How should the world preference be persisted?

| Option | Description | Selected |
|--------|-------------|----------|
| localStorage + inline script | Store in localStorage. Add blocking script in app.html that sets body class before paint. Zero flash, no server dependency. | ✓ |
| Cookie + SSR | Store in cookie. SvelteKit hooks read it server-side. True SSR support but adds cookie handling complexity. | |
| localStorage only (simple) | Store in localStorage, apply in +layout.svelte onMount. Simplest but will flash wrong theme until JS hydrates. | |

**User's choice:** localStorage + inline script
**Notes:** None

---

## Deprecated Token Enforcement

### Q1: What level of enforcement should prevent old tokens from being reintroduced?

| Option | Description | Selected |
|--------|-------------|----------|
| Grep script in package.json | Add 'lint:tokens' script that greps for banned patterns. Run manually or in CI. Lightweight, no extra dependencies. | ✓ |
| Pre-commit hook | husky + lint-staged runs grep on every commit. Catches violations immediately but adds husky dependency. | |
| ESLint stylelint rule | Custom stylelint rule flagging banned custom properties. Most thorough but requires stylelint setup. | |

**User's choice:** Grep script in package.json
**Notes:** Old --h-*/--d-*/--ak-* prefixes already absent from codebase. Enforcement is preventive.

---

## Font Loading Details

### Q1: Which Cormorant Garamond weights should we load?

| Option | Description | Selected |
|--------|-------------|----------|
| 300, 400, 600 + italic | Covers hero (300), body display (400), headings (600), plus italic. ~200KB total. Matches v2 guide type scale. | ✓ |
| 300 and 600 only + italic | Just weights explicitly referenced in v2 guide. Smaller bundle (~150KB) but no 400. | |
| Variable font | Single file covers all weights. Smallest total for 3+ weights. If @fontsource-variable available. | |

**User's choice:** 300, 400, 600 + italic
**Notes:** None

### Q2: Where should @fontsource CSS imports go?

| Option | Description | Selected |
|--------|-------------|----------|
| +layout.svelte | Import in root layout file. Vite processes and bundles. Standard SvelteKit pattern per CLAUDE.md. | ✓ |
| app.css @import | Import at top of app.css. Also works with Vite but mixes concerns. | |

**User's choice:** +layout.svelte
**Notes:** None

---

## Claude's Discretion

- Exact spacing scale naming convention
- Border radius scale values
- app.css internal structure and ordering
- Whether to split tokens into separate files
- Exact semantic alias names beyond the obvious

## Deferred Ideas

None — discussion stayed within phase scope
