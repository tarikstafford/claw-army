# Phase 3: Design System Components and Motion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 03-design-system-components-and-motion
**Areas discussed:** Component API patterns, Nav tab routing, Dual-world scope, Product naming depth

---

## Component API Patterns

| Option | Description | Selected |
|--------|-------------|----------|
| Props-first | Components take typed props for all config. Slots only for complex nested content (modal body, accordion inner). | ✓ |
| Slots-first | Components use Svelte 5 snippets for maximum flexibility. More composable but more verbose. | |
| You decide | Claude picks per component. | |

**User's choice:** Props-first
**Notes:** None

---

## Nav Tab Routing

| Option | Description | Selected |
|--------|-------------|----------|
| New v6 nav structure | 4 canonical tabs: INDRA, OFFICE, CHAT, SANCTUM mapping to new routes. Phase 3 builds component, Phase 4 wires routes. | ✓ |
| Keep current routes, rename tabs | Map tabs to existing v5 route groups. Avoids route restructuring. | |
| Stub nav, decide in Phase 4 | Build with visual fidelity but wire to current routes temporarily. | |

**User's choice:** New v6 nav structure
**Notes:** None

---

## Dual-World Scope

| Option | Description | Selected |
|--------|-------------|----------|
| World-native only | Build each component for its native world per spec. Semantic aliases handle basic readability in the other world. | ✓ |
| Full dual-world for all | Every component gets explicit FO and BO styles even if guide only shows one. | |
| You decide per component | Claude judges per component based on Phase 4/8 usage. | |

**User's choice:** World-native only
**Notes:** None

---

## Product Naming Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Nav + new components only | Apply naming in nav tabs and new components. Don't touch existing v5 pages. | ✓ |
| Full rename now | Find and replace all visible UI strings across all 25 existing Svelte files. | |
| Constants file + nav only | Create lib/naming.ts constants, apply in nav. Existing pages untouched. | |

**User's choice:** Nav + new components only
**Notes:** None

---

## Claude's Discretion

- Component file organization
- Existing v5 component handling
- Svelte 5 snippet patterns for nested content
- NavBar active tab state management
- Motion system implementation approach

## Deferred Ideas

None
